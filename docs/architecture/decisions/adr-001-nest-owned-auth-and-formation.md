# ADR-001: Nest-owned auth and couple formation

**Date:** 2026-08-31  
**Status:** Accepted  
**Product:** `docs/product/scope.md`  
**Designs:** `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`, platform design (auth portion superseded)

## Context

Slice 1 needs user registration, email verification gate, partner invitation, and couple activation. The original platform design assumed Supabase Auth + Nest JWT verification. Hosted Supabase Auth was not usable under IT constraints, and local Supabase was unavailable.

## Decision

1. **NestJS owns authentication** — register/login, argon2id passwords, access JWT + refresh token hashes in Postgres, dual transport (httpOnly cookies for web + JSON/Bearer for future native).
2. **Postgres via Drizzle** (`@couple-space/database`) — not tied to Supabase Auth; local or self-hosted Postgres is fine.
3. **Authorization stays on Nest** — couple/invite rules and membership checks are server-side; domain helpers in `@couple-space/domain` encode accept/activate invariants.
4. **Email verification** — product still requires verified email for activation; Slice 1 uses `POST /auth/dev/verify` behind `ENABLE_DEV_AUTH_ENDPOINTS` until a mailer ships.
5. **Web** — Next.js calls the API with `credentials: 'include'` (`apiFetch`) and React Query for caching/mutations; no Supabase client libraries for auth.

## Consequences

- Formation Tasks 5 & 8 in the original couple-formation plan are superseded.
- Future OAuth should use an `auth_identities`-style table, not revive `auth_user_id`.
- Production must keep `ENABLE_DEV_AUTH_ENDPOINTS=false`.
- CSRF hardening may be revisited if cookie auth is used cross-site beyond SameSite=Lax + allowlisted CORS.
