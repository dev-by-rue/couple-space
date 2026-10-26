# P1-12 · Account deletion

[← Phase 1](../board.md) · Size **L** · Decisions: [Q8](../../product/decisions.md#q8), [Q18](../../product/decisions.md#q18) · Design review: [E-7](../../product/decisions.md#e-7) · After: [P1-11](P1-11-leave-couple.md) · Next: [P1-13](P1-13-legal-trust-pages.md)

**Builds on P1-4** (`/me`, the `invalid_current_password` reason, the settings page), **P1-5** (the
`password_reset_tokens` table) **and P1-11** (dissolution). *Updated 2026-10-26:* P1-7 is shelved, so
there's no `archived_by_user_id` to clear. When the mutual archive is built (roadmap), add that step back.

**Goal:** `DELETE /me` with password re-entry deletes the account. If the user is in a couple, the couple
is dissolved first. Their answers and reveals are deleted immediately. Audit rows stay, without content.

**Done when:**

- `DELETE /me { password, confirm: true }`: a wrong password → `400 invalid_current_password`; success → `204`, cookies cleared.
- In one transaction: dissolve the couple (same as P1-11), delete the user's responses, reveals,
  memberships, invitations and tokens, delete the `users` row, and write a
  `user.deleted` audit row.
- No row anywhere still references the user id (except `audit_events.actor_user_id`, which has no FK by design).
- Settings has a "Delete account" section with a password confirm.

### ⚠️ Q8 and Q7 overlap. Please confirm

Q8 says the partner sees "This answer was removed". But Q8 also dissolves the couple, and Q7 makes
**all** content inaccessible to both once dissolved. So in MVP-1 the partner can never reach a session to
see that message. This guide therefore:
- deletes the leaver's answers **now** (not after 30 days), which is the part of Q8 that matters for privacy;
- leaves the partner's own answers to the normal 30-day purge (P1-11);
- doesn't build the "This answer was removed" UI. It becomes relevant only if a later decision lets the
  remaining partner keep read access.

### Other decisions

- **Hard delete, no grace period.** The task makes `users.deleted_at` optional. Without it, deletion is
  immediate and final, and the copy says so. Add a grace period later if support needs it.
- **Explicit deletes, not `ON DELETE CASCADE`.** Only `refresh_tokens` and `push_subscriptions` cascade
  today. Listing every table in one service method makes it obvious what deletion removes, and
  `account-deletion.service.ts` is where you add the next table. The trade-off: a new table with a user
  FK must be added here too, or deletion fails with an FK error. That at least fails loudly, not silently.
- **Invitations sent *to* this email** are deleted too: they hold the address.

---

## Step 1 · Domain

### `packages/domain/src/schemas/auth-schemas.ts` (change) — add
```ts
export const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal(true),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
```

### `packages/domain/src/schemas/auth-schemas.test.ts` (change) — add
```ts
describe("deleteAccountSchema", () => {
  it("needs the password and an explicit confirm", () => {
    expect(deleteAccountSchema.parse({ password: "x", confirm: true })).toEqual({
      password: "x",
      confirm: true,
    });
    expect(() => deleteAccountSchema.parse({ password: "x" })).toThrow();
    expect(() => deleteAccountSchema.parse({ password: "", confirm: true })).toThrow();
  });
});
```

---

## Step 2 · Share the dissolution with P1-11

Pull the body of `leaveCouple` that changes rows into a function that takes a transaction, so deletion
can call it inside its own transaction.

### `apps/api/src/couples/dissolve-couple.ts` (new)
```ts
import { and, eq, inArray } from "drizzle-orm";
import {
  auditEvents,
  coupleInvitations,
  coupleMemberships,
  couples,
  type Db,
} from "@couple-space/database";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Q7: dissolve a couple and end every active membership, inside the caller's
 * transaction. Returns false if it was already dissolved (lost a race).
 */
export async function dissolveCouple(
  tx: Tx,
  input: {
    coupleId: string;
    previousStatus: string;
    actorUserId: string;
    cause: "left" | "account_deleted";
  },
): Promise<boolean> {
  const now = new Date();
  const dissolved = await tx
    .update(couples)
    .set({ status: "dissolved", dissolvedAt: now, updatedAt: now })
    .where(
      and(
        eq(couples.id, input.coupleId),
        inArray(couples.status, ["forming", "active"]),
      ),
    )
    .returning({ id: couples.id });
  if (dissolved.length === 0) return false;

  await tx
    .update(coupleMemberships)
    .set({ status: "left", leftAt: now })
    .where(
      and(
        eq(coupleMemberships.coupleId, input.coupleId),
        eq(coupleMemberships.status, "active"),
      ),
    );

  await tx
    .update(coupleInvitations)
    .set({ status: "revoked" })
    .where(
      and(
        eq(coupleInvitations.coupleId, input.coupleId),
        eq(coupleInvitations.status, "pending"),
      ),
    );

  await tx.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    action: "couple.dissolved",
    entityType: "couple",
    entityId: input.coupleId,
    // Enums only (E-7).
    metadata: { previousStatus: input.previousStatus, cause: input.cause },
  });
  return true;
}
```
Check that the `Tx` type resolves in your Drizzle version. If `Db` exports a transaction type (some
setups have `PgTransaction<…>`), use that instead.

### `apps/api/src/couples/couples.service.ts` (change, P1-11's `leaveCouple`)
**Before**
```ts
      const now = new Date();
      // The status guard makes a double tap (or both partners at once) a no-op.
      const dissolved = await tx
        .update(couples)
        …
      await tx.insert(auditEvents).values([
        {
          actorUserId: user.id,
          action: "couple.left",
          …
        },
      ]);

      return { ok: true as const };
```
**After**
```ts
      await tx.insert(auditEvents).values({
        actorUserId: user.id,
        action: "couple.left",
        entityType: "couple",
        entityId: couple.id,
      });

      // The status guard inside makes a double tap (or both partners at once) a no-op.
      const done = await dissolveCouple(tx, {
        coupleId: couple.id,
        previousStatus: couple.status,
        actorUserId: user.id,
        cause: "left",
      });
      if (!done) {
        throw new ConflictException({ reason: "already_dissolved" });
      }

      return { ok: true as const };
```
Add `import { dissolveCouple } from "./dissolve-couple.js";`. The P1-11 tests still pass. The update order
is unchanged, and the audit rows now arrive as two inserts instead of one: the `couple.left` row, then
`couple.dissolved` inside the helper. A throw rolls back both, so writing `couple.left` first is safe.
Update the test's `inserted` check to look across both inserts (it already uses `JSON.stringify`).

---

## Step 3 · API

### `apps/api/src/users/dto/delete-account.schema.ts` (new)
```ts
/** Re-export shared delete-account schema from domain. */
export { deleteAccountSchema, type DeleteAccountInput } from "@couple-space/domain";
```

### `apps/api/src/users/account-deletion.service.ts` (new)
```ts
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, or } from "drizzle-orm";
import {
  auditEvents,
  coupleInvitations,
  coupleMemberships,
  couples,
  emailVerificationTokens,
  passwordResetTokens,
  sessionResponses,
  sessionReveals,
  users,
  type Db,
} from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { verifyPassword } from "../auth/password.js";
import { dissolveCouple } from "../couples/dissolve-couple.js";
import type { DeleteAccountInput } from "./dto/delete-account.schema.js";

/**
 * Q8: delete an account and everything that names it.
 *
 * Every table with a FK to users must be handled here (only refresh_tokens and
 * push_subscriptions cascade). A table missing from this list makes deletion
 * fail with an FK error, which is loud, not silent.
 */
@Injectable()
export class AccountDeletionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException();

    // Same reason as change-password (P1-4), so the web reuses its message.
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new BadRequestException({ reason: "invalid_current_password" });
    }

    await this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select({ coupleId: coupleMemberships.coupleId, status: couples.status })
        .from(coupleMemberships)
        .innerJoin(couples, eq(couples.id, coupleMemberships.coupleId))
        .where(and(eq(coupleMemberships.userId, userId), eq(coupleMemberships.status, "active")))
        .limit(1);

      // Q8: deleting an account dissolves the couple (no-op if already dissolved).
      if (membership) {
        await dissolveCouple(tx, {
          coupleId: membership.coupleId,
          previousStatus: membership.status,
          actorUserId: userId,
          cause: "account_deleted",
        });
      }

      // Content first: this user's answers and reveals go now, not after 30 days.
      await tx.delete(sessionReveals).where(eq(sessionReveals.userId, userId));
      await tx.delete(sessionResponses).where(eq(sessionResponses.userId, userId));

      await tx.delete(coupleMemberships).where(eq(coupleMemberships.userId, userId));
      await tx
        .delete(coupleInvitations)
        .where(
          or(
            eq(coupleInvitations.invitedByUserId, userId),
            eq(coupleInvitations.email, user.email),
          ),
        );
      await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
      // refresh_tokens and push_subscriptions cascade.
      await tx.delete(users).where(eq(users.id, userId));

      // E-7: id only. actor_user_id has no FK, so it survives the delete.
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        action: "user.deleted",
        entityType: "user",
        entityId: userId,
      });
    });
  }
}
```
Check the real column name for the inviter in `couple-invitations.ts` (`invitedByUserId` is what
`revokeInvitation` uses).

### `apps/api/src/users/users.module.ts` (change)
**Before**
```ts
  providers: [UsersService],
```
**After**
```ts
  providers: [UsersService, AccountDeletionService],
```
with `import { AccountDeletionService } from "./account-deletion.service.js";`.

### `apps/api/src/users/users.controller.ts` (change)
**Before** (after P1-4)
```ts
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
```
**After**
```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { clearAuthCookies } from "../auth/cookies.js";
import { AccountDeletionService } from "./account-deletion.service.js";
import { deleteAccountSchema } from "./dto/delete-account.schema.js";
```
**Constructor, before**
```ts
  constructor(private readonly users: UsersService) {}
```
**After**
```ts
  constructor(
    private readonly users: UsersService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}
```
**Add after `updateMe`**
```ts
  @Delete("me")
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteMe(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = deleteAccountSchema.parse(body);
    await this.accountDeletion.deleteAccount(user.id, input);
    clearAuthCookies(response);
  }
```
A `DELETE` with a JSON body is fine for `fetch` and Express. The access JWT stays valid for up to
`ACCESS_TOKEN_TTL_SECONDS`, but every lookup (`/me`, couples, sessions) now finds no user or membership.
P1-15: add `@RateLimit("login")` here, because it checks a password.

### `apps/api/src/users/account-deletion.service.test.ts` (new)
```ts
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { hashPassword } from "../auth/password.js";
import { AccountDeletionService } from "./account-deletion.service.js";
import { queryResult } from "../../test/factories.js";

describe("AccountDeletionService", () => {
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await hashPassword("Password1234");
  });

  function build(opts: { membership?: { coupleId: string; status: string } }) {
    const deleted: unknown[] = [];
    const tx = {
      select: vi.fn(() => queryResult(opts.membership ? [opts.membership] : [])),
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ ...queryResult([]), returning: vi.fn(async () => [{ id: "c1" }]) })),
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    };
    const db = {
      select: vi.fn(() => queryResult([{ id: "u1", email: "a@example.com", passwordHash }])),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { db, tx, deleted };
  }

  async function service(db: unknown) {
    const module = await Test.createTestingModule({
      providers: [AccountDeletionService, { provide: DB, useValue: db }],
    }).compile();
    return module.get(AccountDeletionService);
  }

  it("rejects a wrong password and deletes nothing", async () => {
    const { db } = build({});
    await expect(
      (await service(db)).deleteAccount("u1", { password: "nope", confirm: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("dissolves the couple, then deletes content before the user row", async () => {
    const { db, tx, deleted } = build({ membership: { coupleId: "c1", status: "active" } });
    await (await service(db)).deleteAccount("u1", { password: "Password1234", confirm: true });

    // dissolveCouple's update on couples is the first update.
    expect(tx.update).toHaveBeenCalled();
    const { users, sessionResponses, sessionReveals } = await import("@couple-space/database");
    expect(deleted.indexOf(sessionReveals)).toBeLessThan(deleted.indexOf(users));
    expect(deleted.indexOf(sessionResponses)).toBeLessThan(deleted.indexOf(users));
    expect(deleted.at(-1)).toBe(users);
  });

  it("works for someone with no couple", async () => {
    const { db, deleted } = build({});
    await (await service(db)).deleteAccount("u1", { password: "Password1234", confirm: true });
    const { users } = await import("@couple-space/database");
    expect(deleted).toContain(users);
  });
});
```
Move the dynamic `import("@couple-space/database")` to a normal top-level import if you prefer; it's
inline here only to keep the snippet together.

### FK safety net (e2e, optional but worth it)
In `apps/api/test/`, an e2e test against the local DB: register two users, form a couple, create a
session, answer, then `DELETE /me` as one → `204`, and
`select count(*) from users where id = $1` → 0. If a future table forgets this service, the test fails
on the FK.

---

## Step 4 · Web

### `apps/web/hooks/use-me.ts` (change) — add
```ts
import type { DeleteAccountInput } from "@couple-space/domain";
import { unsubscribeThisDevice } from "@/hooks/use-push";

export function useDeleteAccountMutation(
  options?: UseMutationOptions<void, Error, DeleteAccountInput>,
) {
  return useMutation({
    ...options,
    mutationFn: async (body: DeleteAccountInput) => {
      await apiFetch<void>("/me", { method: "DELETE", body: JSON.stringify(body) });
      // The server already deleted the subscription; this drops it from the browser.
      await unsubscribeThisDevice().catch(() => undefined);
    },
  });
}
```
(Add `type UseMutationOptions` to the React Query import.) Unsubscribing happens **after** the delete,
unlike logout, because a wrong password must leave notifications on.

### `apps/web/components/organisms/delete-account-form/delete-account-form.tsx` (new, presentational)
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { deleteAccountSchema, type DeleteAccountInput } from "@couple-space/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type DeleteAccountFormProps = {
  isDeleting: boolean;
  errorMessage?: string;
  onDelete: (input: DeleteAccountInput) => void;
};

const FORM_ID = "delete-account-form";

export function DeleteAccountForm({
  isDeleting,
  errorMessage,
  onDelete,
}: Readonly<DeleteAccountFormProps>) {
  const form = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "", confirm: true },
  });
  const { errors } = form.formState;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Deleting your account removes your answers straight away and closes
        your couple space for both of you. This can&apos;t be undone.
      </p>
      <Dialog>
        <DialogTrigger render={<Button variant="destructive" className="self-start" />}>
          Delete account
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Delete your account?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Enter your password to confirm. Your answers are deleted now, and
              your partner loses access to your shared space.
            </DialogDescription>
          </DialogHeader>
          <form id={FORM_ID} noValidate onSubmit={form.handleSubmit(onDelete)}>
            <Field data-invalid={!!errors.password || undefined}>
              <FieldLabel htmlFor="delete-password">Password</FieldLabel>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password || undefined}
                {...form.register("password")}
              />
              <FieldError>{errors.password?.message}</FieldError>
            </Field>
          </form>
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" form={FORM_ID} variant="destructive" disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete for good"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```
`confirm: true` is set in `defaultValues` and never rendered. The dialog itself is the confirm step;
the server still requires the field.

### `apps/web/app/(app)/settings/page.tsx` (change)
```tsx
  const queryClient = useQueryClient();
  const deleteAccount = useDeleteAccountMutation({
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login?deleted=1");
    },
  });
```
After the couple card:
```tsx
      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm
            isDeleting={deleteAccount.isPending}
            errorMessage={
              deleteAccount.isError
                ? friendlyAuthErrorMessage(deleteAccount.error.message)
                : undefined
            }
            onDelete={(input) => deleteAccount.mutate(input)}
          />
        </CardContent>
      </Card>
```
Optional: on `/login`, show "Your account has been deleted." when `?deleted=1`.

---

## Verification
1. `pnpm check-types && pnpm test` (and the e2e test if you add it).
2. Test couple with some answered and follow-up sessions. As A: Settings → Delete account →
   wrong password → "Your current password is incorrect." Nothing changes.
3. Correct password → lands on `/login`. Logging in as A fails.
4. DB: no `users` row for A; no `session_responses`/`session_reveals`/`couple_memberships`/tokens for A's
   id; couple `dissolved`; B's membership `left`; B's answers still there (until the purge).
5. B refreshes → create-couple panel.
6. `select * from audit_events where actor_user_id = '<A>'` → rows remain, `metadata` has only enums and ids.
