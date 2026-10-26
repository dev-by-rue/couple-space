# P1-5 · Password reset

[← Phase 1](../board.md) · Size **M** · ERD: MVP-1 · After: P1-4 · Next: [P1-9](P1-9-age-gate.md)

**Builds on P1-4:** uses `passwordSchema` (domain) and `TokenService.revokeAllForUser` (API) from that guide.

**Goal:** someone who forgot their password can request an email link, set a new password, and every
existing session is signed out.

**Done when:**

- `POST /auth/forgot-password { email }` always returns `200 { ok: true }`, whether or not the email has an account.
- `POST /auth/reset-password { token, newPassword }` sets the password, burns the token, and revokes every
  refresh token. A used, expired or unknown token → `400 { reason: "invalid_or_expired_token" }`.
- Tokens are stored only as a SHA-256 hash, live 60 minutes, and requesting a new link kills older ones.
- `/forgot-password` and `/reset-password?token=…` pages exist, and the login form links to the first.
- Domain and API tests pass.

### Deviations to flag

- **Routes live under `/auth/`** (`/auth/forgot-password`, `/auth/reset-password`), like every other auth
  route. The task text says `/forgot-password`.
- **A reset doesn't log you in.** It sends you to `/login`. Logging in from an email link makes a stolen
  inbox into a stolen session with one click; the extra step is cheap.
- **Timing:** the API only sends mail when the account exists, so the response is slightly slower for real
  emails. Acceptable for MVP-1; P1-15 rate-limits the endpoint. A fix later is to send from a queue.
- **Gate A:** per the task, a "message me" fallback is fine. This guide is the real thing.

---

## Step 1 · Database

### `packages/database/src/schema/password-reset-tokens.ts` (new, copy of `email-verification-tokens.ts`)
```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Store only a HASH of the password-reset token.
 * Raw token lives in the email link; a DB leak must not allow a reset without it.
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

### `packages/database/src/schema/index.ts` (change)
**Before**
```ts
export * from "./email-verification-tokens.js";
```
**After**
```ts
export * from "./email-verification-tokens.js";
export * from "./password-reset-tokens.js";
```

### Migration
Run `pnpm --filter @couple-space/database generate`. It's a new table, so the generated
`CREATE TABLE "password_reset_tokens"` + FK + unique constraint is already safe on a database with rows.
Read it anyway; nothing to hand-edit. (P1-12 will need `ON DELETE CASCADE` here; leave it for that task.)

---

## Step 2 · Domain schemas

### `packages/domain/src/schemas/auth-schemas.ts` (change) — add at the end
```ts
export const forgotPasswordSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```
The email rule is now written three times (login, register, forgot). Optional tidy-up: pull out
`const emailSchema = z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase());` and use it in all three.

### `packages/domain/src/schemas/auth-schemas.test.ts` (change)
Add `forgotPasswordSchema, resetPasswordSchema` to the import, then at the end:
```ts
describe("forgotPasswordSchema", () => {
  it("normalizes email", () => {
    expect(forgotPasswordSchema.parse({ email: " Pat@Example.com " }).email).toBe(
      "pat@example.com",
    );
  });

  it("rejects a non-email", () => {
    expect(() => forgotPasswordSchema.parse({ email: "pat" })).toThrow();
  });
});

describe("resetPasswordSchema", () => {
  it("requires a token", () => {
    expect(() =>
      resetPasswordSchema.parse({ token: "", newPassword: "NewPassword123" }),
    ).toThrow();
  });

  it("applies the password policy", () => {
    expect(() =>
      resetPasswordSchema.parse({ token: "t", newPassword: "short" }),
    ).toThrow();
  });
});
```

---

## Step 3 · API

### `apps/api/src/config/env.ts` (change)
**Before**
```ts
  EMAIL_VERIFY_RESEND_PER_HOUR: z.coerce.number().positive().default(5),
```
**After**
```ts
  EMAIL_VERIFY_RESEND_PER_HOUR: z.coerce.number().positive().default(5),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().positive().default(60),
```

### `apps/api/src/auth/dto/forgot-password.schema.ts` and `reset-password.schema.ts` (new)
```ts
/** Re-export shared forgot-password schema from domain. */
export {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@couple-space/domain";
```
```ts
/** Re-export shared reset-password schema from domain. Same policy as register. */
export {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@couple-space/domain";
```

### `apps/api/src/auth/password-reset.service.ts` (new, mirrors `EmailVerificationService`)
```ts
import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { passwordResetTokens, users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { MAIL, type MailPort } from "../mail/mail.port.js";
import { Env, loadEnv } from "../config/env.js";
import { InvalidOrExpiredTokenError } from "./email-verification.service.js";
import { hashPassword } from "./password.js";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

@Injectable()
export class PasswordResetService {
  private env: Env = loadEnv();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MAIL) private readonly mail: MailPort,
  ) {}

  async sendResetEmail(userId: string, email: string): Promise<void> {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + this.env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );
    const link = `${this.env.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(rawToken)}`;

    // Send first so SMTP failure leaves any prior unused link working.
    await this.mail.sendMail({
      to: email,
      subject: "Reset your Couple Space password",
      text: `Reset your password by opening this link. It expires in ${this.env.PASSWORD_RESET_TTL_MINUTES} minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
      html: `<p>Reset your password by opening this link. It expires in ${this.env.PASSWORD_RESET_TTL_MINUTES} minutes.</p><p><a href="${link}">${link}</a></p><p>If you didn't ask for this, you can ignore this email.</p>`,
    });

    // Only one live link per user.
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    await this.db.insert(passwordResetTokens).values({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });
  }

  /**
   * Validates the token, sets the new password and burns the token in one
   * transaction. Returns the user id so the caller can revoke sessions.
   */
  async consumeAndSetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ userId: string }> {
    const tokenHash = hashToken(rawToken);
    // Hash outside the transaction: argon2 is slow and shouldn't hold a row lock.
    const passwordHash = await hashPassword(newPassword);

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);

      const row = rows[0];
      if (!row || row.usedAt != null || row.expiresAt.getTime() <= Date.now()) {
        throw new InvalidOrExpiredTokenError();
      }

      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, row.userId));

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, row.id));

      return { userId: row.userId };
    });
  }
}
```
Reuses `InvalidOrExpiredTokenError` from the verification service rather than adding a second class.

### `apps/api/src/auth/auth.module.ts` (change)
**Before**
```ts
import { EmailVerificationService } from "./email-verification.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, TokenService, JwtAuthGuard],
```
**After**
```ts
import { EmailVerificationService } from "./email-verification.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { PasswordResetService } from "./password-reset.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    PasswordResetService,
    TokenService,
    JwtAuthGuard,
  ],
```

### `apps/api/src/auth/auth.service.ts` (change)
**Constructor before**
```ts
    private readonly emailVerification: EmailVerificationService,
  ) {}
```
**After**
```ts
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
  ) {}
```
Add the imports `import { PasswordResetService } from "./password-reset.service.js";`,
`import type { ForgotPasswordInput } from "./dto/forgot-password.schema.js";` and
`import type { ResetPasswordInput } from "./dto/reset-password.schema.js";`.

**Add after `changePassword` (from P1-4):**
```ts
  /**
   * Always resolves the same way so the response can't reveal which emails
   * have accounts. SMTP failures are swallowed for the same reason.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    const row = rows[0];
    if (!row) return { ok: true };

    try {
      await this.passwordReset.sendResetEmail(row.id, row.email);
    } catch {
      // Same response as success; the user can ask again.
      return { ok: true };
    }

    await this.audit.append({
      actorUserId: row.id,
      action: "auth.forgot_password",
      entityType: "user",
      entityId: row.id,
    });
    return { ok: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ ok: true }> {
    let userId: string;
    try {
      ({ userId } = await this.passwordReset.consumeAndSetPassword(
        input.token,
        input.newPassword,
      ));
    } catch (error) {
      if (error instanceof InvalidOrExpiredTokenError) {
        throw new BadRequestException({ reason: "invalid_or_expired_token" });
      }
      throw error;
    }

    // Whoever had the old password (or a stolen session) is signed out.
    await this.tokens.revokeAllForUser(userId);

    await this.audit.append({
      actorUserId: userId,
      action: "auth.reset_password",
      entityType: "user",
      entityId: userId,
    });
    return { ok: true };
  }
```

### `apps/api/src/auth/auth.controller.ts` (change)
Add the imports for `forgotPasswordSchema` and `resetPasswordSchema` next to `loginSchema`, then after
`changePassword`:
```ts
  @Post("forgot-password")
  @HttpCode(200)
  async forgotPassword(@Body() body: unknown) {
    const input = forgotPasswordSchema.parse(body);
    return this.auth.forgotPassword(input);
  }

  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = resetPasswordSchema.parse(body);
    const result = await this.auth.resetPassword(input);
    // Any cookies in this browser belong to a now-revoked session.
    clearAuthCookies(response);
    return result;
  }
```
Add `HttpCode` to the `@nestjs/common` import. `@Post` defaults to 201; the task asks for 200, and
`push.controller.ts` already sets codes with `@HttpCode`.

### `apps/api/src/auth/password-reset.service.test.ts` (new)
```ts
import { Test, TestingModule } from "@nestjs/testing";
import { createHash } from "node:crypto";
import { DB } from "../db/db.module.js";
import { MAIL } from "../mail/mail.port.js";
import { InvalidOrExpiredTokenError } from "./email-verification.service.js";
import { PasswordResetService } from "./password-reset.service.js";

function sha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

describe("PasswordResetService", () => {
  let service: PasswordResetService;
  const inserted: Array<Record<string, unknown>> = [];
  const mockMail = { sendMail: vi.fn(async () => undefined) };

  const updateWhere = vi.fn(async () => undefined);
  const mockDatabase = {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
    insert: vi.fn(() => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        inserted.push(row);
      }),
    })),
    transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    inserted.length = 0;
    process.env.DATABASE_URL ??= "postgres://password-reset-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: DB, useValue: mockDatabase },
        { provide: MAIL, useValue: mockMail },
      ],
    }).compile();
    service = module.get(PasswordResetService);
  });

  it("emails a link and stores only the hash of its token", async () => {
    await service.sendResetEmail("u1", "a@example.com");

    const text = mockMail.sendMail.mock.calls[0]![0].text as string;
    const raw = decodeURIComponent(text.match(/token=([^\s]+)/)![1]!);
    expect(inserted[0]!.tokenHash).toBe(sha256(raw));
    expect(JSON.stringify(inserted[0])).not.toContain(raw);
  });

  it("doesn't touch tokens when the email fails to send", async () => {
    mockMail.sendMail.mockRejectedValueOnce(new Error("smtp down"));

    await expect(service.sendResetEmail("u1", "a@example.com")).rejects.toThrow();
    expect(mockDatabase.update).not.toHaveBeenCalled();
    expect(mockDatabase.insert).not.toHaveBeenCalled();
  });

  function txReturning(row: Record<string, unknown> | undefined) {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => (row ? [row] : [])) })),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    };
    mockDatabase.transaction.mockImplementationOnce(async (fn) => fn(tx));
    return tx;
  }

  it.each([
    ["unknown", undefined],
    ["used", { id: "t1", userId: "u1", usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }],
    ["expired", { id: "t1", userId: "u1", usedAt: null, expiresAt: new Date(Date.now() - 1) }],
  ])("rejects a %s token", async (_label, row) => {
    txReturning(row);
    await expect(
      service.consumeAndSetPassword("raw", "NewPassword123"),
    ).rejects.toBeInstanceOf(InvalidOrExpiredTokenError);
  });

  it("sets the password and burns a live token", async () => {
    const tx = txReturning({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.consumeAndSetPassword("raw", "NewPassword123"),
    ).resolves.toEqual({ userId: "u1" });
    expect(tx.update).toHaveBeenCalledTimes(2); // users + token
  });
});
```

### `apps/api/src/auth/auth.service.test.ts` (change)
Every existing `describe` builds `AuthService` with four providers. Add
`{ provide: PasswordResetService, useValue: mockPasswordReset }` to each (or Nest can't compile the
module), with `const mockPasswordReset = { sendResetEmail: vi.fn(), consumeAndSetPassword: vi.fn() };`.
Then add:
```ts
describe("AuthService.forgotPassword / resetPassword", () => {
  let service: AuthService;
  let userRows: Array<{ id: string; email: string }> = [];

  const mockDatabase = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => userRows) })),
      })),
    })),
  };
  const mockTokens = { issueTokenPair: vi.fn(), revokeAllForUser: vi.fn(async () => undefined) };
  const mockAudit = { append: vi.fn(async () => undefined) };
  const mockPasswordReset = {
    sendResetEmail: vi.fn(async () => undefined),
    consumeAndSetPassword: vi.fn(async () => ({ userId: "u1" })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    userRows = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: mockDatabase },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
        { provide: EmailVerificationService, useValue: {} },
        { provide: PasswordResetService, useValue: mockPasswordReset },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it("returns ok and sends nothing for an unknown email", async () => {
    await expect(service.forgotPassword({ email: "x@example.com" })).resolves.toEqual({ ok: true });
    expect(mockPasswordReset.sendResetEmail).not.toHaveBeenCalled();
  });

  it("returns the same ok when the email exists", async () => {
    userRows = [{ id: "u1", email: "a@example.com" }];
    await expect(service.forgotPassword({ email: "a@example.com" })).resolves.toEqual({ ok: true });
    expect(mockPasswordReset.sendResetEmail).toHaveBeenCalledWith("u1", "a@example.com");
  });

  it("returns the same ok when SMTP fails", async () => {
    userRows = [{ id: "u1", email: "a@example.com" }];
    mockPasswordReset.sendResetEmail.mockRejectedValueOnce(new Error("smtp down"));
    await expect(service.forgotPassword({ email: "a@example.com" })).resolves.toEqual({ ok: true });
  });

  it("maps a bad token to invalid_or_expired_token", async () => {
    mockPasswordReset.consumeAndSetPassword.mockRejectedValueOnce(new InvalidOrExpiredTokenError());
    await expect(
      service.resetPassword({ token: "t", newPassword: "NewPassword123" }),
    ).rejects.toMatchObject({ response: { reason: "invalid_or_expired_token" } });
    expect(mockTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("revokes every session after a successful reset", async () => {
    await service.resetPassword({ token: "t", newPassword: "NewPassword123" });
    expect(mockTokens.revokeAllForUser).toHaveBeenCalledWith("u1");
  });
});
```

---

## Step 4 · Web

### `apps/web/hooks/use-auth-mutations.ts` (change)
Add `ForgotPasswordInput, ResetPasswordInput` to the domain type import, then:
```ts
export function useForgotPasswordMutation(
  options?: UseMutationOptions<unknown, Error, ForgotPasswordInput>,
) {
  return useMutation({
    ...options,
    mutationFn: (body: ForgotPasswordInput) =>
      apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useResetPasswordMutation(
  options?: UseMutationOptions<unknown, Error, ResetPasswordInput>,
) {
  return useMutation({
    ...options,
    mutationFn: (body: ResetPasswordInput) =>
      apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
```

### `apps/web/lib/auth-errors.ts` (change)
`invalid_or_expired_token` already maps to "This verification link has expired or is invalid." Since
reset links now use the same reason, change it to the neutral
`"This link has expired or has already been used."`.

### `apps/web/components/auth/forgot-password.form.tsx` (new, same shape as `login.form.tsx`)
```tsx
"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@couple-space/domain";
import { cn } from "@/lib/utils";
import { useForgotPasswordMutation } from "@/hooks/use-auth-mutations";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type ForgotPasswordFormProps = {
  className?: string;
};

export function ForgotPasswordForm({
  className,
}: Readonly<ForgotPasswordFormProps>) {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const forgot = useForgotPasswordMutation();

  if (forgot.isSuccess) {
    return (
      <div className={cn("flex flex-col gap-4 text-center", className)}>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground" role="status">
          If an account exists for {forgot.variables.email}, we&apos;ve sent a
          link to reset your password. It expires in an hour.
        </p>
        <Link href="/login" className="text-sm underline underline-offset-4">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={form.handleSubmit((values) => forgot.mutate(values))}
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Forgot your password?</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <Field data-invalid={!!form.formState.errors.email || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!form.formState.errors.email || undefined}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        {forgot.isError ? (
          <p className="text-sm text-destructive" role="alert">
            Something went wrong. Please try again.
          </p>
        ) : null}

        <Field>
          <Button type="submit" disabled={forgot.isPending} className="w-full">
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          <Link href="/login" className="underline underline-offset-4">
            Back to log in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
```

### `apps/web/components/auth/reset-password.form.tsx` (new)
```tsx
"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passwordSchema } from "@couple-space/domain";
import { cn } from "@/lib/utils";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import { useResetPasswordMutation } from "@/hooks/use-auth-mutations";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// The token comes from the URL, not the form; confirm is web-only.
const formSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.confirmPassword === v.newPassword, {
    message: "passwords don't match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

type ResetPasswordFormProps = {
  token: string;
  onReset: () => void;
  className?: string;
};

export function ResetPasswordForm({
  token,
  onReset,
  className,
}: Readonly<ResetPasswordFormProps>) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  const reset = useResetPasswordMutation({ onSuccess: () => onReset() });
  const { errors } = form.formState;

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={form.handleSubmit(({ newPassword }) =>
        reset.mutate({ token, newPassword }),
      )}
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="text-sm text-balance text-muted-foreground">
            You&apos;ll be signed out everywhere and can log in with the new one.
          </p>
        </div>

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

        {reset.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {friendlyAuthErrorMessage(reset.error.message)}{" "}
            <Link href="/forgot-password" className="underline underline-offset-4">
              Get a new link
            </Link>
          </p>
        ) : null}

        <Field>
          <Button type="submit" disabled={reset.isPending} className="w-full">
            {reset.isPending ? "Saving…" : "Set new password"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
```
This form owns its mutation, like `LoginForm`/`RegisterForm` do (the `components/auth/` pattern), not
like the presentational organisms in P1-4.

### `apps/web/app/forgot-password/page.tsx` (new, same layout as `login/page.tsx`)
```tsx
import { ForgotPasswordForm } from "@/components/auth/forgot-password.form";
import { Logo } from "@/components/atoms/logo/logo";

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
      <div
        className="relative hidden items-center justify-center bg-secondary/20 lg:flex"
        aria-hidden="true"
      >
        <Logo className="size-48" />
      </div>
    </div>
  );
}
```

### `apps/web/app/reset-password/page.tsx` (new)
```tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password.form";
import { Logo } from "@/components/atoms/logo/logo";

function ResetPasswordContent() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {token ? (
              <ResetPasswordForm
                token={token}
                onReset={() => router.replace("/login?reset=1")}
              />
            ) : (
              <div className="space-y-4 text-center">
                <h1 className="text-2xl font-bold">Invalid reset link</h1>
                <p className="text-sm text-muted-foreground">
                  This link is missing or incomplete.
                </p>
                <Link href="/forgot-password" className="text-sm underline underline-offset-4">
                  Get a new link
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="relative hidden items-center justify-center bg-secondary/20 lg:flex"
        aria-hidden="true"
      >
        <Logo className="size-48" />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center p-6 text-sm">
          Loading…
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
```
Both pages sit outside `(app)/`, so they're reachable logged out. If you have a logged-out allowlist
anywhere (check `(app)/layout.tsx` and any redirect logic), add both paths.

### `apps/web/components/auth/login.form.tsx` (change)
**Before**
```tsx
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        {login.isError ? (
```
**After**
```tsx
          <FieldError>{form.formState.errors.password?.message}</FieldError>
          <FieldDescription>
            <Link href="/forgot-password" className="underline underline-offset-4">
              Forgot your password?
            </Link>
          </FieldDescription>
        </Field>

        {login.isError ? (
```
Optional: in `login/page.tsx`, read `searchParams.get("reset")` and show "Password updated. Log in with
your new password." above the form.

---

## Verification
1. `pnpm check-types && pnpm test`.
2. Locally with Ethereal SMTP (`.env`): request a reset for the test user → open the link from Ethereal →
   set a new password → you land on `/login` and the new password works.
3. Request two resets → the first link now fails with "expired or already been used".
4. Use a link twice → second use fails. Change `PASSWORD_RESET_TTL_MINUTES=1`, wait, and the link fails.
5. Request a reset for `nobody@example.com` → the same "Check your email" screen; no row in
   `password_reset_tokens`.
6. Log in on a second browser first; after the reset, that browser is logged out at its next refresh.
7. `select token_hash from password_reset_tokens` shows hex hashes, never the raw token from the email.
