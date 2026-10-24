# P1-11 · Leave couple / dissolution

[← Phase 1](../phase-1-mvp-1.md) · Size **L** · Decisions: [Q7](../../03-product-decisions.md#q7), [Q18](../../03-product-decisions.md#q18), [Q19](../../03-product-decisions.md#q19) · Design review: [E-4](../../erd/design-review.md#e-4), [E-8](../../erd/design-review.md#e-8) · After: [P1-7](P1-7-skip-archive.md) · Next: [P1-12](P1-12-account-deletion.md)

**Builds on P1-4** (the settings page hosts the button) **and P1-7** (`sessionWriteBlock`).

**Goal:** either partner can leave, with a confirmation step. The couple becomes `dissolved` and **both**
memberships become `left`, so all session content is inaccessible to both (Q7). Both can re-couple
straight away (Q19). A daily job hard-deletes a dissolved couple's sessions after 30 days (Q18, E-8).

**Done when:**

- `couples.dissolved_at`, `couple_memberships.left_at` (H-13).
- `POST /couples/me/leave { confirm: true }` dissolves the couple, leaves both memberships, revokes
  pending invitations and writes `couple.left` + `couple.dissolved` audit events. It's one transaction.
- Every session endpoint rejects a couple that isn't `active` (`403 couple_not_active`).
- `pnpm --filter @couple-space/database purge-dissolved` deletes reveals, responses and sessions (children
  first) for couples dissolved more than 30 days ago, and is safe to run again. It runs as a Railway cron.
- Settings has a "Leave couple" section with a confirm dialog. After leaving, `/couple` shows the
  create/join panel.
- Domain and service tests pass.

### Decisions and gaps to flag

- **`dissolving` isn't used.** Q7 goes straight to `dissolved`; the status stays in the enum for later.
- **The other partner isn't told.** On their next load they see the create-couple panel. A one-line
  "Your couple space was closed" notice would need the API to say so. Proposed: `GET /couples/me` returns
  `404 { reason: "no_couple", previousCoupleDissolvedAt }` for 30 days. **Not in this guide** until you
  decide; it touches how a breakup is communicated.
- **Purge scope:** sessions, responses and reveals. Invitations and memberships stay. They hold an email
  and ids but no content; P1-12 (account deletion) handles personal data. Audit rows stay (Q18).
- **Leaving a `forming` couple** (no partner yet) is allowed. It dissolves it and revokes the pending
  invite, so "cancel" and "leave" are the same action.
- **Push subscriptions** aren't touched. Nothing pushes to a dissolved couple because the session
  endpoints are blocked.

---

## Step 1 · Domain

### `packages/domain/src/couples/can-leave-couple.ts` (new — new `couples/` area)
```ts
import type { CoupleStatus } from "../couple-status.js";

export type LeaveCoupleGate =
  | { ok: true }
  | { ok: false; reason: "not_a_member" | "already_dissolved" };

/** Q7: any active member of a forming or active couple can leave. */
export function canLeaveCouple(input: {
  coupleStatus: CoupleStatus;
  isActiveMember: boolean;
}): LeaveCoupleGate {
  if (!input.isActiveMember) return { ok: false, reason: "not_a_member" };
  if (input.coupleStatus === "dissolving" || input.coupleStatus === "dissolved") {
    return { ok: false, reason: "already_dissolved" };
  }
  return { ok: true };
}
```

### `packages/domain/src/couples/can-leave-couple.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { canLeaveCouple } from "./can-leave-couple.js";

describe("canLeaveCouple", () => {
  it.each(["active", "forming"] as const)("lets an active member leave a %s couple", (coupleStatus) => {
    expect(canLeaveCouple({ coupleStatus, isActiveMember: true })).toEqual({ ok: true });
  });

  it("rejects someone who isn't an active member", () => {
    expect(canLeaveCouple({ coupleStatus: "active", isActiveMember: false })).toEqual({
      ok: false,
      reason: "not_a_member",
    });
  });

  it.each(["dissolving", "dissolved"] as const)("rejects a %s couple", (coupleStatus) => {
    expect(canLeaveCouple({ coupleStatus, isActiveMember: true })).toEqual({
      ok: false,
      reason: "already_dissolved",
    });
  });
});
```

### `packages/domain/src/schemas/couple-schemas.ts` (new)
```ts
import { z } from "zod";

/** The confirm step is enforced server-side too, so a stray POST can't end a couple. */
export const leaveCoupleSchema = z.object({
  confirm: z.literal(true),
});

export type LeaveCoupleInput = z.infer<typeof leaveCoupleSchema>;
```
Add a test in `couple-schemas.test.ts`: `{ confirm: true }` passes; `{}`, `{ confirm: false }` and
`{ confirm: "true" }` throw.

### `packages/domain/src/sessions/session-archive.ts` (change, from P1-7)
**Before**
```ts
export type SessionWriteBlock = "session_archived" | null;

/** Archived sessions are read-only: no answers, drafts or reveals (Q4). */
export function sessionWriteBlock(input: {
  archivedAt: Date | null;
}): SessionWriteBlock {
  return input.archivedAt ? "session_archived" : null;
}
```
**After**
```ts
import type { CoupleStatus } from "../couple-status.js";

export type SessionWriteBlock = "couple_not_active" | "session_archived" | null;

/** Can this session still change? Not if the couple isn't active (Q7) or it's archived (Q4). */
export function sessionWriteBlock(input: {
  coupleStatus: CoupleStatus;
  archivedAt: Date | null;
}): SessionWriteBlock {
  if (input.coupleStatus !== "active") return "couple_not_active";
  return input.archivedAt ? "session_archived" : null;
}
```
Update `session-archive.test.ts` to pass `coupleStatus: "active"` in the existing cases, and add one:
`{ coupleStatus: "dissolved", archivedAt: null }` → `"couple_not_active"`.

### `packages/domain/src/index.ts` (change) — add
```ts
export * from "./couples/can-leave-couple.js";
export * from "./schemas/couple-schemas.js";
```

---

## Step 2 · Database

### `packages/database/src/schema/couples.ts` (change)
**Before**
```ts
  status: text("status").notNull(), // CoupleStatus
```
**After**
```ts
  status: text("status").notNull(), // CoupleStatus
  /** Q7/Q18: set on dissolution; the purge job deletes content 30 days later. */
  dissolvedAt: timestamp("dissolved_at", { withTimezone: true }),
```

### `packages/database/src/schema/couple-memberships.ts` (change)
**Before**
```ts
    status: text("status").notNull(), // MembershipStatus
```
**After**
```ts
    status: text("status").notNull(), // MembershipStatus
    /** E-4 / H-13: when this member left. Null while active. */
    leftAt: timestamp("left_at", { withTimezone: true }),
```

### Migration
`generate`. Two nullable `ADD COLUMN`s, safe as generated. If any existing row already has
`status = 'left'` (there shouldn't be, because nothing writes it yet), hand-add a backfill:
```sql
UPDATE "couple_memberships" SET "left_at" = "created_at" WHERE "status" = 'left' AND "left_at" IS NULL;
```

---

## Step 3 · API: leave

### `apps/api/src/couples/dto/leave-couple.schema.ts` (new)
```ts
/** Re-export shared leave-couple schema from domain. */
export { leaveCoupleSchema, type LeaveCoupleInput } from "@couple-space/domain";
```

### `apps/api/src/couples/couples.service.ts` (change)
**Imports, before**
```ts
import { and, count, eq, gte, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { canAcceptInvitation, canActivateCouple } from "@couple-space/domain";
```
**After**
```ts
import { and, count, eq, gte, desc, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  canAcceptInvitation,
  canActivateCouple,
  canLeaveCouple,
  type CoupleStatus,
} from "@couple-space/domain";
```
**Add after `revokeInvitation`**
```ts
  /**
   * Q7: either partner leaves. The couple dissolves and BOTH memberships end,
   * so neither can reach the shared sessions. Q19: both can re-couple at once,
   * because the partial unique index only covers active memberships.
   */
  async leaveCouple(user: AuthUser): Promise<{ ok: true }> {
    return this.db.transaction(async (tx) => {
      const [mine] = await tx
        .select()
        .from(coupleMemberships)
        .where(
          and(
            eq(coupleMemberships.userId, user.id),
            eq(coupleMemberships.status, "active"),
          ),
        )
        .limit(1);
      if (!mine) {
        throw new NotFoundException({ reason: "no_couple" });
      }

      const [couple] = await tx
        .select()
        .from(couples)
        .where(eq(couples.id, mine.coupleId))
        .limit(1);

      const gate = canLeaveCouple({
        coupleStatus: couple.status as CoupleStatus,
        isActiveMember: true,
      });
      if (!gate.ok) {
        throw new ConflictException({ reason: gate.reason });
      }

      const now = new Date();
      // The status guard makes a double tap (or both partners at once) a no-op.
      const dissolved = await tx
        .update(couples)
        .set({ status: "dissolved", dissolvedAt: now, updatedAt: now })
        .where(
          and(
            eq(couples.id, couple.id),
            inArray(couples.status, ["forming", "active"]),
          ),
        )
        .returning({ id: couples.id });
      if (dissolved.length === 0) {
        throw new ConflictException({ reason: "already_dissolved" });
      }

      await tx
        .update(coupleMemberships)
        .set({ status: "left", leftAt: now })
        .where(
          and(
            eq(coupleMemberships.coupleId, couple.id),
            eq(coupleMemberships.status, "active"),
          ),
        );

      await tx
        .update(coupleInvitations)
        .set({ status: "revoked" })
        .where(
          and(
            eq(coupleInvitations.coupleId, couple.id),
            eq(coupleInvitations.status, "pending"),
          ),
        );

      await tx.insert(auditEvents).values([
        {
          actorUserId: user.id,
          action: "couple.left",
          entityType: "couple",
          entityId: couple.id,
        },
        {
          actorUserId: user.id,
          action: "couple.dissolved",
          entityType: "couple",
          entityId: couple.id,
          metadata: { previousStatus: couple.status },
        },
      ]);

      return { ok: true as const };
    });
  }
```
This file writes audit rows with `tx.insert(auditEvents)` inside transactions, not through
`AuditService`. I've matched that, so the audit is part of the same commit.

### `apps/api/src/couples/couples.controller.ts` (change)
Add `HttpCode` to the `@nestjs/common` import and
`import { leaveCoupleSchema } from "./dto/leave-couple.schema.js";`, then:
```ts
  @Post("couples/me/leave")
  @HttpCode(200)
  leaveCouple(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    leaveCoupleSchema.parse(body);
    return this.couples.leaveCouple(user);
  }
```
Nest matches routes in declaration order, and `couples/me/leave` doesn't collide with
`couples/:coupleId/invitations`, so order doesn't matter here.

### Tests — `apps/api/src/couples/couples.service.test.ts`
Use the file's existing setup for `CouplesService` (or create one in the same style as the other service
tests). Since everything happens inside `db.transaction`, mock `transaction` to call back with a `tx`:
```ts
describe("CouplesService.leaveCouple", () => {
  const user = { id: "u1", email: "a@example.com", emailVerified: true };

  function makeTx(couple: { id: string; status: string }, dissolvedRows = [{ id: couple.id }]) {
    const updates: Array<Record<string, unknown>> = [];
    const inserted: unknown[] = [];
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(queryResult([{ coupleId: couple.id, userId: "u1", status: "active" }]))
        .mockReturnValueOnce(queryResult([couple])),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => {
          updates.push(values);
          // Awaitable for plain updates, with .returning() for the guarded one
          // (the same trick createCouple's test uses).
          return {
            where: vi.fn(() => ({
              ...queryResult([]),
              returning: vi.fn(async () => dissolvedRows),
            })),
          };
        }),
      })),
      insert: vi.fn(() => ({ values: vi.fn(async (v: unknown) => inserted.push(v)) })),
    };
    return { tx, updates, inserted };
  }

  async function build(tx: unknown) {
    const db = { transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
    const module = await Test.createTestingModule({
      providers: [CouplesService, { provide: DB, useValue: db }],
    }).compile();
    return module.get(CouplesService);
  }

  it("dissolves the couple, ends both memberships and revokes invites", async () => {
    const { tx, updates, inserted } = makeTx({ id: "c1", status: "active" });
    await expect((await build(tx)).leaveCouple(user)).resolves.toEqual({ ok: true });

    expect(updates[0]).toMatchObject({ status: "dissolved", dissolvedAt: expect.any(Date) });
    expect(updates[1]).toMatchObject({ status: "left", leftAt: expect.any(Date) });
    expect(updates[2]).toEqual({ status: "revoked" });
    expect(JSON.stringify(inserted)).toContain("couple.dissolved");
  });

  it("rejects an already dissolved couple", async () => {
    const { tx } = makeTx({ id: "c1", status: "dissolved" });
    await expect((await build(tx)).leaveCouple(user)).rejects.toMatchObject({
      response: { reason: "already_dissolved" },
    });
  });

  it("treats losing the race as already dissolved", async () => {
    const { tx } = makeTx({ id: "c1", status: "active" }, []);
    await expect((await build(tx)).leaveCouple(user)).rejects.toMatchObject({
      response: { reason: "already_dissolved" },
    });
  });
});
```
`couples.service.test.ts` already imports `queryResult` from `test/factories.ts`; put this `describe`
after the existing ones.

---

## Step 4 · API: block session endpoints for non-active couples

### `apps/api/src/conversations/conversations.service.ts` (change)
After P1-7, writes go through `requireWritableSession`. Pass the couple status in:

**Before** (P1-7)
```ts
    const block = sessionWriteBlock({ archivedAt: ctx.session.archivedAt });
```
**After**
```ts
    const block = sessionWriteBlock({
      coupleStatus: ctx.coupleStatus as CoupleStatus,
      archivedAt: ctx.session.archivedAt,
    });
    if (block === "couple_not_active") {
      throw new ForbiddenException({ reason: block });
    }
```
(The existing `if (block) throw new ConflictException(...)` stays for `session_archived`.)

**Reads.** After leaving, both memberships are `left`, so `requireMembership` (which only finds `active`
memberships) already returns `404 no_couple` for every session read. No change needed. Add a comment
there so it isn't "fixed" later:
```ts
  private async requireMembership(user: AuthUser) {
    // Only ACTIVE memberships count: after leaving (Q7), nobody can read the
    // dissolved couple's sessions, even though the rows exist until the purge.
```
`createSession` and `startFollowUp` already check `coupleStatus !== "active"`.

Add one test: `submitResponse` with `couple.status = "forming"` → `403 couple_not_active`.

---

## Step 5 · Purge job (E-8)

### `packages/database/scripts/purge-dissolved.ts` (new)
```ts
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { createDb } from "../src/client.js";
import {
  auditEvents,
  conversationSessions,
  couples,
  sessionResponses,
  sessionReveals,
} from "../src/schema/index.js";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

/** Q18: a dissolved couple's session content is hard-deleted after 30 days. */
const PURGE_AFTER_DAYS = 30;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const db = createDb(url);

const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);

const due = await db
  .select({ id: couples.id })
  .from(couples)
  .where(and(eq(couples.status, "dissolved"), isNotNull(couples.dissolvedAt), lt(couples.dissolvedAt, cutoff)));

let purgedSessions = 0;

// One transaction per couple: a failure leaves the others done and this one intact.
for (const couple of due) {
  const count = await db.transaction(async (tx) => {
    const sessions = await tx
      .select({ id: conversationSessions.id })
      .from(conversationSessions)
      .where(eq(conversationSessions.coupleId, couple.id));
    if (sessions.length === 0) return 0;
    const ids = sessions.map((s) => s.id);

    await tx.delete(sessionReveals).where(inArray(sessionReveals.sessionId, ids));
    await tx.delete(sessionResponses).where(inArray(sessionResponses.sessionId, ids));
    // Children reference parents (P1-8), so delete them first.
    await tx
      .delete(conversationSessions)
      .where(and(inArray(conversationSessions.id, ids), isNotNull(conversationSessions.parentSessionId)));
    await tx.delete(conversationSessions).where(inArray(conversationSessions.id, ids));

    await tx.insert(auditEvents).values({
      actorUserId: null,
      action: "couple.purged",
      entityType: "couple",
      entityId: couple.id,
      metadata: { sessions: ids.length },
    });
    return ids.length;
  });
  purgedSessions += count;
}

console.log(`purge-dissolved: ${due.length} couples checked, ${purgedSessions} sessions deleted`);
await db.$client.end();
```
It's safe to run again: an already-purged couple has no sessions left, so it returns early and writes no
second audit row.

`PURGE_AFTER_DAYS` isn't in `@couple-space/domain` because `packages/database` doesn't depend on it.
Adding that dependency for one number isn't worth it; the Q18 link in the comment is the source of truth.

### `packages/database/package.json` (change)
**Before**
```json
    "clear-sessions": "tsx seed/clear-sessions.ts"
```
**After**
```json
    "clear-sessions": "tsx seed/clear-sessions.ts",
    "purge-dissolved": "tsx scripts/purge-dissolved.ts"
```

### Railway cron (configuration)
Add a new service in the same project from the same repo. Settings:
- **Start command:** `pnpm --filter @couple-space/database purge-dissolved`
- **Cron schedule:** `0 3 * * *` (03:00 UTC daily)
- **Variables:** `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- No healthcheck, no public domain.

Document it in `docs/deployment/railway.md` (a new "Cron: purge dissolved couples" section).

---

## Step 6 · Web

### `apps/web/hooks/use-couple.ts` (change) — add
```ts
export function useLeaveCoupleMutation(
  options?: UseMutationOptions<{ ok: true }, Error, void>,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation({
    ...rest,
    mutationFn: () =>
      apiFetch<{ ok: true }>("/couples/me/leave", {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      }),
    onSuccess: async (...args) => {
      // Sessions belong to the old couple; drop them rather than refetch into 404s.
      queryClient.removeQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({ queryKey: COUPLE_ME_QUERY_KEY });
      await onSuccess?.(...args);
    },
  });
}
```

### `apps/web/components/organisms/leave-couple-panel/leave-couple-panel.tsx` (new, presentational)
```tsx
"use client";

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

type LeaveCouplePanelProps = {
  partnerName: string | null;
  isLeaving: boolean;
  errorMessage?: string;
  onLeave: () => void;
};

export function LeaveCouplePanel({
  partnerName,
  isLeaving,
  errorMessage,
  onLeave,
}: Readonly<LeaveCouplePanelProps>) {
  const who = partnerName ?? "your partner";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Leaving closes this space for both of you. Neither of you will be able
        to see your past conversations, and they&apos;re permanently deleted
        after 30 days. You can start or join a new space straight away.
      </p>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Dialog>
        <DialogTrigger render={<Button variant="destructive" className="self-start" />}>
          Leave couple space
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Leave your space with {who}?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              This can&apos;t be undone. All of your conversations become
              unavailable to both of you right away.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Stay</DialogClose>
            <Button variant="destructive" disabled={isLeaving} onClick={onLeave}>
              {isLeaving ? "Leaving…" : "Yes, leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```
Check that `Button` has a `destructive` variant (shadcn default). If it doesn't, use `outline` plus
`text-destructive`.

### `apps/web/app/(app)/settings/page.tsx` (change, from P1-4)
Add the imports for `useCoupleMeQuery`, `useLeaveCoupleMutation`, `LeaveCouplePanel` and `useRouter`.
```tsx
  const router = useRouter();
  const couple = useCoupleMeQuery();
  const leave = useLeaveCoupleMutation({ onSuccess: () => router.push("/couple") });
```
After the Password card:
```tsx
      {couple.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Your couple space</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveCouplePanel
              partnerName={
                couple.data.members.find((m) => m.userId !== me.data.id)?.displayName ?? null
              }
              isLeaving={leave.isPending}
              errorMessage={leave.isError ? "Couldn't leave just now. Please try again" : undefined}
              onLeave={() => leave.mutate()}
            />
          </CardContent>
        </Card>
      ) : null}
```
`useCoupleMeQuery` returns `null` when there's no couple, so the card hides itself.

---

## Verification
1. `generate` → read → `migrate`. `pnpm check-types && pnpm test`.
2. Test couple, A in Settings → Leave → confirm → A lands on the create-couple panel.
3. B refreshes → create-couple panel. B opening an old `/conversation/<id>` link → "Conversation not found".
4. `curl` any session endpoint as either user → 404 `no_couple`. DB: couple `dissolved` with
   `dissolved_at`; both memberships `left` with `left_at`; pending invites `revoked`.
5. A creates a new couple and invites B, and B accepts → works (Q19); none of the old sessions appear.
6. Purge: `update couples set dissolved_at = now() - interval '31 days' where id = '<old>'`, then
   `pnpm --filter @couple-space/database purge-dissolved` → reports the sessions; rows gone; one
   `couple.purged` audit row. Run it again → 0 deleted, no new audit row.
