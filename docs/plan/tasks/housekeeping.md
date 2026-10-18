# Housekeeping · tech debt and schema fixes

[← Plan index](../README.md) · Slot these in anywhere. **H-11, H-12 and H-2 are needed for [Gate A](../02-mvp-and-release-gates.md#release-gates)**: do them while the database has no real data.

---

## Schema (do early)

- [x] **H-11 · Prompt retirement ([Q13](../03-product-decisions.md#q13), [Q14](../03-product-decisions.md#q14), [E-1](../erd/design-review.md#e-1), [E-2](../erd/design-review.md#e-2))** · S — Add `prompts.retired_at`. Filter retired prompts out of `listThemes`; `createSession` refuses a retired prompt unless the couple already has an open session on it. The seed marks a question retired with `{ text, retired: true }`. *Snapshot columns dropped (2026-10-18): prompts are never reworded, they are retired and replaced (Q13).*
- [x] **H-12 · DB `CHECK` constraints ([Q16](../03-product-decisions.md#q16), [Q20](../03-product-decisions.md#q20))** · S — `session_responses.body` ≤ 5,000 chars; `submitted_at IS NULL OR length(body) > 0`; `users.display_name` 1–40 chars. Also lowered the domain `displayName` limit from 100 to 40 to match.
- [x] **H-2 · Fix `refresh_tokens` ([E-9](../erd/design-review.md#e-9))** · S — `expires_at` is `timestamp` **without** a time zone and `user_id` is nullable. Make them `timestamptz` and `notNull`.
- [ ] **H-13 · Membership end date ([E-4](../erd/design-review.md#e-4))** · S — Add `couple_memberships.left_at`. Can ship with P1-11.
- [ ] **H-3 · Foreign-key indexes** · S — Postgres doesn't index foreign keys automatically. Add indexes on `conversation_sessions(couple_id)`, `couple_memberships(couple_id)`, `couple_invitations(couple_id)`, `prompts(theme_id)` and `refresh_tokens(user_id)`.
- [ ] **H-4 · Enforce statuses in the DB ([E-6](../erd/design-review.md#e-6))** · S — Turn the `text` status columns into Postgres enums or `CHECK` constraints that mirror the `packages/domain` status lists.

## Code

- [ ] **H-1 · Shared DTO types** · S — Move `SessionDetailDto` and `SessionListItem` into `packages/domain`. They're currently duplicated in `apps/api/.../session-detail.mapper.ts` and `apps/web/hooks/use-sessions.ts`. `prompt.kind` is hard-coded to `"curated"` in the DTO; widen it when P1-8 or P2-2 lands.
- [ ] **H-5 · One sort order** · S — `listSessions` orders by `updatedAt ASC`, and the web re-sorts anyway. Pick one place.
- [ ] **H-7 · Quote route** · S — `app/api/relationship-quote` is a Next API route, but the walking-skeleton constraints say "no Next BFF". Either document it as the one exception or move it to Nest.
- [ ] **H-9 · Consistent loading** · S — The couple hub shows raw `Loading couple…` text while other pages use `PageLoading`. Make them match.
- [ ] **H-14 · Broken lint and type-check tooling** · S — Found while verifying the Phase 0 guides (2026-10-15), all on an unmodified checkout:
  - `apps/web` ESLint crashes on every file: `eslint-plugin-react@7.37` isn't compatible with ESLint 10 (`contextOrFilename.getFilename is not a function`). Pin ESLint 9 or update the React plugin/config.
  - `apps/web` `tsc --noEmit`: `Cannot find name 'LayoutProps'` in `app/layout.tsx`. Next generates that type; run `next typegen` (or a build) first, or type the props explicitly.
  - `apps/api` `tsc --noEmit`: `supertest/types` can't be found in `test/app.e2e-spec.ts`, and there's a mock typing error in `auth.service.test.ts`.
  - Add `check-types` scripts to `apps/web` and `apps/api` so `pnpm check-types` covers them (today it only runs `domain` and `database`).
- [x] **H-15 · Failing auth test** · S — `auth.service.test.ts` › "creates user with emailVerified false and issues tokens" fails on `main` (the mocked verification email isn't sent). Most likely caused by the `SANDBOX_AUTO_VERIFY` change in `a4507ede`; make the test set the flag explicitly for both cases.
- [ ] **H-10 · Web tests** · M — Once the flows settle, add a Playwright test for the two-browser reveal flow. It's the one web test worth having.

## Docs & repo

- [ ] **H-6 · Supabase references** · S — The build brief, setup runbook and platform spec still describe Supabase. Update them to local Postgres + Railway.
- [ ] **H-8 · Prototype folder** · S — Decide what to do with `between-us-source/` (the Lovable prototype). Archive it to its own branch once the conversation page is built, to keep the repo lean.
