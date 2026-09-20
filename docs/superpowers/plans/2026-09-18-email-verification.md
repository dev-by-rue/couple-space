# Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship real email verification (hashed tokens + SMTP via Ethereal locally + web `/check-email` and `/verify-email`) and stop auto-`dev/verify` on register, while keeping flag-gated `dev/verify` for API smoke.

**Architecture:** Nest issues hashed email-verification tokens, sends links through a `MailPort` (SMTP/Ethereal), and exposes public `verify-email` plus authenticated `resend-verification`. Web gates unverified users on `/check-email`. Access JWTs embed `email_verified`, so successful verify must re-issue cookies/tokens (same as existing `devVerify`).

**Tech Stack:** NestJS, Drizzle, `nodemailer`, Zod, Vitest, Next.js `apps/web`, Ethereal SMTP for local.

## Global Constraints

- Product: both partners must verify before couple activation (`docs/product/scope.md`).
- Spec: `docs/superpowers/specs/2026-09-18-email-verification-design.md`.
- Token storage: **hash only**; raw token only in email URL.
- Web must **not** auto-call `POST /auth/dev/verify`; keep endpoint flag-gated.
- Routes: `/check-email` (waiting + resend), `/verify-email?token=` (consume).
- Verify works **without** a session; re-issue cookies when a session can be set.
- Defaults: `EMAIL_VERIFY_TTL_HOURS=24`, `EMAIL_VERIFY_RESEND_PER_HOUR=5`.
- Out of scope: password reset, OAuth, production ESP signup, Slice 2.
- **Git commits:** only when the user explicitly asks.
- Prefer TDD for token/auth service changes; comment *why* on hash tokens, JWT re-issue, mail-failure-does-not-rollback-register.

## File structure

```
packages/database/src/schema/email-verification-tokens.ts
packages/database/src/schema/index.ts
packages/database/drizzle/   # generated migration

apps/api/src/config/env.ts
apps/api/src/mail/mail.port.ts
apps/api/src/mail/smtp.mail.ts
apps/api/src/mail/mail.module.ts
apps/api/src/auth/email-verification.service.ts
apps/api/src/auth/email-verification.service.test.ts
apps/api/src/auth/dto/verify-email.schema.ts
apps/api/src/auth/auth.service.ts          # register hooks send; verifyEmail; resend
apps/api/src/auth/auth.controller.ts
apps/api/src/auth/auth.module.ts
.env.example

apps/web/hooks/use-auth-mutations.ts       # drop auto-dev-verify; add verify/resend
apps/web/app/check-email/page.tsx
apps/web/app/verify-email/page.tsx
apps/web/app/register/page.tsx             # redirect to /check-email
apps/web/app/(app)/layout.tsx              # unverified → /check-email
apps/web/app/invite/[token]/page.tsx      # unverified messaging + resend

docs/engineering/auth-manual-smoke.md
```

---

### Task 1: Schema — `email_verification_tokens`

**Files:**
- Create: `packages/database/src/schema/email-verification-tokens.ts`
- Modify: `packages/database/src/schema/index.ts`
- Generate: migration under `packages/database/drizzle/`

**Interfaces:**
- Produces: Drizzle table `emailVerificationTokens` exported from `@couple-space/database`

- [ ] **Step 1: Add schema file**

```ts
// packages/database/src/schema/email-verification-tokens.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Store only a HASH of the email-verification token.
 * Raw token lives in the email link; DB leak must not allow replay without the raw value.
 */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
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

Export from `packages/database/src/schema/index.ts`:

```ts
export * from "./email-verification-tokens.js";
```

- [ ] **Step 2: Generate and apply migration**

```bash
pnpm --filter @couple-space/database generate
pnpm --filter @couple-space/database migrate
pnpm --filter @couple-space/database build
```

Expected: new SQL migration; table exists; package builds.

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add packages/database
git commit -m "$(cat <<'EOF'
feat(database): add email_verification_tokens table

EOF
)"
```

---

### Task 2: Env + MailPort (SMTP / Ethereal)

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `.env.example`
- Create: `apps/api/src/mail/mail.port.ts`
- Create: `apps/api/src/mail/smtp.mail.ts`
- Create: `apps/api/src/mail/mail.module.ts`
- Modify: `apps/api/package.json` (add `nodemailer` + types)

**Interfaces:**
- Produces:
  - Env: `WEB_ORIGIN`, `EMAIL_VERIFY_TTL_HOURS`, `EMAIL_VERIFY_RESEND_PER_HOUR`, `SMTP_*`
  - `MailPort { sendMail(input: { to: string; subject: string; text: string; html?: string }): Promise<void> }`
  - Nest token `MAIL` providing `MailPort`

- [ ] **Step 1: Extend env**

Add to `envSchema` in `apps/api/src/config/env.ts`:

```ts
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  EMAIL_VERIFY_TTL_HOURS: z.coerce.number().positive().default(24),
  EMAIL_VERIFY_RESEND_PER_HOUR: z.coerce.number().positive().default(5),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),
```

Update `.env.example` with the same keys and a comment: local values from https://ethereal.email

- [ ] **Step 2: Install nodemailer**

```bash
pnpm --filter @couple-space/api add nodemailer
pnpm --filter @couple-space/api add -D @types/nodemailer
```

- [ ] **Step 3: Mail port + SMTP adapter**

```ts
// apps/api/src/mail/mail.port.ts
export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface MailPort {
  sendMail(input: SendMailInput): Promise<void>;
}

export const MAIL = Symbol("MAIL");
```

```ts
// apps/api/src/mail/smtp.mail.ts
import nodemailer from "nodemailer";
import { loadEnv } from "../config/env.js";
import type { MailPort, SendMailInput } from "./mail.port.js";

/**
 * SMTP transport — local Ethereal credentials in .env; swap host for a real ESP later.
 * Never log message bodies that contain verify tokens.
 */
export function createSmtpMail(): MailPort {
  const env = loadEnv();
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return {
    async sendMail(input: SendMailInput) {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    },
  };
}
```

```ts
// apps/api/src/mail/mail.module.ts
import { Global, Module } from "@nestjs/common";
import { MAIL } from "./mail.port.js";
import { createSmtpMail } from "./smtp.mail.js";

@Global()
@Module({
  providers: [{ provide: MAIL, useFactory: () => createSmtpMail() }],
  exports: [MAIL],
})
export class MailModule {}
```

Import `MailModule` in `apps/api/src/app.module.ts`.

- [ ] **Step 4: Sanity — API boots with Ethereal env**

Fill `.env` with Ethereal SMTP values. Start API; confirm no boot crash on `loadEnv()`.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api .env.example pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(api): add SMTP MailPort for email delivery

EOF
)"
```

---

### Task 3: EmailVerificationService (TDD)

**Files:**
- Create: `apps/api/src/auth/email-verification.service.ts`
- Create: `apps/api/src/auth/email-verification.service.test.ts`
- Modify: `apps/api/src/auth/auth.module.ts` (provide service)

**Interfaces:**
- Consumes: `Db`, `MailPort`, `loadEnv()`
- Produces:
  - `issueAndSend(userId: string, email: string): Promise<void>`
  - `consume(rawToken: string): Promise<{ userId: string }>` — marks verified handled by AuthService **or** consume returns userId and AuthService updates user (prefer: service marks token used + returns userId; AuthService sets verified + issues tokens)
  - Prefer single service method used by AuthService:

```ts
async sendVerificationEmail(userId: string, email: string): Promise<void>
async consumeToken(rawToken: string): Promise<{ userId: string }> // throws invalid_or_expired_token
async countRecentResends(userId: string): Promise<number>
```

- [ ] **Step 1: Failing tests**

Cases:
1. `sendVerificationEmail` inserts hashed token, marks prior unused tokens `usedAt=now()`, calls `mail.sendMail` with link containing `{WEB_ORIGIN}/verify-email?token=`
2. Does **not** pass raw token into DB `token_hash` column (hash ≠ raw)
3. `consumeToken` happy path returns `userId` and sets `usedAt`
4. Expired / unknown / already-used → throw with reason `invalid_or_expired_token`
5. Second consume of same raw token → `invalid_or_expired_token`

Use Vitest + mocked `Db` / `MailPort` following patterns in `auth.service.test.ts` / `couples.service.test.ts` (mock chain or in-memory as existing tests do).

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @couple-space/api test -- email-verification
```

- [ ] **Step 3: Implement service**

Hash helper (same as refresh tokens):

```ts
import { createHash, randomBytes } from "node:crypto";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
```

Raw token: `randomBytes(32).toString("base64url")`.  
Link: `${env.WEB_ORIGIN}/verify-email?token=${encodeURIComponent(raw)}`.  
Email subject/body: short plain text + optional simple HTML with the link.  
Comment *why* hash-only and why prior tokens are marked used.

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @couple-space/api test -- email-verification
```

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api/src/auth
git commit -m "$(cat <<'EOF'
feat(api): email verification token service

EOF
)"
```

---

### Task 4: AuthService + controller — register / verify / resend

**Files:**
- Create: `apps/api/src/auth/dto/verify-email.schema.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.test.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

**Interfaces:**
- Produces:
  - `register` → after user create, `await emailVerification.sendVerificationEmail(...)` inside try/catch: on mail failure, still return tokens/user (comment *why*)
  - `verifyEmail(rawToken, response cookies)` → consume → set `emailVerified` → `issueTokenPair` → audit `auth.verify_email`
  - `resendVerification(userId)` → if already verified return `{ ok: true, alreadyVerified: true }`; else rate-limit via count of tokens created in last hour ≥ `EMAIL_VERIFY_RESEND_PER_HOUR` → 429; else send; audit `auth.resend_verification`

- [ ] **Step 1: Zod DTO**

```ts
// apps/api/src/auth/dto/verify-email.schema.ts
import { z } from "zod";

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
```

- [ ] **Step 2: Failing AuthService tests**

1. `verifyEmail` sets verified + returns pair with `emailVerified: true`
2. Invalid token → Unauthorized/BadRequest with `invalid_or_expired_token`
3. `resendVerification` when unverified calls send
4. `resendVerification` when over rate → conflict/429 mapping
5. Register still returns user when mail send throws (mock mail reject)

- [ ] **Step 3: Implement AuthService methods + wire controller**

Controller:

```ts
@Post("verify-email")
async verifyEmail(
  @Body() body: unknown,
  @Res({ passthrough: true }) response: Response,
) {
  const { token } = verifyEmailSchema.parse(body);
  const result = await this.auth.verifyEmail(token);
  setAuthCookies(response, result);
  return result;
}

@Post("resend-verification")
@UseGuards(JwtAuthGuard)
async resendVerification(@CurrentUser() user: AuthUser) {
  return this.auth.resendVerification(user.id);
}
```

Map rate limit to Nest `HttpException` 429 `{ reason: "resend_rate_limited" }`.  
Map bad token to `UnauthorizedException` or `BadRequestException` `{ reason: "invalid_or_expired_token" }` — pick one and use consistently (recommend **400** BadRequest for bad token).

Update `dev/verify` comment: still TEMPORARY escape hatch alongside real flow.

- [ ] **Step 4: Run API tests**

```bash
pnpm --filter @couple-space/api test
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api
git commit -m "$(cat <<'EOF'
feat(api): verify-email and resend-verification endpoints

EOF
)"
```

---

### Task 5: Web — mutations, pages, gates

**Files:**
- Modify: `apps/web/hooks/use-auth-mutations.ts`
- Create: `apps/web/app/check-email/page.tsx`
- Create: `apps/web/app/verify-email/page.tsx`
- Modify: `apps/web/app/register/page.tsx` (onAuthenticated → `/check-email` or pass next)
- Modify: `apps/web/app/(app)/layout.tsx`
- Modify: `apps/web/app/invite/[token]/page.tsx`

**Interfaces:**
- Produces:
  - `useRegisterMutation` — **only** `POST /auth/register` (no `dev/verify`)
  - `useVerifyEmailMutation` — `POST /auth/verify-email` `{ token }`
  - `useResendVerificationMutation` — `POST /auth/resend-verification`
  - Register success → `/check-email` (preserve `next` query if present via `withNextQuery`)

- [ ] **Step 1: Update hooks**

Remove the development `dev/verify` block from `useRegisterMutation`. Add verify + resend mutations in the same file (keep one hooks file).

- [ ] **Step 2: `/check-email` page**

Client page:
- `GET /me` (via react-query); if verified → redirect `/couple` or `next`
- If 401 → redirect `/login`
- If unverified → message + Resend button
- Optional: show registered email from `/me`

- [ ] **Step 3: `/verify-email` page**

- Read `token` from `useSearchParams`
- On mount / button: `useVerifyEmailMutation`; on success redirect using `safeNextPath` + session
- On missing token / error: show generic invalid/expired copy + link to `/check-email` or `/login`

- [ ] **Step 4: Register redirect**

Change register `onAuthenticated` to `router.push(withNextQuery("/check-email", next))` **or** always `/check-email` and stash `next` in query: `/check-email?next=...`.

- [ ] **Step 5: App layout gate**

In `apps/web/app/(app)/layout.tsx`, after successful `/me`, if `!me.data.emailVerified` → `redirect("/check-email")`.

- [ ] **Step 6: Invite page**

When logged in but `!emailVerified`, show verify/resend UI (reuse copy) instead of only a dead-end; keep existing accept flow for verified users.

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter @couple-space/web exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit (only if user asked)**

```bash
git add apps/web
git commit -m "$(cat <<'EOF'
feat(web): check-email and verify-email flows

EOF
)"
```

---

### Task 6: Docs + manual verification

**Files:**
- Modify: `docs/engineering/auth-manual-smoke.md`

**Interfaces:** none

- [ ] **Step 1: Update smoke doc**

Add a section: optional Ethereal path (register → open Ethereal → click link → `/me` verified). Keep existing `dev/verify` steps as the default API smoke. Note web no longer auto-verifies.

- [ ] **Step 2: Manual checklist**

1. Ethereal account → fill SMTP_* in `.env`
2. Register on web → land on `/check-email` → message in Ethereal
3. Click link → verified → `/couple` (or login then couple)
4. Resend works; rate limit eventually 429
5. Unverified user hitting `/couple` → `/check-email`
6. Postman: `dev/verify` still works with flag on
7. Two-user invite E2E with both verifying via Ethereal (or one via `dev/verify`)

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add docs/engineering/auth-manual-smoke.md
git commit -m "$(cat <<'EOF'
docs: document Ethereal email verification smoke path

EOF
)"
```

---

## Plan self-review

**Spec coverage:** Tokens table; MailPort/Ethereal; register send; verify-email + JWT re-issue; resend + rate limit; remove auto-dev-verify; `/check-email` + `/verify-email`; app gate; keep `dev/verify`; smoke doc; password reset out of scope.

**Placeholders:** None intentional. Commit steps gated on user ask.

**Type consistency:** `invalid_or_expired_token`, `resend_rate_limited`, `WEB_ORIGIN` link shape, hash via sha256 like refresh tokens.
