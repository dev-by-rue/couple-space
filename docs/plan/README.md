# Couple Space — the plan

**Started:** 2026-10-14 · **Based on:** `main` @ `a4507ede` · **Deployed:** Railway sandbox

This folder is the working plan for everything left to build. It replaces the older walking-skeleton
plan ([`2026-09-21-conversation-walking-skeleton.md`](../superpowers/plans/2026-09-21-conversation-walking-skeleton.md)),
which had its own numbering. From here on, use only the IDs in this folder.

Behaviour authority is still [`docs/product/scope.md`](../product/scope.md). The decisions in this folder
were made with Claude acting as **the client (product owner)**. They apply to the build unless you overrule
them, and they get copied into `scope.md` by task [D-4](03-product-decisions.md#d-4).

## Documents

| # | Document | What it's for |
| --- | --- | --- |
| 01 | [Current state](01-current-state.md) | What works, why the app stops at prompts, what isn't built |
| 02 | [MVP and release gates](02-mvp-and-release-gates.md) | MVP-1/2/3 split, Gate A (family alpha) vs Gate B (stranger beta), tasks D-1…D-3 |
| 03 | [Product decisions](03-product-decisions.md) | Q1…Q22, the rules the build follows |
| 04 | [Owner answers](04-owner-answers.md) | O-1…O-3: legal setup, data region, monetisation |
| **Tasks** | | |
| | [Phase 0: core loop](tasks/phase-0-core-loop.md) | P0-*: the `/conversation/[id]` page and getting to EU. **Start here.** |
| | [Phase 1: MVP-1](tasks/phase-1-mvp-1.md) | P1-*: follow-ups, account, safety, ops, content, launch |
| | [Phase 2: MVP-2](tasks/phase-2-couple-created.md) | P2-*: custom prompts, partner-added questions |
| | [Phase 3: MVP-3](tasks/phase-3-community.md) | P3-*: community, publishing, moderation |
| | [Housekeeping](tasks/housekeeping.md) | H-*: tech debt and schema fixes |
| | [Legal and business](tasks/legal-and-business.md) | L-*, M-*: research before strangers sign up |
| **ERD** | | |
| | [Design review](erd/design-review.md) | E-1…E-12: modelling issues and their decisions |
| | [Current schema](erd/current-schema.md) | What's in the database today (migration `0005`) |
| | [MVP-1 additions](erd/mvp-1.md) | Follow-ups as child sessions, snapshots, archive, password reset |
| | [MVP-2 additions](erd/mvp-2.md) | Custom prompts, proposals, saved prompts |
| | [MVP-3 sketch](erd/mvp-3.md) | Community tables (don't build until P3-1) |

## ID legend

| Prefix | Meaning | Lives in |
| --- | --- | --- |
| `P0-n` … `P3-n` | Build task, by phase | `tasks/phase-*.md` |
| `H-n` | Housekeeping / tech debt | [`tasks/housekeeping.md`](tasks/housekeeping.md) |
| `L-n`, `M-n` | Legal / monetisation research | [`tasks/legal-and-business.md`](tasks/legal-and-business.md) |
| `D-n` | Update `scope.md` | [02](02-mvp-and-release-gates.md), [03](03-product-decisions.md#d-4) |
| `Qn` | Product decision | [`03-product-decisions.md#qn`](03-product-decisions.md) |
| `O-n` | Owner answer | [`04-owner-answers.md`](04-owner-answers.md) |
| `E-n` | ERD design issue | [`erd/design-review.md#e-n`](erd/design-review.md) |
| `FR-n`, `NFR-n`, `T0`…`T6` | Older requirement / ticket IDs | [`docs/extraction/`](../extraction/03-requirements.md) |

## How to use this

1. Work through the order below. Inside a phase file, tasks are ordered too.
2. Tick `- [ ]` boxes in the phase files as you go. Put the task ID in commit messages (`feat(web): P0-2 answer form`).
3. Sizes: **S** ≈ an evening · **M** ≈ 2–3 sessions · **L** ≈ a week of evenings.
4. When you finish a session, add a line to the progress log below.
5. If you overrule a decision (Q, E, gate), edit it where it lives and log the change here.

## Order at a glance

```
P0-10 (EU region: first, while the data is throwaway; also does P0-8)
P0-1 → P0-2 → P0-3 → P0-5 → P0-6 → P0-7 → P0-9        ← you can demo the full loop here
H-11 → H-12 → H-2                                     ← schema fixes while the DB has no real data
   D-1…D-4 (scope decisions, an evening of writing)
P1-1 → P1-3 → P1-8 (follow-ups) → P1-6 → P1-19 → P1-21 → P1-23a   ← Gate A: family alpha
P1-7
P1-15 → P1-16 → P1-17 → P1-18                         ← ops, before strangers touch it
P1-5 → P1-9 → P1-10 → P1-11 → P1-12 → P1-13
L-1…L-5 (legal research, in parallel with the code)
P1-2 → P1-20 → P1-22 → P1-23b → P1-24                  ← Gate B: private beta
Phase 2 → Phase 3
```

## Progress log

| Date | Reached | Notes |
| --- | --- | --- |
| 2026-10-14 | Task list + ERD written | App stops at `/conversation/[id]` (route missing) |
| 2026-10-15 | Client decisions Q1–Q20 + ERD review E-1…E-12 added | Owner-only questions O-1…O-3 open |
| 2026-10-15 | Q1 revised (new "In discussion" state); Q21 + P2-7 partner-added questions | Gap found by owner |
| 2026-10-15 | Q22: follow-ups keep blind answering but auto-show (no Reveal tap) | Instant visibility on submit considered and rejected |
| 2026-10-15 | Owner answered O-1…O-3; release gates, P0-10 EU region, L-1…L-5, M-1 | First users: owner + partner, then cousin + wife |
| 2026-10-15 | Split the single `docs/product/task-list.md` into this folder | Fixed stale text from before Q22 in ERD MVP-1 and the MVP table |
