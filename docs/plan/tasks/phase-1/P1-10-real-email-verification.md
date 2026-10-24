# P1-10 · Real email verification

[← Phase 1](../phase-1-mvp-1.md) · Size **S** · Decision: [Q10](../../03-product-decisions.md#q10) · After: [P1-16](P1-16-security-headers.md) · Next: [P1-8](P1-8-follow-ups.md)

**Goal:** on the beta environment, real verification emails arrive through Brevo, and
`SANDBOX_AUTO_VERIFY=false`.

**Done when:**

- The API **won't start** in production if `SANDBOX_AUTO_VERIFY=false` and SMTP still has the
  placeholder defaults (today it starts and silently drops every email).
- Mail failures are logged (recipient domain and error only, never the body, because it contains the token).
- The Brevo variables are set on the beta API service (P1-22), and a new tester gets the email.

Most of this is configuration. `docs/deployment/railway.md` §3–4 already documents the Brevo variables.
The code below closes the "silently broken" gap.

### Flag: the API doesn't enforce verification on sessions

Only `(app)/layout.tsx` redirects unverified users to `/check-email`. On the API, only invitation
accept checks `email_verified`. An unverified account could call `POST /sessions` directly with curl.
Q10 doesn't say which endpoints need a verified email; that's a product rule, so I haven't added it.
If you want it, the small version is an `EmailVerifiedGuard` (reads `AuthUser.emailVerified` from the
JWT, throws `ForbiddenException({ reason: "email_unverified" })`) on `CouplesController` and
`ConversationsController`. Tell me and I'll add it here.

---

## Step 1 · Fail fast on a broken SMTP config

### `apps/api/src/config/env.ts` (change)
**Before**
```ts
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Hosts like Railway inject PORT; honour it when API_PORT isn't set.
  return envSchema.parse({
    ...source,
    API_PORT: source.API_PORT ?? source.PORT,
  });
}
```
**After**
```ts
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Hosts like Railway inject PORT; honour it when API_PORT isn't set.
  return envSchema.parse({
    ...source,
    API_PORT: source.API_PORT ?? source.PORT,
  });
}

/**
 * Startup-only check. Real verification with the placeholder SMTP defaults
 * means nobody can ever verify, and the register flow hides the failure.
 */
export function assertMailConfigured(env: Env): void {
  if (env.SANDBOX_AUTO_VERIFY) return;
  if (env.SMTP_HOST === "127.0.0.1" || env.SMTP_USER === "unused") {
    throw new Error(
      "SANDBOX_AUTO_VERIFY=false needs real SMTP_HOST/SMTP_USER/SMTP_PASS (see docs/deployment/railway.md §4)",
    );
  }
}
```
It's a separate function, not a `superRefine` on the schema, because unit tests call `loadEnv()` with
the defaults and must keep passing.

### `apps/api/src/main.ts` (change)
**Before**
```ts
import { loadEnv } from "./config/env.js";
...
  const env = loadEnv();
```
**After**
```ts
import { assertMailConfigured, loadEnv } from "./config/env.js";
...
  const env = loadEnv();
  if (process.env.NODE_ENV === "production") {
    assertMailConfigured(env);
  }
```
Check that Railway sets `NODE_ENV=production` for the API (the start script or the Railway variables).
If it doesn't, key this on `COOKIE_SECURE` instead, which is `true` on every hosted environment.

### `apps/api/src/config/env.test.ts` (new)
```ts
import { assertMailConfigured, loadEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgres://x",
  JWT_SECRET: "test-secret-at-least-32-characters-long",
};

describe("assertMailConfigured", () => {
  it("allows placeholder SMTP when auto-verify is on", () => {
    const env = loadEnv({ ...base, SANDBOX_AUTO_VERIFY: "true" });
    expect(() => assertMailConfigured(env)).not.toThrow();
  });

  it("rejects placeholder SMTP when real verification is on", () => {
    const env = loadEnv({ ...base, SANDBOX_AUTO_VERIFY: "false" });
    expect(() => assertMailConfigured(env)).toThrow(/SMTP/);
  });

  it("accepts real SMTP settings", () => {
    const env = loadEnv({
      ...base,
      SANDBOX_AUTO_VERIFY: "false",
      SMTP_HOST: "smtp-relay.brevo.com",
      SMTP_USER: "login",
      SMTP_PASS: "key",
    });
    expect(() => assertMailConfigured(env)).not.toThrow();
  });
});
```

---

## Step 2 · Log mail failures without content

Today `register` and `resendVerification` swallow SMTP errors with an empty `catch`, so a bad Brevo key
looks exactly like a working one.

### `apps/api/src/mail/smtp.mail.ts` (change)
**Before**
```ts
import nodemailer from "nodemailer";
import { loadEnv } from "../config/env.js";
```
**After**
```ts
import { Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import { loadEnv } from "../config/env.js";

const logger = new Logger("Mail");
```
**Before**
```ts
    async sendMail(input: SendMailInput) {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    },
```
**After**
```ts
    async sendMail(input: SendMailInput) {
      try {
        await transporter.sendMail({
          from: env.SMTP_FROM,
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
        });
      } catch (error) {
        // Domain + subject only: the body holds a live token, the local part is personal data.
        const domain = input.to.split("@")[1] ?? "unknown";
        logger.error(
          `send failed to *@${domain} (${input.subject}): ${(error as Error).message}`,
        );
        throw error;
      }
    },
```
It rethrows, so callers behave exactly as before. This is the only `try/catch` added. It isn't a form
submit handler, so the CLAUDE.md rule doesn't apply.

---

## Step 3 · Configuration (no code)

On the **beta** API service (created in P1-22):

```env
SANDBOX_AUTO_VERIFY=false
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<brevo SMTP login>
SMTP_PASS=<brevo SMTP key>
SMTP_FROM=<verified sender>
```

In Brevo: verify the sender address. If you send from your own domain, add Brevo's SPF and DKIM
records, or Gmail will put the mail in spam. The sandbox can keep `SANDBOX_AUTO_VERIFY=true` (Q10: fine
for Gate A).

### `docs/deployment/railway.md` (change) — add to §4 "Email"
```md
With `SANDBOX_AUTO_VERIFY=false`, the API refuses to start in production until real SMTP variables are
set. If emails don't arrive, search the api logs for `[Mail] send failed`.
```

---

## Verification
1. `pnpm --filter @couple-space/api test` (the new `env.test.ts`).
2. Locally: `NODE_ENV=production SANDBOX_AUTO_VERIFY=false` with no SMTP vars → the API exits with the
   SMTP message. With Ethereal credentials → it starts.
3. Set a wrong `SMTP_PASS` locally, register → registration still succeeds, and the log shows
   `[Mail] send failed to *@example.com (Verify your email): …` with no token in it.
4. On beta: register with a real address you own → the email arrives (check spam) → the link verifies.
