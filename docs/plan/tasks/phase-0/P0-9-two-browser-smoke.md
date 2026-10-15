# P0-9 · Two-browser smoke test

[← Phase 0](../phase-0-core-loop.md) · Size **S** · Depends on: P0-1…P0-7 (P0-4 optional) · Closes Phase 0

**Goal:** prove the whole loop works for two real people, locally and on Railway, and write the steps down
so you can rerun them after every big change.

**Done when:** every box below is ticked locally **and** on Railway (EU), and the checklist is saved in
`docs/engineering/conversation-api-smoke.md`.

---

## Setup

- **Local:** `pnpm dev`. Use the active test couple from the
  [walking-skeleton plan](../../../superpowers/plans/2026-09-21-conversation-walking-skeleton.md)
  ("Local dev": you + `partner@test.local`).
- **Railway:** two accounts you registered after P0-10.
- Browser **A** = a normal window. Browser **B** = a private/incognito window, or a different browser.
- Open dev tools → Network in both. You'll check `GET /sessions/:id` responses.

## Checklist

### The main loop

- [ ] A: `/couple` → Start → pick a theme → pick a prompt → lands on `/conversation/<id>` (not a 404).
- [ ] A: submit is disabled when empty; the confirm dialog's "Keep writing" keeps the text.
- [ ] A: submit → waiting screen with "Waiting on B" and A's own answer.
- [ ] B: `/couple` shows the card as "Your turn / Answer privately". Network: A's `text` is `null`.
- [ ] B: opens it and sees "A has answered", with no time and no text.
- [ ] B: submits → B sees the **Reveal** button and no answer text.
- [ ] A: within about 20 s (or on tab focus) the waiting screen changes to the **Reveal** button. Network: B's `text` is `null`.
- [ ] A: Reveal → both answers, A's first.
- [ ] B: still only sees the Reveal button. Network: A's `text` is still `null` for B.
- [ ] B: Reveal → both answers.
- [ ] Both: hub cards say "View answers".

### Edges

- [ ] `/conversation/nonsense` and a random UUID → "Conversation not found".
- [ ] Double-click a prompt → one session only.
- [ ] Pick the same prompt while it's open → same session id.
- [ ] Pick it again after both revealed → new session id.
- [ ] Offline submit → error shown, text kept.
- [ ] (If P0-4 done) half an answer → reload → draft restored. B's network shows `text: null`.
- [ ] Reduce motion on → reveal doesn't animate.
- [ ] Phone width (375px): readable, no horizontal scroll.

## Steps

1. Run the checklist locally and fix anything that fails.
2. Deploy to Railway and run it again.
3. Copy the checklist into a new **"Web smoke (two browsers)"** section at the end of
   `docs/engineering/conversation-api-smoke.md`.
4. In the walking-skeleton plan's "Consolidated plan", tick items **5** and **6**.
5. Tick P0-1…P0-10 in [Phase 0](../phase-0-core-loop.md) and add a line to the [progress log](../../README.md#progress-log).

🎉 This is the first point where you and your partner can actually use the app.
