# Auth Forms Cleanup (Login / Register) — Design

**Date:** 2026-09-16  
**Status:** Approved for planning  
**Product source of truth:** `docs/product/scope.md`  
**Related:**
- `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`
- `docs/superpowers/plans/2026-08-31-slice-1-remaining.md` (Task 1 web auth UI)
- `docs/superpowers/specs/2026-08-31-web-brand-palette-design.md`
- `docs/architecture/decisions/adr-001-nest-owned-auth-and-formation.md`

## 1. Goal

Clean up the mid-refactor login and register UI so Nest-backed auth works through branded form components: React Hook Form, shared Zod schemas, React Query mutations, and a single signup route — without adding out-of-slice features (password reset, OAuth, real mailer).

## 2. Why

- `/signup` still has the working Nest submit path; `/login` and `/register` use shadcn template shells that do not submit, with wrong copy, dead `#` links, and OAuth / forgot-password UI that Slice 1 explicitly deferred.
- Register must collect `displayName` and `dateOfBirth` (Nest auth design); the current `RegisterForm` does not.
- Duplicate routes and commented-out page code make the first slice hard to finish and easy to regress before the next feature.

## 3. Decisions locked

| Topic | Choice |
|---|---|
| Cleanup shape | Wire + strip (Approach 1): Nest submit into new shell; remove template junk |
| Form library | React Hook Form + Zod resolver |
| Mutations | React Query `useMutation`, kept (not replaced) |
| Mutation location | One file: `apps/web/hooks/use-auth-mutations.ts` exporting `useLoginMutation` and `useRegisterMutation` |
| Validation | Same rules as API; schemas live in `@couple-space/domain` |
| Signup URL | `/register` is canonical; delete `/signup`; update all links/redirects |
| Dev email verify | Keep temporary auto `POST /auth/dev/verify` after register in development |
| Transport | Unchanged: `apiFetch` + httpOnly cookies (`credentials: 'include'`) |

## 4. Scope

### In scope

- Move `loginSchema` / `registerSchema` into `@couple-space/domain` (add `zod` dependency); Nest DTOs become thin importers/parsers
- Web deps: `react-hook-form`, `@hookform/resolvers`; Zod via `@couple-space/domain` (add a direct web `zod` dep only if the resolver toolchain requires it)
- `use-auth-mutations.ts` with login + register mutations; register chains `dev/verify` when `NODE_ENV === "development"` (TEMPORARY comment; mailer replaces later)
- `LoginForm` / `RegisterForm`: RHF fields, correct copy/links, field + form-level errors, disable submit while pending; accept an `onAuthenticated` callback (and `next` only for cross-links via `withNextQuery`)
- Thin `/login` and `/register` pages: existing two-column shell, Suspense, read `next` with `safeNextPath`, pass `onAuthenticated={() => router.push(next)}` into the form
- Delete `apps/web/app/signup/`; point home, invite unauth redirect, and cross-links at `/register`
- Remove commented-out dead code and template elements: “Or continue with”, forgot-password, wrong CTAs

### Out of scope

- Password reset, OAuth / social login, real email verification UX
- Age-gate policy beyond collecting `dateOfBirth`
- Marketing/landing redesign beyond making the auth shell functional and correctly linked
- Claiming full Slice 1 DoD (manual smoke + invite E2E checklist) unless run separately

## 5. Architecture

```
@couple-space/domain          loginSchema / registerSchema
        ↑                           ↑
   apps/api DTOs              apps/web RHF resolvers
                                    ↑
                         use-auth-mutations.ts
                                    ↑
                         LoginForm / RegisterForm
                                    ↑
                         /login  /register  pages
```

- Forms own field state, client validation, and calling the mutation.
- Hooks own Nest calls and React Query state (callers may pass `onSuccess` / `onError`).
- Pages own layout shell and post-success navigation: resolve `next` with `safeNextPath`, pass `onAuthenticated` into the form.

## 6. Components & files

| Path | Role |
|---|---|
| `packages/domain/src/` (auth schemas) | Shared Zod + inferred types |
| `apps/api/src/auth/dto/login.schema.ts` | Import/parse domain login schema |
| `apps/api/src/auth/dto/register.schema.ts` | Import/parse domain register schema |
| `apps/web/hooks/use-auth-mutations.ts` | `useLoginMutation`, `useRegisterMutation` |
| `apps/web/components/auth/login.form.tsx` | RHF login UI |
| `apps/web/components/auth/register.form.tsx` | RHF register UI (`email`, `password`, `displayName`, `dateOfBirth`) |
| `apps/web/app/login/page.tsx` | Shell + `LoginForm` |
| `apps/web/app/register/page.tsx` | Shell + `RegisterForm` |
| `apps/web/app/signup/` | **Deleted** |
| `apps/web/app/page.tsx`, `invite/[token]/page.tsx` | `/signup` → `/register` |

Existing `lib/api.ts` and `lib/auth-redirect.ts` stay as the HTTP and redirect helpers.

## 7. Data flow

1. Submit → RHF validates with domain schema.
2. Valid → mutation calls `apiFetch` (`POST /auth/login` or `POST /auth/register`).
3. Register (development only) → `POST /auth/dev/verify` after successful register.
4. Success → mutation `onSuccess` → page `onAuthenticated` → `router.push(next)` where `next` was already sanitized with `safeNextPath`.
5. Failure → form-level message from thrown API error; login remains non-enumerating when the API returns `invalid_credentials`.

## 8. Errors, security & product alignment

- Client: per-field Zod errors (password min 12 + complexity, DOB `YYYY-MM-DD`, required profile fields).
- Server: surface API failure text at form level; no change to Nest error semantics.
- Pending mutation disables the primary button (no double-submit).
- No access tokens in `localStorage`.
- Private-first Slice 1: email + password only; no social continue paths.

## 9. Slice 1 gaps (not closed by this cleanup)

Before starting the next product feature, these remain outside this design’s success criteria but are still open on the Slice 1 remaining plan / DoD:

- Manual auth smoke (`docs/engineering/auth-manual-smoke.md`)
- Task 4 web E2E invite checklist (A creates couple → invites B → B accepts → active)
- Real mailer replacing `/auth/dev/verify`
- Optional brand-palette spot-check on auth surfaces (tokens may already be present; polish is separate)

## 10. Verification (this cleanup)

- Typecheck `@couple-space/domain`, `@couple-space/api`, and `@couple-space/web` after the schema move
- Manual: `/register` → cookies set → verified in dev → lands on `next` or default app path
- Manual: `/login` round-trip; `/signup` gone; unauthenticated invite redirect uses `/register?next=...`
- Cross-links between login and register preserve `next`

## 11. Success criteria

| Check | Expected |
|---|---|
| Register fields | email, password, displayName, dateOfBirth; matches API |
| Shared schemas | One Zod source in domain; Nest + web consume it |
| Mutations | Both live in `use-auth-mutations.ts` |
| Routes | Only `/register` for signup; `/signup` removed |
| Template junk | No OAuth separator, forgot-password, or `#` CTAs |
| Dev verify | Still auto after register in development only |
| Dead code | Commented-out page blocks removed |

## 12. Implementation readability

- Prefer small units with clear ownership (schema / hook / form / page).
- Comment *why* on cookie transport, `dev/verify` temporary path, and shared schema boundary — not obvious JSX.
- Do not invent product rules (e.g. age gate); keep collecting DOB as registration profile only.
