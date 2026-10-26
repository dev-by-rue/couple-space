# Decisions

[Scope](scope.md) · [Roadmap](roadmap.md) · [Board](../plan/board.md)

The **why** behind the rules in [`scope.md`](scope.md). `scope.md` says what the product does today; this
file records how each rule was decided. Add to it; don't rewrite history: when a decision changes, add a
dated *Amended* or *Overruled* line under it.

- **Qn** product decisions · **En** data-model decisions · **On** facts about the owner · **ADR-n** architecture.
- Most Q answers were first made with Claude acting as the client; the owner can overrule any of them
  before the task that depends on it.

| # | Short answer | # | Short answer |
| --- | --- | --- | --- |
| [Q1](#q1) | Completed = both revealed + no follow-up open | [Q15](#q15) | No "answered at" time shown |
| [Q2](#q2) | Unlimited sessions, one open per prompt | [Q16](#q16) | Answers 1–5,000 chars |
| [Q3](#q3) | Only per-person "Skip for now" | [Q17](#q17) | No app-level encryption yet |
| [Q4](#q4) | Archive needs both; not in MVP-1 | [Q18](#q18) | Purge 30 days after dissolution |
| [Q5](#q5) | Drafts autosave | [Q19](#q19) | Re-couple straight away, fresh |
| [Q6](#q6) | Refetch on focus + light polling | [Q20](#q20) | Display name 1–40, not unique |
| [Q7](#q7) | Leaving locks content for both | [Q21](#q21) | Partner-added questions, both answer (MVP-2) |
| [Q8](#q8) | Deletion removes answers, dissolves couple | [Q22](#q22) | Follow-ups auto-show, no reveal |
| [Q9](#q9) | 18+ | [Q23](#q23) | Installable web app + web push |
| [Q10](#q10) | Real email verification from Gate B | [Q24](#q24) | Random: pick a theme or Surprise me |
| [Q11](#q11) | Generic follow-ups for custom prompts | [Q25](#q25) | Which prompts are offered |
| [Q12](#q12) | Dual liability parked to MVP-3 | [Q26](#q26) | One depth + tags |
| [Q13](#q13) | Never reword: retire and replace | [Q27](#q27) | Never run out of content |
| [Q14](#q14) | Retire, never delete | [Q28](#q28) | One reminder after 24 h (next phase) |

---

## Product

## Q1

**When is a session completed?** Derived, never stored. **In progress** until both partners have revealed
the main prompt; **in discussion** while any follow-up they *started* isn't submitted by both (or
archived); **completed** otherwise. Completed sessions sit in the hub's **"We talked about"** section.
Starting a new follow-up moves a completed session back to active.

*Amended 2026-10-26:* nothing is archived in MVP-1 (Q4), so an unanswered started follow-up keeps a session
in discussion; a reminder (Q28) nudges. `isSessionOpen` (Q2) doesn't change. Follow-ups added to the
catalogue later don't reopen a completed session. Hub sorting and tabs are the owner's to evolve
([roadmap](roadmap.md#hub-layout-and-follow-up-indicators)).

## Q2

**Concurrent sessions?** Unlimited, except a couple can't have two *open* sessions (not revealed by both)
on the same prompt: starting it again reuses the open one. *Amended 2026-10-25:* see Q25 for which prompts
are offered at all.

## Q3

**Skip or decline a prompt?** *Overruled 2026-10-26 (owner):* **no one-sided skip**; it isn't in a
couple's interest for one partner to skip a question for both. The only skip is Q24's **Skip for now**:
per person, before anything is saved, **no reason**. Preset reasons move to the mutual archive (Q4).
*(Was: either partner may decline, with an optional preset reason.)*

## Q4

**Delete a session?** Archive only, never hard-delete (except through account deletion, Q8).
*Overruled 2026-10-26 (owner):* archiving needs **both partners to agree**, like the reveal: one asks, the
other confirms. That's a later phase ([roadmap](roadmap.md#mutual-archive)); **MVP-1 has no archive**.

## Q5

**Drafts?** Autosave. The response row exists from the start with `submitted_at = null`; save `body` on
blur or after a debounce.

## Q6

**How does a partner see changes?** Refetch on window focus, plus light polling (15–30 s) on the session
page only while waiting. Push (Q23) adds notifications; polling stays as the refresh mechanism.

## Q7

**Leaving a couple?** Either partner can leave, with a confirmation step and an audit event. The couple
becomes `dissolved`, memberships become `left`, and **all session content becomes inaccessible to both**.
Purged after 30 days (Q18). The confirmation screen's copy is still open.

## Q8

**Account deletion?** The user's answers are deleted (the partner sees "This answer was removed") and the
couple is dissolved.

## Q9

**Age gate?** 18+ only, enforced server-side at registration (DOB is already collected).

## Q10

**Real email verification?** Yes from Gate B (`SANDBOX_AUTO_VERIFY=false`). It can stay on for Gate A.

## Q11

**Follow-ups for custom prompts (MVP-2)?** A small generic set.

## Q12

**Dual liability?** Not defined yet; parked until MVP-3.

## Q13

**Rewording a prompt?** Never: a session keeps the exact wording both answered. Retire the prompt (Q14)
and add the new wording as a new prompt. Typo fixes may be made in place. *Revised 2026-10-18:* prompt
snapshot columns dropped as unneeded.

## Q14

**Removing a prompt?** Retire it (`prompts.retired_at`), never delete. Retired prompts leave `/start`;
existing sessions on them keep working.

## Q15

**Show when the partner answered?** No. Only *that* they've answered; the timestamp is stored, not shown.

## Q16

**Answer length?** 1–5,000 characters, in the domain schema and a database `CHECK`.

## Q17

**App-level encryption?** Not for Gate A. Answers are never logged and are scrubbed from error reports.
Revisit before Gate B (affected by L-3, special category data).

## Q18

**Retention?** A dissolved couple's session content is hard-deleted after 30 days. Audit rows stay,
without content (E-7, E-8).

## Q19

**Re-couple after leaving?** Yes, immediately, into a new couple. Old history never carries over.

## Q20

**Display name?** Required, not unique, 1–40 characters, editable. Only ever shown to your partner in MVP-1.

## Q21

**Partner-added questions (MVP-2)?** Once both have revealed, either partner can write a follow-up
question. It's a child session like a curated follow-up: **both answer** blind, answers auto-show (Q22),
it shows its author's name, max 3 open per session. Replaces the "one poses, the other answers" model,
which pressured the answerer and was halfway to direct messaging.

## Q22

**Reveal tap on follow-ups?** No. Follow-ups stay blind until both submit, then **auto-show** to both.
Only the main prompt keeps the per-user Reveal. *Rejected:* visible on submit (lets the second person
react instead of answer).

## Q23

**Native app for notifications?** No: an installable web app (manifest) plus web push from Nest. Owner
decisions 2026-10-21:

- A push goes to the partner when the **first answer** in a conversation is submitted (*amended
  2026-10-22*; was "on create"). Later steps (ready to reveal, partner revealed, follow-ups) are covered
  by one rule set (P1-31), one tag per conversation.
- Lock-screen text has names only, **never** the theme, prompt or answers.
- Permission is asked from a hub banner (Enable button) or the account menu; iPhone needs Add to Home
  Screen first (iOS 16.4+). Every enabled device gets pushes; logout removes that device.
- *Rejected:* Capacitor, an Expo rewrite.

## Q24

**Random conversations?** Yes (owner, 2026-10-25). A **Random** page: **Pick a theme** (a random eligible
prompt from it; fully answered themes show greyed out as **Explored**) or **Surprise me** (a random theme
that still has an eligible prompt, then a random prompt). A preview card with **Start this conversation**
and **Skip for now**; nothing is saved until Start. Not marked as random. Skip for now asks for no reason
(*amended 2026-10-26*).

*Rejected for now:* "Never show this again" (one partner shouldn't close a topic for both).
*To confirm:* where the button lives; whether Surprise me avoids the theme just skipped (proposed: yes);
whether it leans to light/medium (proposed: yes).

## Q25

**Which prompts can a couple be offered?** On `/start` and Random alike, a prompt is offered when it's
curated and not retired, the couple has **never answered it** (both submitted in a main session; follow-ups
never count), has **no open session** on it, and the viewer hasn't **skipped it for now** in the last
2 hours (`SKIP_FOR_NOW_HOURS`, per person, never more than 24). A re-formed couple starts fresh.
Empty states: "You've explored everything here. New questions arrive regularly." and "Nothing new right
now, check back in a little while."

*Amended 2026-10-26 (owner), before Gate A (P1-32):* answered prompts are hidden on `/start` by default,
with a **"Show talked about"** chip; with it on they show a "Talked about" badge and **open the old
conversation**. `POST /sessions` refuses an answered prompt (`409 prompt_already_answered`).

## Q26

**Depth and tags?** Every curated prompt has one **depth** (`light`, `medium`, `deep`) and any number of
**tags** from a curated list. Filterable when browsing. Follow-ups take their parent's depth and have no
tags. *To confirm before any are written:* sexual prompts need their own rules (opt-in by both? hidden
from Random? labelling?).

## Q27

**What if a couple runs out?** They mustn't: a hard constraint on **content**. The owner keeps writing
questions and themes. The catalogue grows without limit (E-13); a question can ship with no follow-ups;
themes can be retired later. *Later:* an admin page, a content style guide, skip-rate stats, translations.

## Q28

**A partner who hasn't answered?** Owner, 2026-10-26, **next phase**: one push reminder **24 hours** after
a conversation or started follow-up starts waiting, **once each**. Wording picked at random from a small
set, starting with "You have a conversation waiting for you"; never prompt or answer text. No in-app quiet
hours yet (phone settings cover it). Needs a scheduled job. See the [roadmap](roadmap.md#reminders-and-notification-polish).

---

## Data model

## E-1

**Prompt wording drift.** Decided by Q13: never reword; retire and replace.

## E-2

**Removing prompts safely.** `prompts.retired_at` (Q14); the seed retires, never deletes.

## E-3

**Couple membership is only enforced in code.** Keep it in app code (`requireSessionMember`); a composite
FK would be clumsy. Every new session endpoint goes through the shared helper.

## E-4

**Membership history.** Add `couple_memberships.left_at` (H-13); re-coupling creates a new row.

## E-5

**Response rows created up front** (one per member at session create). Fine for MVP; on dissolution
everything is inaccessible anyway (Q7).

## E-6

**Status columns are free text.** Enforce them with `CHECK` constraints or enums mirroring the domain
lists (H-4). Preset values elsewhere use `text` + `CHECK` (e.g. `prompts.depth`).

## E-7

**Audit vs deletion.** `audit_events.actor_user_id` has no FK (by design). Audit metadata holds **ids and
enums only, never answer or prompt text**.

## E-8

**Purge job.** A daily Railway cron runs a `packages/database` script that purges sessions of couples
dissolved more than 30 days ago (P1-11).

## E-9

**Timestamps.** Everything is `timestamptz`, stored UTC, formatted in the browser.

## E-10

**Billing owner (future).** Build nothing; never put plan columns on `users`. If billing comes, it hangs
off `couples` (O-3).

## E-11

**Couple identity for community (MVP-3).** `community_profiles` keyed by `couple_id`; dissolution
withdraws the profile and its posts.

## E-12

**Follow-up depth.** One level only: a follow-up session can't have follow-ups (checked on create).

## E-13

**Catalogue ids.** Every theme, prompt and tag has a permanent hand-written key, and its id is `uuidv5` of
that key (follow-ups: parent key + position). After Gate A: never change or reuse a key, never reword,
follow-ups are append-only. One-off reset (P1-28) deleted all sessions to switch schemes; never repeat it.

---

## Owner

## O-1

**Legal entity.** Not trading yet; UK-based. No entity needed to build or test with family; one is
needed before Gate B (L-1…L-5).

## O-2

**Data region.** EU. First users: the owner and partner, then a cousin and his wife (Gate A).

## O-3

**Monetisation.** Undecided; build nothing for it (E-10). Research is M-1, after Gate A.

---

## Architecture

## ADR-001

**Nest-owned auth (accepted 2026-08-31).** Hosted Supabase Auth wasn't usable, so NestJS owns
authentication: argon2id passwords, access JWT + hashed refresh tokens in Postgres, httpOnly cookies for
the web and Bearer for a future native client. Postgres through Drizzle (`@couple-space/database`), not
tied to Supabase. All authorization stays in Nest; invariants live in `@couple-space/domain`. The web
calls the API with `apiFetch` (`credentials: 'include'`) and React Query. Production keeps
`ENABLE_DEV_AUTH_ENDPOINTS=false`. Future OAuth gets an `auth_identities`-style table.
