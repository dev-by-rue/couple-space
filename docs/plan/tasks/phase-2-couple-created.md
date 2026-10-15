# Phase 2 · MVP-2 (couple-created)

[← Plan index](../README.md) · Release: MVP-2 · Schema: [ERD MVP-2](../erd/mvp-2.md)

**Goal:** couples can bring their own subjects into the app.

Promote the anonymous-pool model into `scope.md` first (open questions 1–4 in
[`03-requirements.md`](../../extraction/03-requirements.md)).

---

- [ ] **P2-1 · Scope promotion** · S — Custom prompt lifecycle, the attribution rule, expiry of never-used proposals, and the cap of 3.
- [ ] **P2-2 · Custom prompt propose / accept / discard (T3)** · L — `prompt_proposals` table. Cap of 3 pending per proposer (domain function + test). Composer on a `/start` "Your own" tab; partner inbox on the hub.
- [ ] **P2-3 · Anonymous partner prompts on `/start` (T4)** · L — Couple-scoped prompts mixed into the catalogue without authorship. Attribution is revealed only after both reveal. API test that `author_user_id` never leaks before reveal.
- [ ] **P2-4 · Generic follow-ups for custom prompts ([Q11](../03-product-decisions.md#q11))** · S
- [ ] **P2-7 · Partner-added discussion questions ([Q21](../03-product-decisions.md#q21), [Q22](../03-product-decisions.md#q22))** · M — Inside a session both have revealed, an "Ask your own question" composer creates a child session (`prompts.kind = 'partner_question'`, with `couple_id` and `author_user_id` set and `parent_prompt_id` = the main prompt). Reuses the P1-8 child-session work, including auto-show after both submit. Cap of 3 open per session (domain function + test). Update the Guided discussion wording in `scope.md` (D-3) and retire FR-23's "directed" model.
- [ ] **P2-5 · Session history view** · M — "Past conversations" with search by theme. *Roadmap item; build only once promoted into `scope.md`.*
- [ ] **P2-6 · Save / favourite prompts** · S — `saved_prompts (couple_id, prompt_id)`. *Roadmap item; build only once promoted into `scope.md`.*
