# Phase 0 · Core loop (start here)

[← Plan index](../README.md) · Release: MVP-1 · Required for [Gate A](../02-mvp-and-release-gates.md#release-gates)

**Goal:** two people can go hub → start → answer → wait → reveal → see both answers, on Railway, in an EU region.

**Replaces:** "Consolidated plan" items 5 and 6 in the older
[walking-skeleton plan](../../superpowers/plans/2026-09-21-conversation-walking-skeleton.md).

Each task links to a **step-by-step guide** in [`phase-0/`](phase-0/). The guides give the prototype
source, ready-to-paste code adapted to `apps/web`, and a check. Tick the box here when the guide's
"Done when" is met.

**Order:** P0-10 → P0-1 → P0-2 → P0-3 → P0-5 → P0-6 → P0-7 → P0-9. P0-4 is optional; P0-8 is covered by P0-10.

---

- [ ] **P0-10 · Move Railway to an EU region** ([O-2](../04-owner-answers.md#o-2)) · S · [📘 guide](phase-0/P0-10-eu-region.md)
  - Builds: Railway settings, fresh EU Postgres
- [ ] **P0-1 · `/conversation/[id]` route shell** · S · [📘 guide](phase-0/P0-1-route-shell.md)
  - Builds: `ParseUUIDPipe`, `lib/api-error.ts`, `SessionPageSkeleton`, `SessionPromptHeader`, the page
- [ ] **P0-2 · Answering state** ([Q15](../03-product-decisions.md#q15), [Q16](../03-product-decisions.md#q16)) · M · [📘 guide](phase-0/P0-2-answering-state.md)
  - Builds: `ANSWER_MAX_LENGTH`, `SessionAnswerForm` (from the prototype's inline form)
- [ ] **P0-3 · Waiting state** · S · [📘 guide](phase-0/P0-3-waiting-state.md)
  - Builds: `AnswerCard`, `SessionWaiting` (from the prototype's `AnswerCard`, `WaitingState`)
- [ ] **P0-4 · Draft autosave** ([Q5](../03-product-decisions.md#q5)), *optional* · M · [📘 guide](phase-0/P0-4-draft-autosave.md)
  - Builds: Visibility rule change, `PUT …/draft`, `useSaveDraftMutation`, debounced form
- [ ] **P0-5 · Ready-to-reveal + revealed** · M · [📘 guide](phase-0/P0-5-reveal.md)
  - Builds: `SessionRevealButton` (new), `SessionRevealPanel` (from the prototype's `RevealPanel`)
- [ ] **P0-6 · Keep both screens fresh** ([Q6](../03-product-decisions.md#q6)) · S · [📘 guide](phase-0/P0-6-keep-fresh.md)
  - Builds: Polling only while waiting; `staleTime: 0` for session + hub
- [ ] **P0-7 · Stop duplicate sessions** · S · [📘 guide](phase-0/P0-7-duplicate-sessions.md)
  - Builds: Disabled prompt cards, `isSessionOpen` + tests, reuse the open session in `createSession`
- [ ] **P0-8 · Clean the sandbox data** · S · [📘 guide](phase-0/P0-8-clean-sandbox.md)
  - Builds: SQL, only if you keep the old DB
- [ ] **P0-9 · Two-browser smoke test** · S · [📘 guide](phase-0/P0-9-two-browser-smoke.md)
  - Builds: Checklist, saved into `conversation-api-smoke.md`

## Files Phase 0 creates or changes

```
packages/domain/src/
  answer-rules.ts                          P0-2   (new)
  session-open.ts + .test.ts               P0-7   (new)
  session-answer-visibility.ts + .test.ts  P0-4   (change)
  index.ts                                 P0-2, P0-7
apps/api/src/conversations/
  conversations.controller.ts              P0-1 (ParseUUIDPipe), P0-4 (PUT draft)
  conversations.service.ts                 P0-4 (saveDraft), P0-7 (reuse open session)
  dto/submit-response.schema.ts            P0-2
  dto/save-draft.schema.ts                 P0-4   (new)
apps/web/
  lib/api-error.ts                         P0-1   (new)
  hooks/use-sessions.ts                    P0-4, P0-6
  app/(app)/conversation/[id]/page.tsx     P0-1 → P0-2 → P0-3 → P0-5 (→ P0-4)
  app/(app)/start/[slug]/page.tsx          P0-7
  components/molecules/
    session-page-skeleton/                 P0-1
    session-prompt-header/                 P0-1
    answer-card/                           P0-3
    session-waiting/                       P0-3
    session-reveal-button/                 P0-5
  components/organisms/
    session-answer-form/                   P0-2 (→ P0-4)
    session-reveal-panel/                  P0-5
```

## Prototype components: where they end up

| Prototype (`between-us-source/src/…`) | Phase 0 | Later |
| --- | --- | --- |
| `routes/conversation.$id.tsx` → `ConversationPage` | Page in P0-1 | |
| `PageShell` | `max-w-3xl` main in P0-1 | |
| `PageSkeleton` | `SessionPageSkeleton` in P0-1 | Hub/start skeletons in P1-20 |
| Inline answer form + confirm `Dialog` | `SessionAnswerForm` in P0-2 | |
| `WaitingState` | `SessionWaiting` in P0-3 | |
| `AnswerCard` | `AnswerCard` in P0-3 | Reused by follow-ups (P1-8) |
| `RevealPanel` | `SessionRevealPanel` in P0-5 | |
| *(no Reveal button in prototype)* | `SessionRevealButton` in P0-5 | |
| `FollowUpCard` | — | [P1-8](phase-1/P1-8-follow-ups.md) |
| `Steps`, `InviteStatusCard` | — | [P1-2](phase-1/P1-2-hub-invite-pending.md) |
| `PromptComposer` | — | P2-2 |
| `DirectedQuestionCard`, `PrototypeControls` | **Never**: replaced by Q21 / dev-only | |
