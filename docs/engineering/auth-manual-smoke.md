# Manual smoke test — Nest-owned auth

**Audience:** product, QA, junior engineers, and backend reviewers.  
**Purpose:** Prove the API identity path works **without** Supabase Auth; default path is curl/Postman, with an optional Ethereal + web click-through for real email verification.  
**Design:** `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`  
**Email verification:** `docs/superpowers/specs/2026-09-18-email-verification-design.md`  
**Plan:** `docs/superpowers/plans/2026-08-30-nest-owned-auth.md`

---

## 1. Who this is for

| Stakeholder | What you need from this doc |
|---|---|
| **Product / PM** | Confirm registration profile + email-verification gate exist; web register lands on `/check-email` and does **not** auto-verify |
| **QA** | Pass/fail checklist and exact expected HTTP status codes; optional Ethereal path for end-to-end mail |
| **Junior engineer** | Copy-paste commands; what “good” looks like |
| **Backend / security** | Cookie vs Bearer dual transport; refresh rotation; when `/auth/dev/verify` must stay off |

If you only need the business outcome: *a new user can register, verify email (via Ethereal link or dev shortcut), and load their profile twice with the same id; unauthenticated access is blocked; unverified users cannot reach couple UI.*

---

## 2. What you are proving

| # | Behaviour | Why it matters |
|---|---|---|
| 1 | Register creates a user with `emailVerified: false` | Product requires verification before couple activation later |
| 2 | Profile includes `displayName` + `dateOfBirth` | Slice 1 registration is a real profile bootstrap |
| 3 | Dev verify sets `emailVerified: true` | API smoke shortcut when `ENABLE_DEV_AUTH_ENDPOINTS=true`; production path is `POST /auth/verify-email` |
| 3b | Register sends verify email (when SMTP configured) | Real journey: Ethereal inbox → click link → `/verify-email` |
| 4 | `GET /me` works with **browser cookies** | Next.js web path |
| 5 | `GET /me` works with **Bearer token** | Future native app path |
| 6 | Same user `id` on every successful `/me` | Idempotent identity (no duplicate users per login) |
| 7 | No auth → `401` | Guard is enforced |
| 8 | Refresh issues new tokens; old refresh fails | Stolen refresh window is limited |
| 9 | Logout → `/me` fails | Session can be ended |
| 10 | With `ENABLE_DEV_AUTH_ENDPOINTS=false`, verify is forbidden | Dev endpoint cannot ship “on” in prod-like envs |

**Out of scope for this smoke:** couple create/invite E2E (see optional checklist in section 12), password reset, production ESP setup.

**Web note:** The Next.js register flow no longer auto-calls `POST /auth/dev/verify` in development. Engineers use Ethereal (section 10) or the curl `dev/verify` path below (section 5).

---

## 3. Prerequisites

1. Local Postgres reachable; migrations applied (`users`, `refresh_tokens`, etc.).
2. Root `.env` populated (see `.env.example`). Minimum for this test:

```bash
DATABASE_URL=postgresql://...
API_PORT=8080
JWT_SECRET=<at-least-32-random-characters>
COOKIE_SECURE=false
ENABLE_DEV_AUTH_ENDPOINTS=true
CORS_ORIGIN=http://localhost:3000
WEB_ORIGIN=http://localhost:3000
```

For the **optional Ethereal path** (section 10), also set SMTP credentials from [ethereal.email](https://ethereal.email) (create account → copy host/user/pass):

```bash
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<from ethereal.email>
SMTP_PASS=<from ethereal.email>
SMTP_FROM="Couple Space <noreply@example.com>"
```

Do not commit real credentials. Use `.env` locally only.

3. API running from the monorepo root:

```bash
pnpm --filter @couple-space/api dev
```

4. Tools: `curl`, and optionally `node` (to pull `accessToken` from JSON).  
   Base URL below assumes `http://localhost:8080`. Change the port if your `API_PORT` differs.

---

## 4. Quick glossary

| Term | Meaning |
|---|---|
| **Access token** | Short-lived JWT proving who you are (`sub` = user id) |
| **Refresh token** | Longer-lived opaque secret used to get a new access token |
| **Cookie jar** | File (`/tmp/cs.jar`) where `curl` stores `cs_access` / `cs_refresh` httpOnly cookies (simulates a browser) |
| **Bearer** | `Authorization: Bearer <accessToken>` header (simulates a native app) |
| **Dev verify** | Flag-gated `POST /auth/dev/verify` — API/Postman smoke only; web must not auto-call it |
| **Verify email** | `POST /auth/verify-email` with `{ "token": "..." }` — public; re-issues cookies/JWT |
| **Resend** | `POST /auth/resend-verification` — authenticated; rate-limited (`EMAIL_VERIFY_RESEND_PER_HOUR`, default 5) |
| **Ethereal** | Free browser SMTP inbox for local dev; messages appear at ethereal.email, not a real mailbox |

---

## 5. Step-by-step (happy path)

Use a unique email each run (or delete the user row) so register does not return `email_taken`.

### 5.1 Health (optional sanity)

```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8080/health/db
```

**Pass:** JSON including `"ok": true` (and DB health reports db reachable).

### 5.2 Register

```bash
curl -s -c /tmp/cs.jar -H 'Content-Type: application/json' \
  -d '{
    "email": "smoke.ada@example.com",
    "password": "CorrectHorse1!",
    "displayName": "Ada",
    "dateOfBirth": "1990-01-01"
  }' \
  http://localhost:8080/auth/register | tee /tmp/cs-register.json
```

**Pass (product / QA):**

- HTTP 201 or 200 with a `user` object
- `user.emailVerified` is `false`
- `user.displayName` is `"Ada"`
- `user.dateOfBirth` is `"1990-01-01"`
- Response includes `accessToken` and `refreshToken` (for native-style clients)
- Cookie jar file was created (`/tmp/cs.jar`)

**Fail examples:** validation error (weak password / bad DOB format); `email_taken` if email already exists.

### 5.3 Dev-verify email (default API smoke shortcut)

```bash
curl -s -b /tmp/cs.jar -X POST http://localhost:8080/auth/dev/verify | tee /tmp/cs-verify.json
```

**Pass:** `emailVerified` is `true` in the JSON body.

**Product note:** This is an engineer escape hatch when `ENABLE_DEV_AUTH_ENDPOINTS=true`. The shipped verification path is the email link consumed by `POST /auth/verify-email` (see section 10). Do not treat `/auth/dev/verify` as a user-facing feature.

### 5.4 Load profile — cookie (web path)

```bash
curl -s -b /tmp/cs.jar http://localhost:8080/me | tee /tmp/cs-me-cookie.json
```

**Pass:**

- HTTP 200
- Same `id` as in `/tmp/cs-register.json` → `user.id`
- `emailVerified` is `true`
- `couple` is `null` (couple APIs are a later slice)

Repeat the same command once more — **id must not change**.

### 5.5 Load profile — Bearer (native path)

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/cs-register.json','utf8')).accessToken)")

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/me | tee /tmp/cs-me-bearer.json
```

**Pass:** HTTP 200; same user `id` as cookie path.

> If access token TTL is very short and you waited, re-login or refresh first (section 6).

### 5.6 Reject unauthenticated access

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/me
```

**Pass:** prints `401` (no cookies, no Bearer).

---

## 6. Session lifecycle (refresh + logout)

### 6.1 Refresh (cookie)

```bash
curl -s -b /tmp/cs.jar -c /tmp/cs.jar -X POST \
  -H 'Content-Type: application/json' \
  -d '{}' \
  http://localhost:8080/auth/refresh | tee /tmp/cs-refresh.json
```

**Pass:** new `accessToken` / `refreshToken` in body; cookie jar updated.

### 6.2 Old refresh rejected (rotation)

Capture the **previous** refresh token from `/tmp/cs-register.json` (or an earlier refresh response), then:

```bash
OLD_REFRESH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/cs-register.json','utf8')).refreshToken)")

curl -s -o /dev/null -w "%{http_code}\n" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$OLD_REFRESH\"}" \
  http://localhost:8080/auth/refresh
```

**Pass:** non-2xx (typically `401` / `403`) after that refresh was already rotated.

### 6.3 Logout

```bash
curl -s -b /tmp/cs.jar -c /tmp/cs.jar -X POST \
  -H 'Content-Type: application/json' \
  -d '{}' \
  http://localhost:8080/auth/logout

curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/cs.jar http://localhost:8080/me
```

**Pass:** logout returns `{ "ok": true }`; following `/me` with the old jar is `401`.

### 6.4 Login again (optional)

```bash
curl -s -c /tmp/cs.jar -H 'Content-Type: application/json' \
  -d '{"email":"smoke.ada@example.com","password":"CorrectHorse1!"}' \
  http://localhost:8080/auth/login | tee /tmp/cs-login.json

curl -s -b /tmp/cs.jar http://localhost:8080/me
```

**Pass:** same user `id` as original register; `emailVerified` still `true`.

---

## 7. Dev endpoint must stay gated (security / QA)

Restart or run with:

```bash
ENABLE_DEV_AUTH_ENDPOINTS=false
```

(or omit it — default is `false` in code). Register/login to get cookies, then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/cs.jar -X POST \
  http://localhost:8080/auth/dev/verify
```

**Pass:** not success — typically `403` with reason `dev_auth_disabled`.

**Stakeholder rule:** shared/staging/production configs must keep this flag `false`.

---

## 8. Pass / fail scorecard (copy for QA)

| Check | Result (✓ / ✗) | Notes |
|---|---|---|
| Register profile + `emailVerified: false` | | |
| Dev verify → `emailVerified: true` | | Only when flag on |
| `/me` via cookies | | Same id twice |
| `/me` via Bearer | | Same id |
| `/me` without auth → 401 | | |
| Refresh works | | |
| Rotated refresh rejected | | |
| Logout then `/me` → 401 | | |
| Dev verify blocked when flag off | | |
| *(Optional)* Ethereal mail after register | | Section 10 |
| *(Optional)* Web link → `/verify-email` → verified | | Section 10 |
| *(Optional)* Resend + 429 rate limit | | Section 10.4 |
| *(Optional)* Unverified `/couple` → `/check-email` | | Section 10.5 |

**Slice smoke is green** when all applicable rows are ✓ (optional rows when SMTP + web are running).

---

## 9. Optional — verify via API token (no dev shortcut)

When SMTP is configured, register (section 5.2) sends a message to Ethereal. You can also verify without opening the web UI:

1. Open the Ethereal inbox for your SMTP user and copy the `token` query param from the verify link.
2. Call:

```bash
curl -s -c /tmp/cs-verify-email.jar -H 'Content-Type: application/json' \
  -d '{"token":"<paste-raw-token>"}' \
  http://localhost:8080/auth/verify-email | tee /tmp/cs-verify-email.json
```

**Pass:** `user.emailVerified` is `true`; response includes fresh `accessToken` / `refreshToken`; cookies set in jar.

3. Confirm profile:

```bash
curl -s -b /tmp/cs-verify-email.jar http://localhost:8080/me
```

**Fail examples:** `400` with `invalid_or_expired_token` (bad, expired, or reused token).

---

## 10. Optional — Ethereal + web click-through

Use this when you want the full product journey (register → inbox → link → couple UI). Requires SMTP env vars (section 3) and both API + web running:

```bash
pnpm --filter @couple-space/api dev
pnpm --filter @couple-space/web dev
```

### 10.1 Register on web

1. Open `http://localhost:3000/register`.
2. Submit a new account (unique email).
3. **Pass:** browser navigates to `/check-email` (not `/couple`). Web does **not** auto-call `/auth/dev/verify`.

### 10.2 Open Ethereal and click the link

1. Log in at [ethereal.email](https://ethereal.email) with the same SMTP account credentials.
2. Open the newest “Verify your email” message.
3. Click the link (`http://localhost:3000/verify-email?token=…`).

**Pass:** page shows success; redirects to `/couple` (or login if session cookies were cleared).

### 10.3 Confirm verified state

- `GET /me` (browser session or curl with jar) shows `emailVerified: true`.
- Navigating to `/couple` loads couple UI instead of redirecting to `/check-email`.

### 10.4 Resend + rate limit

From `/check-email` (or invite page while unverified), click **Resend verification email**.

**Pass:** new message in Ethereal; prior unused token invalidated.

Repeat resend until limit exceeded (default 5/hour):

**Pass:** HTTP `429` with `resend_rate_limited`.

### 10.5 Unverified gate

Register a second user, do **not** click the link, then visit `/couple`.

**Pass:** redirect to `/check-email`.

---

## 11. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| API will not start | Missing `JWT_SECRET` / `DATABASE_URL` | Fix root `.env`; secret ≥ 32 chars |
| `database unreachable` on `/health/db` | Postgres down or bad URL | Check `DATABASE_URL`; run migrations |
| `email_taken` | Email already registered | Use a new email or delete the row |
| Validation error on register | Password &lt; 12 chars or missing upper/lower/digit; bad DOB | Use `CorrectHorse1!` and `YYYY-MM-DD` |
| `/auth/dev/verify` 403 | Flag off or not authenticated | Set `ENABLE_DEV_AUTH_ENDPOINTS=true`; send cookies/Bearer |
| No email in Ethereal | SMTP_* missing or wrong | Create account at ethereal.email; fill `.env`; restart API |
| Register OK but no mail | SMTP failure (non-fatal) | User row still created; use resend from `/check-email` after fixing SMTP |
| `/auth/verify-email` 400 | Token expired, reused, or typo | Request new link via resend |
| `/auth/resend-verification` 429 | Rate limit hit | Wait; default `EMAIL_VERIFY_RESEND_PER_HOUR=5` |
| `/me` 401 with jar | Cookies not saved / wrong port | Confirm `-c`/`-b` and `API_PORT` |
| Bearer `/me` 401 | Expired access token | Refresh or login again |
| Web stuck on `/check-email` | User still unverified | Click Ethereal link or call `dev/verify` (API smoke only) |

---

## 12. Extended checklist — two-user invite (optional)

After both users can verify (Ethereal or one via `dev/verify`):

1. User A registers + verifies → creates couple / sends invite.
2. User B registers via invite link → lands on `/check-email` or invite page with resend.
3. User B verifies → accepts invite → both reach `/couple`.

This extends beyond the default API smoke; run when formation flows are in scope.

---

## 13. Related reading

- Product rules (verification, couples): `docs/product/scope.md`
- Auth architecture decisions: `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`
- Email verification design: `docs/superpowers/specs/2026-09-18-email-verification-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-30-nest-owned-auth.md`
- Env template: `.env.example`

---

## 14. Follow-ups (do not confuse with this smoke)

- Production ESP adapter (Resend/SES) replacing Ethereal
- Password reset on the same `MailPort`
- Optionally retire `dev/verify` once CI has a non-interactive verify strategy
- Slice 2 conversation engine
