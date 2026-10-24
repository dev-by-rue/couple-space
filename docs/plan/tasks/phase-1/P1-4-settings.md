# P1-4 · Settings page `/settings`

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Decision: [Q20](../../03-product-decisions.md#q20) · Next: [P1-5](P1-5-password-reset.md)

## Context
Users can't change their display name or password after registering. P1-4 adds `/settings` with two
forms: display name (Q20: required, not unique, 1–40 chars, trimmed, only shown to your partner) and
change password (revokes all other refresh tokens, so other logged-in devices get signed out).

Full before/after code with tests. Nothing here is applied yet.

### Deviations to flag
- **Route:** the plan says `PATCH /users/me`, but `GET /me` lives at `/me` (`UsersController` has
  `@Controller()`). I use `PATCH /me` to match. Update the task text if you agree.
- **Wrong current password → 400, not 401.** The session is still valid; the input is wrong. A 401
  would also be read as "logged out" by any future refresh interceptor.
- **Web tests:** `apps/web` has no test runner (`app-header.test.tsx` is empty, and there's no vitest in
  `package.json`). Adding one is a new pattern, so I'm not including it. Tests are in domain + API.
  Say so if you want web test setup as a separate task.
- **Confirm-password field** is web-only (a UX check, not a business rule), so it lives in the form file
  as `changePasswordSchema.and(...)`. That's the only schema not in `@couple-space/domain`.

---

## Step 1 · Domain schemas

### `packages/domain/src/schemas/auth-schemas.ts` (change)

**Before**
```ts
export const registerSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
  password: z
    .string()
    .min(12)
    .regex(/[a-z]/, "password needs a lowercase letter")
    .regex(/[A-Z]/, "password needs an uppercase letter")
    .regex(/[0-9]/, "password needs a digit"),
  displayName: z.string().trim().min(1).max(40),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

**After**
```ts
/** Password policy: min 12 + upper/lower/digit. Shared by register and change-password. */
export const passwordSchema = z
  .string()
  .min(12)
  .regex(/[a-z]/, "password needs a lowercase letter")
  .regex(/[A-Z]/, "password needs an uppercase letter")
  .regex(/[0-9]/, "password needs a digit");

/** Q20: required, not unique, 1–40 characters after trimming. */
export const displayNameSchema = z.string().trim().min(1).max(40);

export const registerSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
  password: passwordSchema,
  displayName: displayNameSchema,
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "new password must be different from the current one",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
```
`index.ts` already does `export * from "./schemas/auth-schemas.js"`, so nothing changes there.

### `packages/domain/src/schemas/auth-schemas.test.ts` (change)

**Before**
```ts
import { loginSchema, registerSchema } from "../schemas/auth-schemas.js";
```
**After**
```ts
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "../schemas/auth-schemas.js";
```
**Add at the end of the file:**
```ts
describe("updateProfileSchema", () => {
  it("trims the display name", () => {
    expect(updateProfileSchema.parse({ displayName: "  Sam " }).displayName).toBe("Sam");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(() => updateProfileSchema.parse({ displayName: "   " })).toThrow();
  });

  it("accepts 40 characters and rejects 41", () => {
    expect(() => updateProfileSchema.parse({ displayName: "a".repeat(40) })).not.toThrow();
    expect(() => updateProfileSchema.parse({ displayName: "a".repeat(41) })).toThrow();
  });
});

describe("changePasswordSchema", () => {
  const valid = { currentPassword: "OldPassword123", newPassword: "NewPassword123" };

  it("accepts a valid change", () => {
    expect(changePasswordSchema.parse(valid)).toEqual(valid);
  });

  it("requires the current password", () => {
    expect(() => changePasswordSchema.parse({ ...valid, currentPassword: "" })).toThrow();
  });

  it("applies the register password policy to the new password", () => {
    expect(() =>
      changePasswordSchema.parse({ ...valid, newPassword: "passwordpassword" }),
    ).toThrow();
  });

  it("rejects a new password equal to the current one, on newPassword", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "SamePassword123",
      newPassword: "SamePassword123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
  });
});
```

---

## Step 2 · API: display name (`PATCH /me`)

### `apps/api/src/users/dto/update-profile.schema.ts` (new, same pattern as `auth/dto/register.schema.ts`)
```ts
/**
 * Re-export shared profile schema from domain.
 * Single source of truth for display name rules (Q20).
 */
export {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@couple-space/domain";
```

### `apps/api/src/users/users.service.ts` (change)

**Before**
```ts
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}
```
**After**
```ts
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users, type Db } from "@couple-space/database";
import { AuditService } from "../audit/audit.service.js";
import { DB } from "../db/db.module.js";
import type { UpdateProfileInput } from "./dto/update-profile.schema.js";

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}
```
**Add after `getMe`:**
```ts
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updated = await this.db
      .update(users)
      .set({ displayName: input.displayName, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!updated[0]) {
      throw new NotFoundException();
    }

    // No name in metadata: audit rows must not carry user content (E-7).
    await this.audit.append({
      actorUserId: userId,
      action: "user.update_profile",
      entityType: "user",
      entityId: userId,
    });

    return this.getMe(userId);
  }
```
`AuditModule` is `@Global()`, so `UsersModule` needs no new import.

### `apps/api/src/users/users.controller.ts` (change)

**Before**
```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
```
**After**
```ts
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { updateProfileSchema } from "./dto/update-profile.schema.js";
```
**Add after `me()`:**
```ts
  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = updateProfileSchema.parse(body);
    return this.users.updateProfile(user.id, input);
  }
```
(The access JWT doesn't contain `displayName`, so no token re-issue is needed.)

### `apps/api/src/users/users.service.test.ts` (new)
```ts
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import { UsersService } from "./users.service.js";

describe("UsersService.updateProfile", () => {
  let service: UsersService;

  const row = {
    id: "u1",
    email: "a@example.com",
    emailVerified: true,
    displayName: "Sam",
    dateOfBirth: "1990-01-01",
  };

  const setSpy = vi.fn();
  const mockDatabase = {
    update: vi.fn(() => ({
      set: setSpy.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [row]),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [row]),
        })),
      })),
    })),
  };

  const mockAudit = { append: vi.fn(async () => undefined) };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DB, useValue: mockDatabase },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it("updates the display name and returns the /me shape", async () => {
    const result = await service.updateProfile("u1", { displayName: "Sam" });

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Sam" }),
    );
    expect(result).toMatchObject({ id: "u1", displayName: "Sam", couple: null });
  });

  it("audits without the name in metadata", async () => {
    await service.updateProfile("u1", { displayName: "Sam" });

    expect(mockAudit.append).toHaveBeenCalledWith({
      actorUserId: "u1",
      action: "user.update_profile",
      entityType: "user",
      entityId: "u1",
    });
  });

  it("throws NotFound when the user no longer exists", async () => {
    mockDatabase.update.mockReturnValueOnce({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(async () => []) })),
      })),
    });

    await expect(
      service.updateProfile("missing", { displayName: "Sam" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

---

## Step 3 · API: change password (`POST /auth/change-password`)

### `apps/api/src/auth/dto/change-password.schema.ts` (new)
```ts
/**
 * Re-export shared change-password schema from domain.
 * Uses the same password policy as register.
 */
export {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@couple-space/domain";
```

### `apps/api/src/token/token.service.ts` (change) — add after `revokeRefresh`
```ts
  /**
   * Revoke every live refresh token for a user (password change, later
   * password reset / account deletion). Already-revoked rows keep their
   * original revokedAt.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
      );
  }
```
(`and`, `eq`, `isNull` are already imported.) P1-5 password reset reuses this.

### `apps/api/src/token/token.service.test.ts` (change) — add inside `describe("TokenService")`
```ts
  it('revokeAllForUser sets revokedAt on the user\'s live tokens', async () => {
    const setSpy = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    mockDatabase.update.mockReturnValueOnce({ set: setSpy });

    await service.revokeAllForUser('user-1');

    expect(mockDatabase.update).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
  });
```
(Single quotes to match that file.)

### `apps/api/src/auth/auth.service.ts` (change)

**Before**
```ts
import type { LoginInput } from "./dto/login.schema.js";
```
**After**
```ts
import type { ChangePasswordInput } from "./dto/change-password.schema.js";
import type { LoginInput } from "./dto/login.schema.js";
```
**Add after `logout`:**
```ts
  /**
   * Changes the password and signs out every other device.
   * Revokes all refresh tokens, then issues a fresh pair for the caller, so
   * this device stays logged in and the rest fail on their next refresh.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<TokenPair & { user: PublicUser }> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new UnauthorizedException({ reason: "invalid_credentials" });
    }

    // 400 not 401: the session is valid, the typed password is wrong.
    const ok = await verifyPassword(row.passwordHash, input.currentPassword);
    if (!ok) {
      throw new BadRequestException({ reason: "invalid_current_password" });
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.tokens.revokeAllForUser(userId);
    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: userId,
      action: "auth.change_password",
      entityType: "user",
      entityId: userId,
    });

    return { ...pair, user: toPublicUser(row) };
  }
```
Note: the access JWT on other devices still works until it expires (`ACCESS_TOKEN_TTL_SECONDS`). That's
the existing design; the task only asks for refresh-token revocation.

### `apps/api/src/auth/auth.controller.ts` (change)

**Before**
```ts
import { loginSchema } from "./dto/login.schema.js";
```
**After**
```ts
import { changePasswordSchema } from "./dto/change-password.schema.js";
import { loginSchema } from "./dto/login.schema.js";
```
**Add after `logout`:**
```ts
  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = changePasswordSchema.parse(body);
    const result = await this.auth.changePassword(user.id, input);
    // The old refresh cookie was just revoked; swap in the new pair.
    setAuthCookies(response, result);
    return { ok: true };
  }
```
Returns `{ ok: true }` rather than the tokens. The web doesn't need them, and change-password isn't a
login flow. If native will call it, return `result` like `login`.

### `apps/api/src/auth/auth.service.test.ts` (change)

**Before**
```ts
import { users } from "@couple-space/database";
```
**After**
```ts
import { users } from "@couple-space/database";
import { hashPassword } from "./password.js";
```
**Add a new `describe` at the end of the file:**
```ts
describe("AuthService.changePassword", () => {
  let service: AuthService;
  let storedHash: string;

  const updateSet = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const mockDatabase = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            {
              id: "u1",
              email: "a@example.com",
              emailVerified: true,
              displayName: "Ada",
              dateOfBirth: "1990-01-01",
              passwordHash: storedHash,
            },
          ]),
        })),
      })),
    })),
    update: vi.fn(() => ({ set: updateSet })),
  };

  const mockTokens = {
    issueTokenPair: vi.fn(async () => ({
      accessToken: "access-new",
      refreshToken: "refresh-new",
    })),
    revokeAllForUser: vi.fn(async () => undefined),
  };

  const mockAudit = { append: vi.fn(async () => undefined) };

  const mockEmailVerification = {
    sendVerificationEmail: vi.fn(),
    consumeToken: vi.fn(),
    consumeAndVerifyUser: vi.fn(),
    countRecentResends: vi.fn(),
  };

  beforeAll(async () => {
    storedHash = await hashPassword("OldPassword123");
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: mockDatabase },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
        { provide: EmailVerificationService, useValue: mockEmailVerification },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("rejects a wrong current password with invalid_current_password", async () => {
    const promise = service.changePassword("u1", {
      currentPassword: "WrongPassword123",
      newPassword: "NewPassword123",
    });

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({
      response: { reason: "invalid_current_password" },
    });
    expect(updateSet).not.toHaveBeenCalled();
    expect(mockTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("stores a new hash, revokes all refresh tokens, then issues a new pair", async () => {
    const result = await service.changePassword("u1", {
      currentPassword: "OldPassword123",
      newPassword: "NewPassword123",
    });

    const setArg = updateSet.mock.calls[0]?.[0] as { passwordHash: string };
    expect(setArg.passwordHash).not.toBe(storedHash);
    expect(setArg.passwordHash).not.toContain("NewPassword123");

    expect(mockTokens.revokeAllForUser).toHaveBeenCalledWith("u1");
    expect(
      mockTokens.revokeAllForUser.mock.invocationCallOrder[0],
    ).toBeLessThan(mockTokens.issueTokenPair.mock.invocationCallOrder[0]!);
    expect(result.refreshToken).toBe("refresh-new");
  });

  it("audits auth.change_password", async () => {
    await service.changePassword("u1", {
      currentPassword: "OldPassword123",
      newPassword: "NewPassword123",
    });

    expect(mockAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.change_password", entityId: "u1" }),
    );
  });
});
```
(argon2 hashing in `beforeAll` is slow-ish but real; it means `verifyPassword` doesn't need mocking.
If `password.test.ts` mocks argon2 instead, follow that.)

---

## Step 4 · Web hooks

### `apps/web/hooks/use-me.ts` (change)

**Before**
```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
```
**After**
```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { UpdateProfileInput } from "@couple-space/domain";
import { apiFetch } from "@/lib/api";
```
**Add at the end:**
```ts
/** `PATCH /me`. Writes the returned user into the `me` cache so the header updates at once. */
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) =>
      apiFetch<Me>("/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (me) => queryClient.setQueryData(ME_QUERY_KEY, me),
  });
}
```
The partner sees the new name next time their couple query refetches. No extra invalidation needed.

### `apps/web/hooks/use-auth-mutations.ts` (change)

**Before**
```ts
import type { LoginInput, RegisterInput } from "@couple-space/domain";
```
**After**
```ts
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from "@couple-space/domain";
```
**Add after `useResendVerificationMutation`:**
```ts
/**
 * `POST /auth/change-password`. Nest revokes every refresh token and sets
 * fresh cookies, so this device stays logged in and others are signed out.
 */
export function useChangePasswordMutation(
  options?: UseMutationOptions<unknown, Error, ChangePasswordInput>,
) {
  return useMutation({
    ...options,
    mutationFn: (body: ChangePasswordInput) =>
      apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
```

### `apps/web/lib/auth-errors.ts` (change) — add to `AUTH_ERROR_MESSAGES`
```ts
  invalid_current_password: "Your current password is incorrect.",
```

---

## Step 5 · Web form organisms (presentational, like `SessionAnswerForm`)

The forms take `isSubmitting`, `errorMessage` and `onSubmit` as props; the page owns the mutations. No
`useState`, `useEffect` or try/catch.

### `apps/web/components/organisms/display-name-form/display-name-form.tsx` (new)
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@couple-space/domain";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type DisplayNameFormProps = {
  defaultDisplayName: string;
  /** The mutation's `isPending`. */
  isSubmitting: boolean;
  /** True after a successful save, until the field is edited again. */
  isSaved: boolean;
  errorMessage?: string;
  onSubmit: (input: UpdateProfileInput) => void;
};

export function DisplayNameForm({
  defaultDisplayName,
  isSubmitting,
  isSaved,
  errorMessage,
  onSubmit,
}: Readonly<DisplayNameFormProps>) {
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: defaultDisplayName },
  });
  const { errors, isDirty } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        onSubmit(values);
        // Makes the saved value the new baseline so the button disables again.
        form.reset(values);
      })}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.displayName || undefined}>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            id="displayName"
            autoComplete="nickname"
            maxLength={40}
            aria-invalid={!!errors.displayName || undefined}
            {...form.register("displayName")}
          />
          <FieldDescription>Only your partner sees this.</FieldDescription>
          <FieldError>{errors.displayName?.message}</FieldError>
        </Field>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        {isSaved && !isDirty ? (
          <p role="status" className="text-sm text-muted-foreground">
            Saved.
          </p>
        ) : null}

        <Button
          type="submit"
          className="self-start"
          disabled={!isDirty || isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Save name"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```
Note: `form.reset(values)` runs before the server confirms. If the save fails, the error shows and the
field keeps the typed value. That's acceptable here; the alternative is a `useEffect` on `isSuccess`.

### `apps/web/components/organisms/change-password-form/change-password-form.tsx` (new)
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@couple-space/domain";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Web-only: the confirm field is a typing check, not a server rule.
const formSchema = changePasswordSchema.and(
  z
    .object({ newPassword: z.string(), confirmPassword: z.string() })
    .refine((v) => v.confirmPassword === v.newPassword, {
      message: "passwords don't match",
      path: ["confirmPassword"],
    }),
);

type FormValues = z.infer<typeof formSchema>;

type ChangePasswordFormProps = {
  isSubmitting: boolean;
  isSaved: boolean;
  errorMessage?: string;
  onSubmit: (input: ChangePasswordInput) => void;
};

export function ChangePasswordForm({
  isSubmitting,
  isSaved,
  errorMessage,
  onSubmit,
}: Readonly<ChangePasswordFormProps>) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors, isDirty } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(({ currentPassword, newPassword }) => {
        onSubmit({ currentPassword, newPassword });
        form.reset();
      })}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.currentPassword || undefined}>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.currentPassword || undefined}
            {...form.register("currentPassword")}
          />
          <FieldError>{errors.currentPassword?.message}</FieldError>
        </Field>

        <Field data-invalid={!!errors.newPassword || undefined}>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword || undefined}
            {...form.register("newPassword")}
          />
          <FieldDescription>
            At least 12 characters, with upper and lower case letters and a digit.
          </FieldDescription>
          <FieldError>{errors.newPassword?.message}</FieldError>
        </Field>

        <Field data-invalid={!!errors.confirmPassword || undefined}>
          <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword || undefined}
            {...form.register("confirmPassword")}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </Field>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        {isSaved && !isDirty ? (
          <p role="status" className="text-sm text-muted-foreground">
            Password changed. Your other devices have been signed out.
          </p>
        ) : null}

        <Button type="submit" className="self-start" disabled={isSubmitting}>
          {isSubmitting ? "Changing…" : "Change password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```
Why `.and(...)` and not `.extend()`: `changePasswordSchema` has a `.refine`, and in Zod 4 you can't
`.extend` a refined object. An intersection keeps both refinements.
Why the wrong-password error isn't on the field: showing it via `errorMessage` matches the register
form. Mapping it with `form.setError` would need a `useEffect` on the mutation error.

---

## Step 6 · Page + menu link

### `apps/web/app/(app)/settings/page.tsx` (new)
```tsx
"use client";

import { useMeQuery, useUpdateProfileMutation } from "@/hooks/use-me";
import { useChangePasswordMutation } from "@/hooks/use-auth-mutations";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DisplayNameForm } from "@/components/organisms/display-name-form/display-name-form";
import { ChangePasswordForm } from "@/components/organisms/change-password-form/change-password-form";
import { PageLoading } from "@/components/organisms/page-loading/page-loading";
import { ErrorState } from "@/components/molecules/error-state/error-state";

export default function SettingsPage() {
  const me = useMeQuery();
  const updateProfile = useUpdateProfileMutation();
  const changePassword = useChangePasswordMutation();

  if (me.isPending) {
    return <PageLoading message="Loading your settings..." />;
  }

  if (me.isError) {
    return (
      <main className="flex min-h-svh items-center">
        <ErrorState
          title="We couldn't load your settings"
          onRetry={() => void me.refetch()}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear to your partner.</CardDescription>
        </CardHeader>
        <CardContent>
          <DisplayNameForm
            defaultDisplayName={me.data.displayName}
            isSubmitting={updateProfile.isPending}
            isSaved={updateProfile.isSuccess}
            errorMessage={
              updateProfile.isError
                ? "We couldn't save your name. Please try again."
                : undefined
            }
            onSubmit={(input) => updateProfile.mutate(input)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs you out on your other devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm
            isSubmitting={changePassword.isPending}
            isSaved={changePassword.isSuccess}
            errorMessage={
              changePassword.isError
                ? friendlyAuthErrorMessage(changePassword.error.message)
                : undefined
            }
            onSubmit={(input) => changePassword.mutate(input)}
          />
        </CardContent>
      </Card>
    </main>
  );
}
```
Check that `card.tsx` exports `CardHeader`/`CardTitle`/`CardDescription`/`CardContent` (shadcn default).
Check whether `(app)/layout.tsx` already guards auth. If it does, the page gets that for free.

### `apps/web/components/organisms/app-header/app-header.tsx` (change)

**Before**
```tsx
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={logout.isPending}
```
**After**
```tsx
          ) : null}
          <DropdownMenuItem render={<Link href="/settings" />}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={logout.isPending}
```

---

## Verification
1. `pnpm check-types && pnpm test` (the domain + API tests above).
2. Manual run on local pg@15 with the test couple:
   - Rename in browser A → the header initial updates at once; the partner in browser B sees the new
     name after a refetch. `"   "` and 41 characters are rejected client-side; `curl PATCH /me` with
     `""` returns 400 (server-side check).
   - Log in as the same user in browsers A and C. Change the password in A → A stays logged in; C is
     logged out once its access token expires and refresh fails.
   - The old password fails at `/login` and the new one works.
   - A wrong current password shows "Your current password is incorrect."
   - `audit_events` has `user.update_profile` and `auth.change_password` rows with no content.
3. Tick P1-4 in `docs/plan/tasks/phase-1-mvp-1.md` and change `/users/me` → `/me` there.
