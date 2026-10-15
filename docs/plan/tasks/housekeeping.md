# Housekeeping · tech debt and schema fixes

[← Plan index](../README.md) · Slot these in anywhere. **H-11, H-12 and H-2 are needed for [Gate A](../02-mvp-and-release-gates.md#release-gates)**: do them while the database has no real data.

---

## Schema (do early)

- [ ] **H-11 · Prompt snapshot + retirement ([Q13](../03-product-decisions.md#q13), [Q14](../03-product-decisions.md#q14), [E-1](../erd/design-review.md#e-1), [E-2](../erd/design-review.md#e-2))** · S — Add `conversation_sessions.prompt_title_snapshot` and `prompt_text_snapshot` (backfilled from `prompts`) and `prompts.retired_at`. Read the snapshot in `loadDetail` and `listSessions`, and filter retired prompts out of `listThemes`.
- [ ] **H-12 · DB `CHECK` constraints ([Q16](../03-product-decisions.md#q16), [Q20](../03-product-decisions.md#q20))** · S — `session_responses.body` ≤ 5,000 chars; `submitted_at IS NULL OR length(body) > 0`; `users.display_name` 1–40 chars.
- [ ] **H-2 · Fix `refresh_tokens` ([E-9](../erd/design-review.md#e-9))** · S — `expires_at` is `timestamp` **without** a time zone and `user_id` is nullable. Make them `timestamptz` and `notNull`.
- [ ] **H-13 · Membership end date ([E-4](../erd/design-review.md#e-4))** · S — Add `couple_memberships.left_at`. Can ship with P1-11.
- [ ] **H-3 · Foreign-key indexes** · S — Postgres doesn't index foreign keys automatically. Add indexes on `conversation_sessions(couple_id)`, `couple_memberships(couple_id)`, `couple_invitations(couple_id)`, `prompts(theme_id)` and `refresh_tokens(user_id)`.
- [ ] **H-4 · Enforce statuses in the DB ([E-6](../erd/design-review.md#e-6))** · S — Turn the `text` status columns into Postgres enums or `CHECK` constraints that mirror the `packages/domain` status lists.

## Code

- [ ] **H-1 · Shared DTO types** · S — Move `SessionDetailDto` and `SessionListItem` into `packages/domain`. They're currently duplicated in `apps/api/.../session-detail.mapper.ts` and `apps/web/hooks/use-sessions.ts`. `prompt.kind` is hard-coded to `"curated"` in the DTO; widen it when P1-8 or P2-2 lands.
- [ ] **H-5 · One sort order** · S — `listSessions` orders by `updatedAt ASC`, and the web re-sorts anyway. Pick one place.
- [ ] **H-7 · Quote route** · S — `app/api/relationship-quote` is a Next API route, but the walking-skeleton constraints say "no Next BFF". Either document it as the one exception or move it to Nest.
- [ ] **H-9 · Consistent loading** · S — The couple hub shows raw `Loading couple…` text while other pages use `PageLoading`. Make them match.
- [ ] **H-10 · Web tests** · M — Once the flows settle, add a Playwright test for the two-browser reveal flow. It's the one web test worth having.

## Docs & repo

- [ ] **H-6 · Supabase references** · S — The build brief, setup runbook and platform spec still describe Supabase. Update them to local Postgres + Railway.
- [ ] **H-8 · Prototype folder** · S — Decide what to do with `between-us-source/` (the Lovable prototype). Archive it to its own branch once the conversation page is built, to keep the repo lean.
