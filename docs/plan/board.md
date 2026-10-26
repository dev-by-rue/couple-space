# Board

[Scope](../product/scope.md) · [Decisions](../product/decisions.md) · [Roadmap](../product/roadmap.md) · [Guides](guides/)

The one place for **what's left, in what order, for which gate**. Product rules are in `scope.md`, the
reasons in `decisions.md`. Task IDs: `P<phase>-n` build tasks, `H-n` housekeeping, `L-n` / `M-n` legal and
business research. 🅰 = needed for Gate A.

**How guides work.** A task can have a guide in [`guides/`](guides/) with full before/after code and
tests. A guide lives only until its task merges: **then delete it** and tick the task here (git history
keeps it). Each guide's "before" code assumes the guides above it on this board are applied. Put the task
ID in commit messages (`feat(web): P1-6 hub sections`). Sizes: **S** ≈ an evening · **M** ≈ 2–3 sessions ·
**L** ≈ a week of evenings.

---

## Releases and gates

| Release | Goal | Ships to |
| --- | --- | --- |
| **MVP-1 · Private** | A real couple can complete the core loop and come back to it | Gate A, then Gate B |
| **MVP-2 · Couple-created** | Couples bring their own subjects | The same couples, wider |
| **MVP-3 · Community** | Opt-in sharing between couples, with moderation | Public launch |

- **Gate A · Family alpha:** you and your partner, then your cousin and his wife. Sandbox auto-verify and
  "message me" password reset are fine.
- **Gate B · Stranger beta:** 3–5 couples you don't know. Everything below in MVP-1, plus L-1…L-5.

---

## MVP-1 · Gate A, in order

| # | Task | Notes |
| --- | --- | --- |
| 1 | **H-16 · Web unit tests** 🅰 · S | [Guide](guides/H-16-web-unit-tests.md). Vitest for `apps/web/lib/` |
| 2 | **P1-6 · Session completion** 🅰 · M | [Guide](guides/P1-6-session-completion.md). In progress / in discussion / completed; "We talked about" ([Q1](../product/decisions.md#q1)) |
| 3 | **P1-32 · Answered prompts don't come back** 🅰 · S–M | [Guide](guides/P1-32-answered-prompts.md). 409 on restart, "Show talked about" chip ([Q25](../product/decisions.md#q25)) |
| 4 | **P1-19 · Backups** 🅰 · S | Confirm Railway Postgres backups; write the restore steps into [`deployment/railway.md`](../deployment/railway.md) |
| 5 | **P1-21 · Write more prompts** 🅰 · L, then ongoing | 10 themes, 285 questions. Top up the five at 27 to 30+ (Knowing you, Everyday moments, Gratitude, Money & home, Us lately). Content style guide before Gate B ([Q27](../product/decisions.md#q27)) |
| 6 | **P1-23a · Gate A** 🅰 | Use it for a couple of weeks; keep a friction-notes file |

## MVP-1 · Gate B

Rough order. Guides exist for most; they were written before the 2026-10-26 consolidation, so check
their "before" code against `main` when you pick one up.

| Area | Tasks |
| --- | --- |
| Account | **P1-5** Password reset · M · [guide](guides/P1-5-password-reset.md) |
| Safety & privacy | **P1-9** 18+ age gate · S · [guide](guides/P1-9-age-gate.md) · **P1-10** Real email verification · S · [guide](guides/P1-10-real-email-verification.md) · **P1-11** Leave couple + 30-day purge (with H-13) · L · [guide](guides/P1-11-leave-couple.md) · **P1-12** Account deletion · L · [guide](guides/P1-12-account-deletion.md) · **P1-13** Legal + trust pages + data export · M · [guide](guides/P1-13-legal-trust-pages.md) |
| Finding a conversation | **P1-29** Random (Q24): Pick a theme / Surprise me, preview with Start and Skip for now; `prompt_skips (user_id, prompt_id, skipped_until)`, index `conversation_sessions (couple_id, prompt_id)`; `GET /prompts/random`, `POST /prompts/:id/skip` (no reason); reuses P1-32's `answeredSessionId`; add skips to P1-13's export and both endpoints to P1-15 · L · *guide to write* · **P1-30 rest**: skip-for-now on `/start`, server-side paging, "Explored" themes · M |
| Security & ops | **P1-15** Rate limiting · S · [guide](guides/P1-15-rate-limiting.md) · **P1-16** Security headers · S · [guide](guides/P1-16-security-headers.md) · **P1-17** CI · M · [guide](guides/P1-17-ci.md) · **P1-18** Error monitoring, answers scrubbed · S · [guide](guides/P1-18-error-monitoring.md) · **P1-20** Hardening (skeletons, keyboard, focus, mobile) · M · [guide](guides/P1-20-hardening.md) |
| Launch | **P1-22** Beta environment (separate Railway env + DB, EU) · S · **P1-23b** Gate B · **P1-24** Review feedback: Q2, Q6, whether stuck conversations need the mutual archive sooner, the MVP-2 plan · S |
| Schema | **H-3** Foreign-key indexes · **H-4** Statuses enforced in the DB (E-6) · **H-13** `couple_memberships.left_at` (E-4, with P1-11) — cheapest before real data |
| Legal | **L-1** Sole trader vs limited company · **L-2** ICO fee · **L-3** ⚠️ Special category data (UK GDPR Art. 9; may add explicit consent at registration; affects Q17) · **L-4** DPIA · **L-5** Privacy policy + terms (feeds P1-13). Research, not legal advice: check official sources |

**To confirm:** whether P1-29 is needed for Gate A (P1-32 already covers what Gate A needs from Q25).

## MVP-1 · Any time before the phase ends *(proposed)*

- **H-1** Shared DTO types: `SessionListItem` / `SessionDetailDto` are typed separately in the API and the web
- **H-5** One sort order (`listSessions` sorts, the web re-sorts) · **H-7** Quote route: a Next API route despite "no BFF"; document or move · **H-9** Consistent loading on the hub
- **H-8** Archive `between-us-source/` (the prototype) to its own branch

## Next phase (moved out of MVP-1)

| Item | Where |
| --- | --- |
| Mutual archive (both agree; reasons; stuck follow-ups) — replaces the shelved P1-7 | [Q4](../product/decisions.md#q4), [roadmap](../product/roadmap.md#mutual-archive) |
| Reminders after 24 h; quiet hours setting; notification wording; which conversation has a follow-up waiting | [Q28](../product/decisions.md#q28), [roadmap](../product/roadmap.md#reminders-and-notification-polish) |
| Hub tabs, sorting by state, follow-up indicator on cards | [Roadmap](../product/roadmap.md#hub-layout-and-follow-up-indicators) |
| Keep the discussion going · New-content notice | [Roadmap](../product/roadmap.md#keep-the-discussion-going) |
| *(proposed)* **P1-14** Email nudges, main sessions only, if emails ship at all | [Guide](guides/P1-14-email-nudges.md) |
| *(proposed)* **H-10** Playwright two-browser reveal test; component tests | — |
| **M-1** Monetisation research (nothing on `users`, E-10) | — |

---

## MVP-2 · Couple-created

First promote the custom-prompt rules into `scope.md` (P2-1). Open: expiry of never-used proposals;
whether anonymous partner prompts go through accept/discard; the exact attribution rule.

- **P2-1** Scope promotion · S
- **P2-2** Custom prompt propose / accept / discard · L — `prompt_proposals` (`couple_id`, `proposed_by_user_id`, `text`, `status` pending|accepted|discarded|expired, `decided_by_user_id`, `decided_at`, `prompt_id` on accept). Cap of 3 pending per proposer (domain function, checked inside the insert transaction). Composer on a `/start` "Your own" tab; partner inbox on the hub. No instant force-start.
- **P2-3** Anonymous partner prompts on `/start` · L — couple-scoped `prompts` rows (`couple_id`, `author_user_id`) mixed into the catalogue; `author_user_id` never sent to the non-author before both reveal (API test).
- **P2-4** Generic follow-ups for custom prompts ([Q11](../product/decisions.md#q11)) · S
- **P2-7** Partner-added discussion questions ([Q21](../product/decisions.md#q21)) · M — `prompts.kind = 'partner_question'` with `couple_id`, `author_user_id`, `parent_prompt_id` = main prompt; a child session (auto-show, Q22); attributed from the start; cap of 3 open per session. No proposal step.
- **P2-5** Session history with search by theme · M · **P2-6** Saved prompts (`saved_prompts (couple_id, prompt_id)`) · S — roadmap items; only once promoted into `scope.md`.

## MVP-3 · Community

**Write the community spec first (P3-1)**; don't create tables before it. Shape so far: `community_profiles`
keyed by `couple_id` (E-11), versioned posts where every member approves each version, polymorphic
reports, moderation actions on the couple, `user_roles`.

- **P3-1** Community spec: what's shareable, the couple's public identity, consent, dual liability ([Q12](../product/decisions.md#q12)) · M
- **P3-2** Opt-in community profile (both opt in) · M · **P3-3** Joint-approval publishing (edits reset approvals; either can withdraw) · L
- **P3-4** Reporting (preset reasons) · M · **P3-5** Moderation console + enforcement (suspension blocks publishing) · L · **P3-6** Stronger identity checks before public launch

---

## Done

- **Phase 0 · core loop** (2026-10-18): `/conversation/[id]` with answering, waiting, draft autosave,
  reveal, polling, no duplicate open sessions, EU region, two-browser smoke test.
- **Housekeeping:** H-2 refresh-token types, H-6 Supabase docs removed (2026-10-26), H-11 prompt
  retirement, H-12 DB checks, H-14 lint/type-check tooling, H-15 auth test.
- **Phase 1:** P1-1 header + logout · P1-2 invite-pending hub · P1-3 error/empty copy · P1-4 settings ·
  P1-8 curated follow-ups · P1-25…P1-27 installable app + push · P1-28 catalogue at scale (migration
  `0010`) · P1-30 first slice (client-side filters + paging) · P1-31 notification events.
- **Scope updates D-1…D-4** (D-4 on 2026-10-26).
- **Shelved:** P1-7 skip/archive (Q3/Q4 overruled 2026-10-26).

## Progress log

| Date | Reached | Notes |
| --- | --- | --- |
| 2026-10-14 | Task list + ERD written | App stopped at `/conversation/[id]` |
| 2026-10-15 | Decisions Q1–Q22, E-1…E-12, owner answers O-1…O-3, release gates; Phase 0 guides | First users: owner + partner, then cousin + wife |
| 2026-10-18 | Phase 0 complete, tested by the owner and partner; H-2, H-11, H-12, H-14, H-15 | **Overrule:** Q13/E-1 snapshots dropped; retire and replace |
| 2026-10-21 | Q23: installable web app + push | No native app |
| 2026-10-25 | Q24–Q27 (random, eligibility, depth/tags, never run out) + E-13 key-based ids | One-off catalogue reset before Gate A |
| 2026-10-26 | P1-4, P1-8, P1-25…P1-28, P1-31 done; P1-30 first slice | 10 themes, 285 questions |
| 2026-10-26 | Plan review: P1-6 rewritten, H-16 and P1-32 added, Q28 | **Overrule:** Q3/Q4: no one-sided skip, archive needs both (roadmap); P1-7 shelved |
| 2026-10-26 | Docs consolidated: 84 files → `scope`, `decisions`, `roadmap`, this board, live guides | Done guides deleted (git history keeps them) |
