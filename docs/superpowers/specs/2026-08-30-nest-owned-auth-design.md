# Nest-owned Auth (Replace Supabase Auth) — Design

**Date:** 2026-08-30  
**Status:** Approved for planning  
**Product source of truth:** `docs/product/scope.md`  
**Supersedes (auth portion):** Supabase Auth + Nest JWT verify in `docs/superpowers/specs/2026-08-29-couple-space-platform-design.md` and formation plan Tasks 5 & 8  
**Related plan (to be rewritten):** `docs/superpowers/plans/2026-08-29-couple-formation.md` Tasks 5 and 8  

## 1. Goal

Replace Supabase Auth with **NestJS-owned authentication** so Couple Space can run under IT constraints (no hosted Supabase Auth whitelist; no local Supabase). Preserve the formation slice contract: protected API routes resolve a trusted `AuthUser`, email verification gates invite accept / couple activation, and web (then native) can authenticate.

## 2. Why

- Hosted Supabase Auth is not usable in this environment; local Supabase is unavailable.
- Product scope requires email verification + invite accept — not a specific IdP.
- Nest already owns authorization; owning issuance keeps one identity boundary for web and a future native app.

## 3. Architecture

```
apps/web (Next.js)  --httpOnly cookies + credentials-->  apps/api (NestJS)
apps/native (later) --Bearer access / refresh JSON---->  apps/api
                                                           |
                                                           | Drizzle
                                                           v
                                                    Postgres (local now)
```

- Nest is the IdP for Slice 1: register, login, refresh, logout, dev email-verify.
- Authorization remains on Nest only; clients are never trusted for membership.
- Supabase Auth is removed from the stack. Postgres is plain Postgres (already local).
- Guard produces `AuthUser` for Tasks 6–7: `{ appUserId, email, emailVerified }` where `appUserId` = `users.id` = JWT `sub`.
- Dual transport: auth success **sets httpOnly cookies and returns tokens in JSON**; protected routes accept **access cookie or `Authorization: Bearer`**.

## 4. Decisions locked

| Topic | Choice |
|---|---|
| IdP | Nest-owned (Approach 1) |
| Email verify (Slice 1) | Dev-only `POST /auth/dev/verify` sets `email_verified=true`; real mailer later |
| Tokens | Short-lived access JWT + longer-lived refresh; refresh hashes in DB; rotate on refresh |
| Web transport | httpOnly cookies for access + refresh |
| Native transport | Same endpoints return JSON tokens; store in secure device storage; Bearer on API calls |
| Response shape | Always set cookies when possible **and** return tokens in JSON |
| User id | Drop `auth_user_id`; JWT `sub` = `users.id` |
| Registration profile | Required: email, password, `displayName`, `dateOfBirth` |

## 5. Data model

### 5.1 `users` (migrate)

- Drop `auth_user_id`
- Add `password_hash` (text, not null)
- Add `date_of_birth` (date, not null)
- Keep `email` (**unique**, not null), `email_verified`, `display_name` (required at register), timestamps
- `id` is the only identity key

### 5.2 `refresh_tokens` (new)

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `user_id` | FK → users |
| `token_hash` | unique; store hash only |
| `expires_at` | timestamptz |
| `revoked_at` | nullable |
| `created_at` | timestamptz |

Optional client metadata (`user_agent`, etc.) is out of Slice 1.

### 5.3 Deferred

- `email_verification_tokens` (or equivalent) when mailer lands
- `auth_identities` if OAuth is ever added (do not revive a single `auth_user_id` column)

### 5.4 Env (auth path)

```bash
JWT_SECRET=
ACCESS_TOKEN_TTL=   # e.g. 15m
REFRESH_TOKEN_TTL=  # e.g. 30d
COOKIE_SECURE=      # false on localhost
ENABLE_DEV_AUTH_ENDPOINTS=true  # local/dev only; must be false in prod
DATABASE_URL=
API_PORT=
CORS_ORIGIN=http://localhost:3000
```

Remove Supabase auth vars from the auth path (`SUPABASE_JWT_SECRET`, anon/publishable keys for auth). Keep documenting Postgres URL only.

## 6. API (rewritten Task 5)

### 6.1 Public auth

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/auth/register` | Body: `{ email, password, displayName, dateOfBirth }`. Create user (`email_verified=false`), hash password with **argon2id**, issue access+refresh, set cookies, return `{ user, accessToken, refreshToken }` |
| `POST` | `/auth/login` | Same token delivery on success |
| `POST` | `/auth/refresh` | Refresh from cookie **or** body `{ refreshToken }`. Rotate: revoke old hash, issue new pair, set cookies + JSON |
| `POST` | `/auth/logout` | Revoke refresh; clear cookies |
| `POST` | `/auth/dev/verify` | Only if `ENABLE_DEV_AUTH_ENDPOINTS=true`. Authenticated → set `email_verified=true`. Document replacement: mailer + verify link |

### 6.2 Protected

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/me` | Cookie or Bearer → `{ id, email, emailVerified, displayName, dateOfBirth, couple: null }` (couple filled in Task 6+) |

### 6.3 Guard

1. Read access JWT from `Authorization: Bearer` **or** access cookie  
2. Verify with `JWT_SECRET` (`jose`)  
3. Load user; attach `AuthUser`  
4. Missing/invalid → 401  

### 6.4 Cookies (web)

- Names: `cs_access`, `cs_refresh` (httpOnly)  
- `Secure` when not localhost; `SameSite=Lax`; `Path=/`  
- CORS: `credentials: true` + explicit `CORS_ORIGIN`  

### 6.5 Out of Task 5

Password reset, OAuth, real email send, full CSRF hardening beyond SameSite + allowlisted CORS (document follow-up if cross-site cookie POSTs become required).

## 7. Task 8 deltas (web)

| Was (formation plan) | Becomes |
|---|---|
| `@supabase/supabase-js` / `@supabase/ssr` | Do not add for auth |
| `lib/supabase/*`, `auth/callback` | Drop / do not create |
| Signup/login → Supabase | Forms → Nest `/auth/register` and `/auth/login`; signup includes `displayName` + `dateOfBirth` |
| Supabase session cookies | Nest httpOnly cookies; `apiFetch` uses `credentials: 'include'` (no accessToken arg for web) |
| Verify via Supabase/Inbucket | Local checklist: `POST /auth/dev/verify` (UI control or curl) |
| `NEXT_PUBLIC_SUPABASE_*` | `NEXT_PUBLIC_API_URL` |

Task 9 product flow unchanged; it depends on the same authenticated `apiFetch`.

Native clients (later): ignore cookies; persist JSON tokens; send Bearer access; call `/auth/refresh` with body refresh token.

## 8. Errors, security, audit

**Error codes (JSON where useful):** `email_taken`, validation errors, `invalid_credentials` (login — no email enumeration), `invalid_refresh`, 401 for guard, 403/404 for disabled dev verify.

**Security:** Zod password rules (min length 12 + basic complexity); argon2id; refresh rotation; logout revoke; dev endpoints off in prod; no passwords in logs/audit metadata.

**Audit actions (suggested):** `auth.register`, `auth.login`, `auth.logout`, `auth.dev_verify` — actor + entity only.

## 9. Testing

- Unit: password verify; refresh rotate/revoke; register creates profile fields; guard cookie vs Bearer  
- Manual: register → dev verify → `GET /me`; idempotent user id; refresh; logout; login using JSON tokens only (native-style)

## 10. Follow-ups (explicit, not this slice)

1. Real mailer + email verification link (replace `/auth/dev/verify`)  
2. Password reset  
3. CSRF review if cookie auth is used cross-site  
4. Age-gate policy using `date_of_birth` if product requires it  
5. Update platform design ADR: Nest Auth + Postgres (no Supabase Auth)  
6. Rewrite formation plan Tasks 5 & 8 to match this spec; Task 10 ADR text  

## 11. Success criteria

| Check | Expected |
|---|---|
| Register with full profile | User row with hash, displayName, DOB; `email_verified=false` |
| Dev verify (flag on) | `email_verified=true` |
| `GET /me` with cookie | 200 + same user id on repeat |
| `GET /me` with Bearer | 200 |
| `GET /me` without auth | 401 |
| Refresh | New tokens; old refresh rejected |
| Logout | Subsequent `/me` 401 |
| Prod-like env with dev flag off | `/auth/dev/verify` unavailable |

## 12. Scope boundary

**In:** Schema migration, Nest auth module, guard, `/me`, dual transport, Task 8 delta notes for planning, document mailer follow-up.

**Out:** Couple/invite endpoints (Tasks 6–7), real email, native app implementation, password reset, OAuth.

## 13. Implementation readability (plan + code)

The implementation plan and resulting code must be usable by **junior / less experienced developers** with little repo context.

- Plan steps include **full, copy-pasteable code** with **heavy inline comments** explaining *why* (security, cookie vs Bearer, refresh rotation, why `auth_user_id` was removed), not only *what*.
- Prefer small files and clear module boundaries so each unit can be understood alone.
- Comments in committed source should teach invariants and footguns; avoid narrating obvious syntax.
- Tests in the plan are equally commented so reviewers understand the failure mode being guarded.

## 14. Onboarding documentation (zero codebase knowledge)

Alongside (or as an early task in) the auth plan, maintain docs a newcomer can read **without opening the code**:

| Doc | Purpose |
|---|---|
| `docs/README.md` (or `docs/onboarding.md`) | Index: what Couple Space is, where to start, how docs relate |
| `docs/product/scope.md` | Authoritative product (already exists — link, do not duplicate rules) |
| `docs/product/future-roadmap.md` | Directional only; **not** approved to build (already exists — clarify in index) |
| `docs/engineering/build-brief.md` | Engineering rules; **update** to Nest-owned auth + local/self-hosted Postgres (remove Supabase Auth as current stack) |
| Platform design / this auth design / ADRs | Architecture “why”; mark Supabase Auth sections superseded |
| Short “how to run locally” | Env vars, migrate, API + web, register → dev verify → `/me` |

Future features stay in the roadmap doc with the existing policy: do not implement until promoted into `scope.md`.
