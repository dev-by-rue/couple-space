# Email Verification (Ethereal-local mailer) — Design

**Date:** 2026-09-18  
**Status:** Approved for planning  
**Product source of truth:** `docs/product/scope.md`  
**Related:**
- `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md` (follow-up #1: real mailer + verify link)
- `docs/architecture/decisions/adr-001-nest-owned-auth-and-formation.md`
- `docs/engineering/auth-manual-smoke.md`
- `docs/superpowers/specs/2026-09-16-auth-forms-cleanup-design.md`

## 1. Goal

Replace the temporary “auto verify in development” path with a real email-verification journey: hashed verify tokens, SMTP delivery (Ethereal in local), web check-your-email + resend, and a `/verify-email` page — while keeping flag-gated `POST /auth/dev/verify` for API smoke.

## 2. Why

- Product MVP requires **email verification + invite accept**; full couple activation needs **two verified members**.
- Slice 1 shipped with `POST /auth/dev/verify` and web register auto-calling it in development. That unblocks formation testing but is not an honest verification journey.
- Local IT constraints rule out installing Mailpit/desktop mail catchers; **browser SaaS (Ethereal)** is acceptable for local SMTP.
- Password reset is a separate Nest follow-up; it can reuse the mail port later but is **out of this deliverable**.

## 3. Decisions locked

| Topic | Choice |
|---|---|
| Next deliverable | Email verification only (not password reset; not Slice 2) |
| Both partners | Must verify (already product + domain: accept + activate) |
| Post-register UX | Check-your-email gate; cookies set; block couple/invite until verified |
| `dev/verify` | Keep flag-gated; web must **not** auto-call it |
| Resend | Yes — authenticated unverified users can resend (rate-limited) |
| Verify link landing | Web `/verify-email?token=…`; token works **without** an existing session |
| Transport | Approach 1: Nest `MailPort` + SMTP; Ethereal credentials in local env |
| Token storage | Hash only (same idea as refresh tokens) |

## 4. Scope

### In scope

- `email_verification_tokens` table + migration
- Register creates token + sends verify email; `emailVerified` stays false until link consumed
- `POST /auth/verify-email`, `POST /auth/resend-verification`
- SMTP mail adapter configured for Ethereal locally; `WEB_ORIGIN` builds the link
- Web: remove auto-`dev/verify`; check-your-email + resend; `/verify-email` page; gate couple UI when unverified
- Update auth manual smoke to document Ethereal path alongside `dev/verify`
- Audit events for verify / resend (actor + entity only; no raw tokens)

### Out of scope

- Password reset, OAuth, age-gate policy
- Production ESP account as a required dependency (document swap path only)
- Slice 2 conversation engine
- Removing `dev/verify` entirely

## 5. Architecture

```
apps/web                         apps/api (Nest)
  register ───────────────────►  create user (unverified)
                                 create verify token (hash)
                                 MailPort.send(link) ──► Ethereal (local) / future ESP
  /check-email + resend ──────►  POST /auth/resend-verification
  /verify-email?token=… ──────►  POST /auth/verify-email
                                 email_verified=true; token used;
                                 re-issue cookies/tokens (JWT must match DB)

  couple/invite UI ── if !emailVerified ──► redirect/show /check-email

  POST /auth/dev/verify (flag) ── engineers / Postman smoke only
```

- Nest remains the IdP; clients never invent verification state.
- MailPort hides provider details so Ethereal → Resend/SES is an env/adapter change.

## 6. Data model

### `email_verification_tokens`

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `user_id` | FK → users |
| `token_hash` | unique; store hash only |
| `expires_at` | timestamptz |
| `used_at` | nullable |
| `created_at` | timestamptz |

**Rules:**
- On register or resend: mark prior unused tokens for that user as used (or delete them), then insert one new token — only one active unused token per user.
- TTL from env: `EMAIL_VERIFY_TTL_HOURS` (default **24**).
- Raw token appears only in the email URL query string, never in logs or audit metadata.

## 7. API

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `POST` | `/auth/register` | public | Existing register + cookies; **also** issue verify token + send email; user remains `emailVerified: false` |
| `POST` | `/auth/verify-email` | public | Body `{ token }`. Valid unused unexpired token → set `email_verified=true`, set `used_at`, **re-issue access+refresh** (same as `dev/verify`: JWT embeds `email_verified`). Already verified → idempotent success (re-issue if session present / return ok) |
| `POST` | `/auth/resend-verification` | authenticated | If verified → success no-op. Else new token + send. Rate-limited (`EMAIL_VERIFY_RESEND_PER_HOUR`, default **5**) |
| `POST` | `/auth/dev/verify` | authenticated + `ENABLE_DEV_AUTH_ENDPOINTS` | Unchanged escape hatch |

**Verify link shape:** `{WEB_ORIGIN}/verify-email?token={rawToken}`

**Env (additions):**

```bash
WEB_ORIGIN=http://localhost:3000
EMAIL_VERIFY_TTL_HOURS=24
EMAIL_VERIFY_RESEND_PER_HOUR=5
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
# Local: Ethereal credentials from https://ethereal.email
```

## 8. Web UX

1. **Register success** → navigate to **`/check-email`** (not auto-verify). Session cookies may already be set.
2. **`/check-email`** → copy + **Resend** calling `POST /auth/resend-verification`. If `/me` already shows verified, redirect to `/couple` (or `next`).
3. **`/verify-email?token=`** → `POST /auth/verify-email` (works logged out). On success: if session cookies exist → `/couple` or `next`; else → `/login` with a short “email verified — log in” message.
4. **App / couple routes** → if `GET /me` has `emailVerified: false`, redirect to `/check-email` (block create couple / invite UI). Invite accept page aligns messaging + resend when unverified.
5. **Remove** development auto-`POST /auth/dev/verify` from `useRegisterMutation`. Optional engineer-only use of `dev/verify` stays API/smoke, not product chrome.

## 9. Errors, security & product alignment

**Errors**
- Invalid, expired, or already-used token → generic `invalid_or_expired_token` (no enumeration of user existence via verify).
- Resend when already verified → success no-op.
- Resend over limit → `429`.
- SMTP failure on register → user row still committed; client shows send failure and offers resend (do not delete the account).

**Security**
- High-entropy raw tokens; hash at rest; single-use; TTL.
- Resend requires a session (cannot spray arbitrary emails without auth).
- `ENABLE_DEV_AUTH_ENDPOINTS=false` in prod-like envs.
- No passwords or raw tokens in logs/audit.

**Product**
- Both partners must verify before the couple can fully activate (unchanged domain rules).
- Private-first: verification is relationship-link strength (email), not KYC.

## 10. Testing & success criteria

| Check | Expected |
|---|---|
| Register | User unverified; token row; Ethereal receives message with link |
| Click link | `emailVerified: true`; token `used_at` set; `/me` reflects it |
| Idempotent verify | Second submit of same token (or already verified) does not error dangerously |
| Resend | New token; old unused invalidated; rate limit enforced |
| Web register | No auto-`dev/verify` |
| Unverified couple UI | Check-email gate; cannot complete invite accept until verified |
| Smoke | `dev/verify` still works when flag on; Ethereal path documented |

**Automated:** unit tests for issue/consume/expiry/idempotency/resend limit.  
**Manual:** Ethereal click-through; Postman `dev/verify` path remains green.

## 11. Follow-ups (explicit, not this deliverable)

1. Password reset on the same `MailPort`
2. Production ESP (Resend/SES/etc.) adapter + DNS
3. Optionally retire `dev/verify` after CI has a non-interactive verify strategy
4. Slice 2 private conversation engine

## 12. Implementation readability

- Small modules: token service, mail port, auth endpoints, thin web pages.
- Comment *why* on hash-only tokens, Ethereal-as-local-transport, keeping `dev/verify`, and not rolling back register on mail failure.
- Do not invent age-gate or KYC rules.
