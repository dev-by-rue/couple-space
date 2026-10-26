# Phase 1 · Close-out

[← Plan index](../README.md) · [Phase 1 task list](phase-1-mvp-1.md) · Written 2026-10-26

**Why:** the owner wants to finish everything outstanding in this phase, get as close to MVP as possible,
and then start a cleaner, more organised phase. This page lists every open item with a call: **keep** in
Phase 1 (and for which gate), or **moved** to the next phase. Anything not listed here is done.

Calls marked *(proposed)* are my suggestion and still yours to confirm.

---

## Keep · Gate A (family alpha)

In order. When these are done, P1-23a can start.

| # | Task | State |
| --- | --- | --- |
| 1 | **H-16** Web unit tests | [Guide](phase-1/H-16-web-unit-tests.md) |
| 2 | **P1-6** Session completion | [Guide](phase-1/P1-6-session-completion.md) |
| 3 | **P1-32** Answered prompts don't come back | [Guide](phase-1/P1-32-answered-prompts.md) |
| 4 | **P1-19** Backups | Confirm Railway backups, write restore steps |
| 5 | **P1-21** Write more prompts | 10 themes, 285 questions. Top up the five themes at 27 to 30+ (Knowing you, Everyday moments, Gratitude, Money & home, Us lately), then keep writing alongside |
| 6 | **P1-23a** Gate A | You two, then your cousin and his wife. Keep a friction-notes file |

P1-8 (follow-ups), P1-28 (catalogue), P1-25…P1-27 and P1-31 (install + push) are done.

## Keep · Gate B (couples you don't know)

| Area | Tasks |
| --- | --- |
| Account | P1-5 Password reset (P1-4 Settings is done) |
| Safety, privacy, legal | P1-9 Age gate · P1-10 Real email verification · P1-11 Leave couple (with H-13) · P1-12 Account deletion · P1-13 Legal + trust pages + export |
| Finding a conversation | P1-29 Random (guide to write) · P1-30 the rest (skip for now on `/start`, server-side paging, "Explored") |
| Security & ops | P1-15 Rate limiting · P1-16 Security headers · P1-17 CI · P1-18 Error monitoring · P1-20 Hardening |
| Launch | P1-22 Beta environment · P1-23b Gate B · P1-24 Review feedback |
| Schema housekeeping | H-3 Foreign-key indexes · H-4 Statuses enforced in the DB · H-13 Membership end date (with P1-11). Cheapest before there's real data |
| Docs | **D-4** Copy Q1–Q28 into `scope.md`. Needed: `scope.md` still describes one-sided skip and archive (Q3/Q4), which are now overruled |
| Legal research | L-1 … L-5 (in parallel with the code; P1-13's wording depends on them) |

**To confirm:** whether P1-29 (Random) is needed for Gate A. The plan still says "Gate A or B". P1-32 already
covers the part of Q25 that Gate A needs.

## Keep · any time before the phase ends *(proposed)*

Small, self-contained, and they make the next phase cleaner:

- H-1 Shared DTO types (`SessionListItem` and `SessionDetailDto` are typed separately in the API and the web; P1-6 adds `status` to the web's copy)
- H-5 One sort order · H-7 Quote route · H-9 Consistent loading
- H-6 Supabase references · H-8 Prototype folder

## Moved to the next phase

| Item | Where it's written down |
| --- | --- |
| ~~P1-7 Skip / archive~~ → **mutual archive** (both agree; reasons; stuck follow-ups) | [Q4](../03-product-decisions.md#q4), [roadmap](../../product/future-roadmap.md#mutual-archive) |
| **Reminders** after 24 h, once each, random wording | [Q28](../03-product-decisions.md#q28), [roadmap](../../product/future-roadmap.md#reminders-and-notification-polish) |
| Quiet hours as a user setting | Same roadmap entry |
| Notification wording variations; showing which conversation has a follow-up waiting | Same roadmap entry |
| Hub tabs, sorting by state, follow-up indicator on cards | [Roadmap](../../product/future-roadmap.md#hub-layout-and-follow-up-indicators) |
| "Keep the discussion going" | [Roadmap](../../product/future-roadmap.md#keep-the-discussion-going) |
| New-content notice on the dashboard | [Roadmap](../../product/future-roadmap.md#new-content-notice) |
| *(proposed)* **P1-14** Email nudges | You're not sure emails ship at all, and push covers Gate A. Main sessions only if they do |
| *(proposed)* **H-10** Playwright two-browser test and component tests | Once the hub layout settles |
| M-1 Business models research | Doesn't block MVP-1 |

---

## Housekeeping after this review (done 2026-10-26)

For the record, the plan changes made with this page: Q1/Q3/Q4/Q24/Q25 amended and Q28 added; P1-6
rewritten; H-16 and P1-32 added; P1-7 shelved; P1-11 adds its own write guard and P1-12 drops
`archived_by_user_id`; P0-7, P1-8, P1-13, P1-14, P1-20 and P1-28 cross-references fixed; ERD and README
brought up to date; roadmap entries added.
