# P1-8 checklist · `feat/phase-1-step-8` → `main`

Everything to do before the next push to `main`, in order. Each guide has the exact before/after code.
Reviewed against the branch at `5131c2d9`.

Guides: [P1-8](P1-8-follow-ups.md) · [P1-28 catalogue](P1-28-catalogue-at-scale.md) ·
[P1-31 notification events](P1-31-notification-events.md)

The guides were checked against this branch: with the A fixes applied, P1-28 and P1-8 Step 2 type-check,
the catalogue tests pass (9), `generate` gives one migration, and `migrate` + `seed` against Postgres 16
removed old sessions, seeded `6 themes, 54 prompts, 6 tags` (re-runnable), accepted a key-less MVP-2-style
prompt and rejected a key-less curated one.

---

## 0 · Plan fixes (docs only) ✅ done

- [x] Renumber **notification events** from P1-28 to **P1-31** (two guides shared the P1-28 id)
- [x] P1-28 catalogue: `key` and `depth` **nullable**, with a check that requires both only for
      `curated` / `follow_up` prompts (so MVP-2 custom and partner-added prompts can be inserted)
- [x] P1-28 catalogue: "before" code now assumes P1-8 Step 1; one combined migration
- [x] P1-8 Step 5: a question with no follow-ups shows only the "take it offline" card (Q27)
- [x] P1-8: "no push for follow-ups" now points at P1-31 Part B
- [x] P1-29: "answered" only looks at main sessions (`parent_session_id IS NULL`)

## A · P1-8 Step 1: Database ✅ done, one fix needed

- [x] `prompts.parentPromptId`
- [x] `conversationSessions.parentSessionId` + unique index
- [x] `clear-sessions.ts` deletes children first
- [x] `catalogue.seed.ts`: `parentPromptId` in the upsert
- [x] **Fix the typo:** `uuid("parent_prmopt_id")` → `uuid("parent_prompt_id")` in `prompts.ts`.
      As it stands, `seed` fails: the upsert refers to `excluded.parent_prompt_id`, which doesn't exist.
- [x] **Delete migration `0010_even_flatman`:** the `.sql` file, `meta/0010_snapshot.json`, and its
      entry in `meta/_journal.json`. It's never been deployed, so deleting it is safe. It's regenerated
      in B, together with P1-28's changes, as a single migration.
- [x] If you ran `migrate` locally: reset your local database (drop and recreate it, then `migrate`),
      because it has the misspelled column and drizzle has recorded `0010` as applied
- [x] (nit) `import { type AnyPgColumn, … }` as in the guide, since it's only used as a type

## B · P1-28: Catalogue at scale (includes the one-off reset)

**Schema**

- [ ] `prompts.ts`: replace with the guide's "after" (`key`, `depth`, two checks)
- [ ] `prompt-tags.ts` (new) and the export in `schema/index.ts`
- [ ] `generate` → **one** `0010` migration for P1-8 Step 1 and P1-28. Add the reset `DELETE`s to
      the top, then read the rest: 2 `CREATE TABLE`s, 4 nullable `ADD COLUMN`s (`key`,
      `parent_prompt_id`, `depth`, `parent_session_id`), FKs, indexes, `prompts_key_unique` and 2 checks

**Catalogue files**

- [ ] Delete `seed/catalogue.data.ts`. Keep it open first: your follow-up copy moves into C
- [ ] `seed/catalogue/ids.ts`, `tags.ts`, `types.ts`, `index.ts`
- [ ] `seed/catalogue/themes/*.ts` (6 files; review the draft titles, keys, depths, tags)
- [ ] `catalogue.seed.ts`: new imports, `key` + `depth` in the upsert, tags + links
      (`parentPromptId` is already there from your earlier Step 2)

**Tests**

- [ ] `packages/database`: `test` script, `vitest` dev dependency, `vitest.config.ts`, `pnpm install`
- [ ] `seed/catalogue/catalogue.test.ts`
- [ ] `migrate` + `seed` locally → `seeded 6 themes, 18 prompts, 6 tags`; tests and `pnpm check-types` pass

## C · P1-8 Step 2: Follow-ups (new version)

You already wrote follow-up copy into the old positional `catalogue.data.ts`. Move it into the theme
files rather than redoing it.

- [ ] `types.ts` `followUps?`, `ids.ts` `followUpId`, `index.ts` `promptRows` with follow-ups
      (the seed's `parentPromptId` line is already done)
- [ ] `catalogue.test.ts`: follow-ups point at a curated prompt; no empty follow-ups
- [ ] Copy your 18 `followUps` arrays into the theme files
- [ ] `seed` → `seeded 6 themes, 54 prompts, 6 tags`; tests pass

## D · P1-8 Step 3: Domain

- [ ] `session-answer-visibility.ts` (`isFollowUp`), `session-viewer-phase.ts` (no `ready_to_reveal` for children)
- [ ] `follow-ups-unlocked.ts` (new) + export
- [ ] Tests for all three

## E · P1-8 Step 4: API

- [ ] `dto/start-follow-up.schema.ts` (new), `session-detail.mapper.ts` (replace)
- [ ] `conversations.service.ts`: `startFollowUp`, `loadFollowUps`, `GET /sessions` excludes children,
      child reveal → `follow_up_has_no_reveal`, no push for child answers
- [ ] `conversations.controller.ts`: `POST /sessions/:id/follow-ups`
- [ ] Tests: mapper cases, `startFollowUp`

## F · P1-8 Step 5: Web

- [ ] `hooks/use-sessions.ts`: `FollowUp`, `useStartFollowUpMutation`, polling while a follow-up waits
- [ ] `take-it-offline.tsx`, `follow-up-card.tsx`, `follow-up-list.tsx` (with the empty-list fix)
- [ ] `conversation/[id]/page.tsx`: render `FollowUpList` once revealed

## G · Optional in this push: P1-31 notification events

Its guide says to do Part B with P1-8, and it replaces P1-8's "no push for children" line. Skip this
section if you'd rather keep this push to P1-8 only.

- [ ] Part A (core loop): `notificationsForSessionEvent`, `PushService.notifySessionEvent`, tests
- [ ] Part B (follow-ups): follow-up events, tests

## H · Verification (both test-couple browsers)

- [ ] Reveal in A only → no follow-ups in A
- [ ] Reveal in B → follow-ups in both
- [ ] A answers follow-up 1 → A waits; B sees the form straight away
- [ ] B answers → both see both answers, **no reveal button**
- [ ] Both tap "Answer this" on follow-up 2 at once → one child row
- [ ] Hub lists only main sessions
- [ ] `POST /sessions/<childId>/reveal` → 400 `follow_up_has_no_reveal`
- [ ] `POST /sessions/<mainId>/follow-ups` before both revealed → 403 `follow_ups_locked`

## I · Before pushing to `main`

- [ ] `pnpm check-types && pnpm lint && pnpm test`
- [ ] Merge `feat/phase-1-step-8` to `main`
- [ ] The deploy runs `migrate`: the reset runs **once** and deletes all sessions, then `seed` runs.
      Warn your test partner that their conversations will be gone.
- [ ] On the sandbox: `/start` shows the new catalogue; a full conversation plus a follow-up works
- [ ] Tick P1-8 and P1-28 in `phase-1-mvp-1.md`, and add a progress-log row
