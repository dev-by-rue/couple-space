# Phase 0 · Core loop (start here)

[← Plan index](../README.md) · Release: MVP-1 · Required for [Gate A](../02-mvp-and-release-gates.md#release-gates)

**Goal:** two people can go hub → start → answer → wait → reveal → see both answers, on Railway, in an EU region.

**Replaces:** "Consolidated plan" item 5 (`/conversation/[id]`, four viewer states) and item 6 (two-browser
smoke) in the older [walking-skeleton plan](../../superpowers/plans/2026-09-21-conversation-walking-skeleton.md).
That plan's copy text and reveal table are still useful references.

**Order:** P0-10 → P0-1 → P0-2 → P0-3 → P0-5 → P0-6 → P0-7 → P0-9 (P0-4 is optional; P0-8 is covered by P0-10).

---

- [ ] **P0-10 · Move Railway to an EU region ([O-2](../04-owner-answers.md#o-2))** · S
  - Set the region for `Postgres`, `api` and `web` to an EU region in Railway service settings. Check Railway's docs for how region changes work for a database with a volume.
  - Simplest path while the data is test-only: create a fresh Postgres in the EU region, point `api` at it and redeploy. Migrations and the seed run on pre-deploy. This also clears the orphan sessions (P0-8).
  - Record the region in `docs/deployment/railway.md`.

- [ ] **P0-1 · `/conversation/[id]` route shell** · S
  - Create `apps/web/app/(app)/conversation/[id]/page.tsx` (`"use client"`, read the id with `useParams()`; see the Next 16 note in `apps/web/AGENTS.md`).
  - Use `useSessionQuery(id)`. Loading → `PageLoading`; 404/403 → `RedirectTo` back to `/couple`.
  - Header: prompt title and text, plus a "← Back to conversations" link.
  - Switch on `data.phase` to render one of the four state components (P0-2, P0-3, P0-5).
  - ✅ Done when: clicking a prompt lands on a real page showing the prompt.

- [ ] **P0-2 · Answering state** · M
  - Organism `answer-form`: textarea (`components/ui/textarea`), a note that the answer can't be changed after submitting, Submit → confirm `Dialog` → `useSubmitResponseMutation`.
  - 1–5,000 characters ([Q16](../03-product-decisions.md#q16)).
  - Disable while pending; show mutation errors (`already_submitted` → refetch).
  - Partner status line: "{partner} has answered" if `partnerSubmitted` (FR-14). No timestamp ([Q15](../03-product-decisions.md#q15)).
  - ✅ Done when: submit works and the page flips to the waiting state without a reload.

- [ ] **P0-3 · Waiting state** · S
  - Molecule `waiting-state` with the copy from the walking-skeleton plan; show your own submitted answer.
  - `aria-live="polite"` region (NFR-01).

- [ ] **P0-4 · Draft autosave ([Q5](../03-product-decisions.md#q5))** · M · *optional for Phase 0, can slide to Phase 1*
  - API: `PUT /sessions/:id/responses/draft` (rejects if already submitted; returns only the viewer's own draft).
  - Domain test: a draft is never visible to the partner. It isn't today, because `text` is redacted until reveal, but add an explicit test.
  - Web: debounced save with a "Saved" hint; prefill the textarea from the viewer's own `responses[].text`.
  - ⚠️ Check that `canViewerSeeAnswerText` returns the viewer's **own** unsubmitted body, or the prefill will be empty.

- [ ] **P0-5 · Ready-to-reveal and revealed states** · M
  - `ready_to_reveal`: one **Reveal** button (not "reveal together") and no answer text → `useRevealSessionMutation`.
  - `revealed`: two `answer-card`s (yours first, then your partner's) with display names.
  - Respect `prefers-reduced-motion` if you add a reveal animation.

- [ ] **P0-6 · Keep both screens fresh ([Q6](../03-product-decisions.md#q6))** · S
  - `useSessionQuery`: `refetchOnWindowFocus: true`, plus `refetchInterval` (e.g. 20 s) **only while** the phase is `waiting_for_partner`.
  - Hub list: refetch on focus.

- [ ] **P0-7 · Stop duplicate sessions from `/start/[slug]`** · S
  - Pass `disabled={createSession.isPending}` to every `PromptCard`; show an error if create fails.
  - 🟢 Client decision: a couple can't have two *open* sessions on the same prompt. If one exists (not completed per [Q1](../03-product-decisions.md#q1), not archived), `POST /sessions` returns it instead of creating a new one (200 with the existing `id`). Starting the same prompt again *after* completing it is allowed.

- [ ] **P0-8 · Clean the sandbox data** · S
  - Delete the orphan sessions created while the page 404'd. **Covered by P0-10** if you create a fresh EU database.

- [ ] **P0-9 · Two-browser smoke, local then Railway** · S
  - Follow the reveal table in the walking-skeleton plan with a normal window and a private window.
  - Add a "web" section to `docs/engineering/conversation-api-smoke.md`.
  - Tick items 5 and 6 in the walking-skeleton plan's "Consolidated plan" so that older doc doesn't look unfinished.
