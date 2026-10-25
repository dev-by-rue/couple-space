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

## B · P1-28: Catalogue at scale (includes the one-off reset) ✅ code done, local migrate + seed outstanding

**Schema**

- [x] `prompts.ts`: replace with the guide's "after" (`key`, `depth`, two checks)
- [x] `prompt-tags.ts` (new) and the export in `schema/index.ts`
- [x] `generate` → **one** `0010` migration for P1-8 Step 1 and P1-28. Add the reset `DELETE`s to
      the top, then read the rest: 2 `CREATE TABLE`s, 4 nullable `ADD COLUMN`s (`key`,
      `parent_prompt_id`, `depth`, `parent_session_id`), FKs, indexes, `prompts_key_unique` and 2 checks

**Catalogue files**

- [x] Delete `seed/catalogue.data.ts`. Keep it open first: your follow-up copy moves into C
- [x] `seed/catalogue/ids.ts`, `tags.ts`, `types.ts`, `index.ts`
- [x] `seed/catalogue/themes/*.ts` (6 files; review the draft titles, keys, depths, tags)
- [x] `catalogue.seed.ts`: new imports, `key` + `depth` in the upsert, tags + links
      (`parentPromptId` is already there from your earlier Step 2)

**Tests**

- [x] `packages/database`: `test` script, `vitest` dev dependency, `vitest.config.ts`, `pnpm install`
- [x] `seed/catalogue/catalogue.test.ts`
- [x] Tests and `pnpm check-types` pass (local `migrate` + `seed` is in C, with the final counts)

## C · P1-8 Step 2: Follow-ups and content ✅ code done, local seed outstanding

You already wrote follow-up copy into the old positional `catalogue.data.ts`. Move it into the theme
files rather than redoing it.

- [x] `types.ts` `followUps?`, `ids.ts` `followUpId`, `index.ts` `promptRows` with follow-ups
      (the seed's `parentPromptId` line is already done)
- [x] `catalogue.test.ts`: follow-ups point at a curated prompt; no empty follow-ups
- [x] Copy your 18 `followUps` arrays into the theme files
- [x] Original 6 themes expanded to 27–30 questions; 4 new themes (Your kind of care, Little traditions,
      Say it softly, No explaining needed)
- [x] New themes registered in `seed/catalogue/index.ts`; their icons (`feather`, `fingerprint`,
      `heart-handshake`) added to `THEME_ICONS` (Little traditions keeps `calendar-heart`)
- [ ] Locally: `migrate` (runs the reset) + `seed` → `seeded 10 themes, 797 prompts, 6 tags`

## D · P1-8 Step 3: Domain ✅ done

- [x] `session-answer-visibility.ts` (`isFollowUp`), `session-viewer-phase.ts` (no `ready_to_reveal` for children)
- [x] `follow-ups-unlocked.ts` (new) + export
- [x] Tests for all three

## E · P1-8 Step 4: API ✅ done

- [x] `dto/start-follow-up.schema.ts` (new), `session-detail.mapper.ts` (replace)
- [x] `conversations.service.ts`: `startFollowUp`, `loadFollowUps`, `GET /sessions` excludes children,
      child reveal → `follow_up_has_no_reveal`, no push for child answers
- [x] `conversations.controller.ts`: `POST /sessions/:id/follow-ups`
- [x] Tests: mapper cases, `startFollowUp`

## F · P1-8 Step 5: Web ✅ done

- [x] `hooks/use-sessions.ts`: `FollowUp`, `useStartFollowUpMutation`, polling while a follow-up waits
- [x] `take-it-offline.tsx`, `follow-up-card.tsx`, `follow-up-list.tsx` (with the empty-list fix)
- [x] `conversation/[id]/page.tsx`: render `FollowUpList` once revealed

## G · P1-31 notification events ✅ done (back in this push)

- [x] Part A (core loop): `notificationsForSessionEvent`, `PushService.notifySessionEvent`, tests
- [x] Part B (follow-ups): follow-up events on the parent's tag, tests; replaces P1-8's "no push for children"
- [x] `sw.js`: `renotify` when a tag is set

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
- [ ] Tick P1-8 and P1-28 in `phase-1-mvp-1.md`, and add a progress-log row (P1-21: 10 themes, 285 questions)
