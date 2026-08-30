# Manual smoke test — Nest-owned auth

**Audience:** product, QA, junior engineers, and backend reviewers.  
**Purpose:** Prove the API identity path works **without** Supabase Auth and **without** the Next.js UI.  
**Design:** `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`  
**Plan:** `docs/superpowers/plans/2026-08-30-nest-owned-auth.md`

---

## 1. Who this is for

| Stakeholder | What you need from this doc |
|---|---|
| **Product / PM** | Confirm registration profile + email-verification gate exist; note that “verify email” is still a **dev shortcut**, not real mail |
| **QA** | Pass/fail checklist and exact expected HTTP status codes |
| **Junior engineer** | Copy-paste commands; what “good” looks like |
| **Backend / security** | Cookie vs Bearer dual transport; refresh rotation; when `/auth/dev/verify` must stay off |

If you only need the business outcome: *a new user can register, mark themselves verified (dev only), and load their profile twice with the same id; unauthenticated access is blocked.*

---

## 2. What you are proving

| # | Behaviour | Why it matters |
|---|---|---|
| 1 | Register creates a user with `emailVerified: false` | Product requires verification before couple activation later |
| 2 | Profile includes `displayName` + `dateOfBirth` | Slice 1 registration is a real profile bootstrap |
| 3 | Dev verify sets `emailVerified: true` | Stands in for “clicked email link” until a mailer exists |
| 4 | `GET /me` works with **browser cookies** | Next.js web path |
| 5 | `GET /me` works with **Bearer token** | Future native app path |
| 6 | Same user `id` on every successful `/me` | Idempotent identity (no duplicate users per login) |
| 7 | No auth → `401` | Guard is enforced |
| 8 | Refresh issues new tokens; old refresh fails | Stolen refresh window is limited |
| 9 | Logout → `/me` fails | Session can be ended |
| 10 | With `ENABLE_DEV_AUTH_ENDPOINTS=false`, verify is forbidden | Dev endpoint cannot ship “on” in prod-like envs |

**Out of scope for this smoke:** couple create/invite, Next.js pages, real email delivery.

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
```

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
| **Dev verify** | Temporary `POST /auth/dev/verify` — **not** production email verification |

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

### 5.3 Dev-verify email (temporary)

```bash
curl -s -b /tmp/cs.jar -X POST http://localhost:8080/auth/dev/verify | tee /tmp/cs-verify.json
```

**Pass:** `emailVerified` is `true` in the JSON body.

**Product note:** In production this step will be “user clicked link in email.” Do not treat `/auth/dev/verify` as a shipped feature.

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

**Slice smoke is green** when all applicable rows are ✓.

---

## 9. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| API will not start | Missing `JWT_SECRET` / `DATABASE_URL` | Fix root `.env`; secret ≥ 32 chars |
| `database unreachable` on `/health/db` | Postgres down or bad URL | Check `DATABASE_URL`; run migrations |
| `email_taken` | Email already registered | Use a new email or delete the row |
| Validation error on register | Password &lt; 12 chars or missing upper/lower/digit; bad DOB | Use `CorrectHorse1!` and `YYYY-MM-DD` |
| `/auth/dev/verify` 403 | Flag off or not authenticated | Set `ENABLE_DEV_AUTH_ENDPOINTS=true`; send cookies/Bearer |
| `/me` 401 with jar | Cookies not saved / wrong port | Confirm `-c`/`-b` and `API_PORT` |
| Bearer `/me` 401 | Expired access token | Refresh or login again |

---

## 10. Related reading

- Product rules (verification, couples): `docs/product/scope.md`
- Auth architecture decisions: `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-30-nest-owned-auth.md`
- Env template: `.env.example`

---

## 11. Follow-ups (do not confuse with this smoke)

- Real mailer + verify link (replaces `/auth/dev/verify`)
- Next.js login/signup UI smoke (formation web task)
- Couple create / invite / activate (later formation tasks)
