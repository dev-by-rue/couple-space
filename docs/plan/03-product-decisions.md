# 03 · Product decisions

[← Plan index](README.md)

These are the `scope.md` open questions plus ones found while planning, answered with Claude acting as
**the client**. Each answer is the simplest rule that keeps the product private-first without boxing the
schema in. You can overrule any of them, but do it **before** the task that depends on it, and log the
change in the [progress log](README.md#progress-log).

Each decision has its own heading, so you can link it directly (for example `03-product-decisions.md#q22`).

## Summary

| # | Question | Short answer | Blocks |
| --- | --- | --- | --- |
| [Q1](#q1) | When is a session completed? | Both revealed the main prompt **and** no follow-up open | P1-6 |
| [Q2](#q2) | Concurrent sessions per couple? | Unlimited | — |
| [Q3](#q3) | Skip/decline a prompt? | ~~Yes, preset reason only~~ Only "Skip for now" (Q24), per person, no reason | — |
| [Q4](#q4) | Delete a session? | Archive only, and only when **both** agree; not in MVP-1 | Roadmap |
| [Q5](#q5) | Draft autosave? | Yes | P0-4 |
| [Q6](#q6) | How does a partner see changes? | Refetch on focus + light polling | P0-6 |
| [Q7](#q7) | Leaving a couple? | Either can leave; content locked for both | P1-11 |
| [Q8](#q8) | Account deletion? | Answers deleted; couple dissolved | P1-12 |
| [Q9](#q9) | Age gate? | 18+ | P1-9 |
| [Q10](#q10) | Real email verification? | Yes, from Gate B | P1-10 |
| [Q11](#q11) | Follow-ups for custom prompts? | Small generic set | P2-4 |
| [Q12](#q12) | Dual liability? | Parked until MVP-3 | P3-1 |
| [Q13](#q13) | Rewording a prompt changes old sessions? | No, retire and replace | H-11 |
| [Q14](#q14) | Removing a prompt? | Retire, never delete | H-11 |
| [Q15](#q15) | Show *when* the partner answered? | No timestamp shown | P0-2 |
| [Q16](#q16) | Answer length? | 1–5,000 characters | P0-2, H-12 |
| [Q17](#q17) | App-level encryption? | Not yet; never log answers | P1-18 |
| [Q18](#q18) | Retention after dissolution? | Purge after 30 days | P1-11, P1-12 |
| [Q19](#q19) | Re-couple after leaving? | Yes, fresh couple | P1-11 |
| [Q20](#q20) | Display name rules? | Required, not unique, 1–40 chars | P1-4 |
| [Q21](#q21) | Partner-added questions? | Both answer, MVP-2 | P2-7 |
| [Q22](#q22) | Reveal tap on follow-ups? | No, auto-show after both submit | P1-8, P2-7 |
| [Q23](#q23) | Mobile app and notifications? | Installable web app + web push; no native app | P1-25…P1-27 |
| [Q24](#q24) | Random conversations? | Yes: pick a theme or Surprise me; Start or Skip for now | P1-29 |
| [Q25](#q25) | Which prompts can a couple be offered? | Not answered, not open, not skipped by you in the last 2 h | P1-29, P1-30 |
| [Q26](#q26) | Depth and tags on prompts? | One depth + any number of tags; filterable | P1-28, P1-30 |
| [Q27](#q27) | What if a couple runs out? | They mustn't: the owner keeps writing content | P1-21, P1-28 |
| [Q28](#q28) | Reminding a partner who hasn't answered? | One push after 24 h, next phase | Roadmap |

---

## Q1

**When is a session "completed"?**

Derived, no column. A session is completed when both partners have revealed the main prompt **and** no
follow-up or discussion question is still in progress: every child session they started has been
**submitted** by both, or archived. Follow-ups have no reveal step ([Q22](#q22)).

| State | Meaning | Hub |
| --- | --- | --- |
| In progress | Main prompt not yet revealed by both | Active |
| **In discussion** | Main prompt revealed by both, a follow-up is open | Active |
| Completed | Main prompt revealed by both, no follow-up open | Past conversations |

Starting a new follow-up on a completed session moves it back to active. Blocks: P1-6.

*Amended 2026-10-26 (owner):*

- **Hub wording:** the completed section is called **"We talked about"**, not "Past conversations".
- **Nothing is archived in MVP-1** ([Q4](#q4)), so the "or archived" part of the rule is always false
  for now. A started follow-up that one partner never answers keeps the session **In discussion**. That's
  accepted: a reminder ([Q28](#q28)) nudges, and closing a stuck conversation is a later phase.
- **"Open" for reuse doesn't change.** `isSessionOpen` stays "not revealed by both". An In discussion
  session is already answered, so [Q25](#q25) never offers that prompt again.
- **New follow-ups added to the catalogue later** (Q27) don't reopen a completed session: follow-ups
  nobody started don't count. Telling the couple about new content is on the roadmap.
- **Hub layout is the owner's to evolve:** sorting by state and separate tabs (open discussions,
  unrevealed, …) come later, with an indicator on each card for a follow-up waiting on you.

## Q2

**Concurrent sessions per couple?** Unlimited (already decided for T0). Revisit after Gate A feedback.
The exception is that a couple can't have two *open* sessions on the same prompt (P0-7).

*Amended 2026-10-25 ([Q25](#q25)):* `/start` and random also leave out prompts the couple has already
answered (both submitted) and prompts the viewer skipped for now in the last 2 hours.

## Q3

**Can a partner skip/decline a prompt?** Yes, either partner, with an optional **preset** reason and no
free text. Free text would add pressure and open a DM-like channel. Blocks: P1-7.

*Overruled 2026-10-26 (owner):* **no one-sided skip.** It isn't in a couple's interest for one partner
to skip a question for both of them. The only skip is **Skip for now** ([Q24](#q24)): per person, on the
preview before anything is saved, and **without a reason** (it's private and temporary, so a reason would
only add friction). Preset reasons move to the mutual archive on the roadmap ([Q4](#q4)), where the
partner sees the reason when asked to confirm. P1-7 leaves MVP-1.

## Q4

**Can a session be deleted?** Archive only: hidden from the hub, kept in history. No hard delete in MVP-1
except through account deletion ([Q8](#q8)). Blocks: P1-7.

*Overruled 2026-10-26 (owner):* archiving needs **both partners to agree**, like the reveal: one asks,
the other confirms. That's a later phase ([roadmap](../product/future-roadmap.md#mutual-archive)), so
MVP-1 has **no archive at all**. A conversation one partner doesn't answer stays open; [Q28](#q28)
reminds them once. Still no hard delete except through account deletion.

## Q5

**Draft autosave?** Yes. The response row already exists with `submitted_at = null`, so save `body` on
blur or after a debounce. Blocks: P0-4.

## Q6

**How does a partner learn something changed (no notifications yet)?** Refetch on window focus, plus light
polling (every 15–30 s) on the session page only while waiting. Email nudges come later (P1-14). Blocks: P0-6.

## Q7

**Leaving or dissolving a couple: what happens to shared answers?** Either partner can leave. The couple
becomes `dissolved` and memberships become `left`. **All session content becomes inaccessible to both**;
it isn't handed to either partner. Leaving needs a confirmation step and writes an audit event. Purged
after 30 days ([Q18](#q18)). Blocks: P1-11.

## Q8

**Account deletion: what happens to my answers my partner already revealed?** They're deleted, and the
partner sees "This answer was removed". If one member deletes their account, the couple is dissolved.
Blocks: P1-12.

## Q9

**Age gate.** DOB is already collected, so **18+ only**, enforced server-side at registration. Blocks: P1-9.

## Q10

**Real email verification?** Yes, `SANDBOX_AUTO_VERIFY=false` for any environment used by couples you
don't know personally (Gate B). It can stay on for Gate A. Blocks: P1-10.

## Q11

**Follow-ups for custom prompts.** A small generic set (scope already says this). Only matters in MVP-2.
Blocks: P2-4.

## Q12

**"Dual liability"** (scope open question). Parked until MVP-3. Blocks: P3-1.

## Q13

**If we reword a curated prompt, should old sessions change?** **No.** A session keeps the exact wording
both partners answered. Prompts are never reworded: to change one, retire it ([Q14](#q14)) and add the new
wording as a new prompt. Typo fixes may be made in place. No snapshot columns
([E-1](erd/design-review.md#e-1)). Blocks: H-11.

*Revised 2026-10-18:* originally "snapshot the title and text onto the session". Dropped as unneeded
while retire-and-replace gives the same guarantee.

## Q14

**Can a curated prompt be removed?** Retire it, never delete it. `prompts.retired_at` hides it from
`/start`, and existing sessions keep working ([E-2](erd/design-review.md#e-2)). Blocks: H-11.

## Q15

**Can partners see *when* the other answered?** Only that they've answered, with no time shown. The
timestamp is stored but not displayed, so nobody feels watched. Blocks: P0-2.

## Q16

**Is answer length limited?** 1–5,000 characters, enforced in the domain schema and with a DB `CHECK`.
Blocks: P0-2, H-12.

## Q17

**Is answer text encrypted beyond Railway's disk encryption?** Not for Gate A. Answers are never logged
and are scrubbed from error reports (P1-18). Revisit app-level encryption before Gate B, because it's
affected by [L-3](tasks/legal-and-business.md) (special category data). Blocks: P1-18.

## Q18

**Data retention after dissolution or deletion.** A dissolved couple's session content is hard-deleted
after 30 days. Audit rows are kept, without content ([E-7](erd/design-review.md#e-7),
[E-8](erd/design-review.md#e-8)). Blocks: P1-11, P1-12.

## Q19

**Can someone re-couple after leaving?** Yes, immediately, into a new couple. The old couple's history
never carries over ([E-4](erd/design-review.md#e-4)). Blocks: P1-11.

## Q20

**Display name: required, and unique?** Required, not unique, 1–40 characters, editable. In MVP-1 it's
only ever shown to your partner. Blocks: P1-4.

## Q21

**Partner-added discussion questions: one-sided ("directed") or both answer?**

**Both answer.** Once both have revealed, either partner can write their own follow-up question. It
becomes a child session exactly like a curated follow-up: both answer without seeing each other's answer,
and answers auto-show once both have submitted ([Q22](#q22)).

- It shows its author's name. It sits inside a session they're both already in, so anonymity is pointless.
- Max 3 open partner-added questions per session.
- This replaces the "one poses, the other answers" wording in `scope.md`. A one-sided question puts
  pressure on the partner who must answer, and it's halfway to a direct message.
- **Ships in MVP-2.** Blocks: P2-7.

## Q22

**Do follow-ups (curated or partner-added) need their own Reveal tap?**

**No.** Follow-ups keep blind answering: nothing is visible until both have submitted. Answers then
**auto-show** to both as soon as the second partner submits. Only the main prompt keeps the per-user
Reveal moment.

*Rejected alternative:* making answers visible the moment each partner submits. That lets the second
answerer react instead of answer, exposes whoever goes first, and turns discussion into a two-person
thread. This decision supersedes `scope.md`'s "answer visible to both on submit" for partner-added
questions. Blocks: P1-8, P2-7.

## Q23

**Does the app need to be a native (React Native) app for phone notifications?**

**No.** Notifications are the only phone feature wanted, and a web app can do them: an installable web app
(manifest) plus web push from Nest. Every line of existing code is kept and there are no new Railway
services. Owner decisions (2026-10-21):

- **What triggers a push:** a partner **submits the first answer** in a conversation (amended 2026-10-22;
  was "creates a new conversation", which pinged before anything was written). Creating or reusing a
  session sends nothing, and the second answer doesn't ping back. Reveals are not pushed yet.
- **Lock-screen text:** title "New conversation", body "<name> started a new conversation". The name is
  fine (only the partner receives it). **Never** the theme, prompt or any answer text.
- **Asking for permission:** a banner on the hub with an Enable button (the browser prompt only ever
  appears after that tap), plus an on/off item in the account menu. "Not now" hides the banner on that
  device.
- **iPhone:** web push only works once the app is added to the Home Screen (iOS 16.4+). In Safari the
  banner shows "Add to Home Screen first" instead of the Enable button.
- **Tapping a notification** opens that conversation (focusing an open window if there is one).
- **Every device** a person enables gets the push. Logging out removes the subscription for that device.

*Rejected alternatives:* Capacitor (store listing, needs a static export instead of Next rewrites) and an
Expo rewrite (every screen rebuilt). Revisit only if more native features are scoped. Supersedes the "no
notifications yet" part of [Q6](#q6); polling stays as the way screens refresh. Blocks: P1-25…P1-27.

## Q24

**Can a couple start a random conversation?** Yes. Owner decisions (2026-10-25):

- **Entry:** a **Random** button. It opens a page with two choices: **Pick a theme** or **Surprise me**.
- **Pick a theme:** a random eligible prompt ([Q25](#q25)) from that theme. A theme the couple has
  answered completely shows greyed out as **Explored**. It stays in the list because new questions get
  added ([Q27](#q27)).
- **Surprise me:** picks a random theme that still has an eligible prompt, then a random prompt in it,
  so every theme gets equal airtime however many questions it has.
- **Preview card:** theme, title and question, with **Start this conversation** and **Skip for now**.
  Nothing is saved until Start, and Start goes through the normal `POST /sessions` (which checks
  eligibility again). Skip for now asks for **no reason** ([Q3](#q3), amended 2026-10-26). Surprise me uses the same card and the same rules.
- **Not marked as random.** It's a normal session. Knowing it was random could be fun, but it isn't
  needed (a nullable `source` column can be added later).

*Rejected for now:* **"Never show this again".** One partner shouldn't decide for both what's open for
discussion. If *you* don't want to start a topic you skip it, but your partner can still choose to.
The product promotes openness, including about difficult topics. Revisit after Gate A feedback.

**To confirm:**

- Where the Random button lives (the hub, `/start`, or both).
- Whether Surprise me avoids repeating the theme of the prompt just skipped. Proposed: yes, when
  another theme has an eligible prompt.
- Whether Surprise me leans towards `light` and `medium` prompts ([Q26](#q26)) so a heavy question
  doesn't land out of nowhere. Proposed: yes.

Blocks: P1-29.

## Q25

**Which prompts can a couple be offered?** The same rule for browsing `/start` and for random
([Q24](#q24)). A prompt is offered when **all** of these hold:

- It's a curated prompt (not a follow-up, and later not a partner-added or custom prompt) and isn't
  retired.
- The couple has **never answered it**: no session on it, open, completed or archived, where **both
  partners submitted**. Answered prompts never come back for that couple. A re-formed couple starts
  fresh ([Q19](#q19)).
- The couple has **no open session** on it ([Q2](#q2)).
- The viewer hasn't **skipped it for now** within the last **2 hours**.

**Skip for now** is per person: it hides the prompt only from the partner who tapped it, for
`SKIP_FOR_NOW_HOURS = 2` (one domain constant, never more than 24). The other partner can still see and
start it. Skipping again restarts the timer.

A session archived before both submitted ([P1-7](tasks/phase-1/P1-7-skip-archive.md) skip) doesn't block
the prompt: it can be offered again straight away, and starting it creates a new session (P1-7).

**Empty states:** "You've explored everything here. New questions arrive regularly." when everything is
answered, and "Nothing new right now, check back in a little while." when what's left is only skipped
for now. They should be rare ([Q27](#q27)), but never a blank page.

*Amended 2026-10-26 (owner): answered prompts on `/start`, before Gate A.* Answered prompts are
**hidden by default**, with a **"Show talked about"** filter chip next to depth and tags. With the chip
on, an answered prompt shows a "Talked about" badge and tapping it **opens the old conversation**; it
never starts a new one. `POST /sessions` refuses an answered prompt (`409 prompt_already_answered`) as a
safety net. This slice ships as [P1-32](tasks/phase-1/P1-32-answered-prompts.md), ahead of P1-29.

Amends [Q2](#q2). Blocks: P1-29, P1-30, P1-32.

## Q26

**How are prompts described beyond their theme?** Every curated prompt has:

- One **depth**: `light`, `medium` or `deep`. Required.
- Any number of **tags** from a curated list (draft: playful, thoughtful, romantic, practical,
  nostalgic, hopeful). New tags can be added at any time.

Couples can filter by depth and tags when browsing (P1-30). Follow-ups take their parent's depth and
have no tags.

**To confirm before any are written:** sexual ("naughty") prompts. They need their own rules first:
whether both partners must opt in, whether they're hidden from random by default, and how they're
labelled. Until then, no such tag or prompts.

Blocks: P1-28, P1-30.

## Q27

**What if a couple runs out of things to talk about?** They mustn't. Running out would be a
relationship red flag, so it's a **hard constraint on content, not code**: the owner keeps writing new
questions and themes for as long as the product exists. Supporting rules:

- The catalogue must be able to grow without limits: key-based ids and one file per theme
  ([E-13](erd/design-review.md#e-13), P1-28).
- A question can ship with **no follow-ups**; they can be added later (append-only).
- A theme **can** be retired, the same way as a prompt ([Q14](#q14)), but this isn't built until a later
  phase. The `retired_at` column is a safe nullable migration whenever it's needed.
- The code still has empty states as a safety net ([Q25](#q25)).
- **Later, not MVP-1:** an admin page so new content doesn't need a deploy; a content style guide (tone,
  depth, inclusive wording that doesn't assume marriage, children, living together or gender);
  aggregated skip rates per prompt to show what lands; translations.

Blocks: P1-21, P1-28.

## Q28

**What if a partner doesn't answer?** Owner decisions (2026-10-26), **next phase, not MVP-1**:

- One **push reminder 24 hours** after a conversation (or a started follow-up) starts waiting on a
  partner. **Once each**, never repeated.
- The text is picked at random from a small set, names-free to start: "You have a conversation waiting
  for you". The set grows over time. Never the prompt or answer text ([Q23](#q23)).
- **No quiet hours in the app** for now: people use their phone's own notification settings. A
  user-configurable setting comes later.
- Needs a scheduled job (none exists yet), so it's planned with the next phase.

See the [roadmap](../product/future-roadmap.md#reminders-and-notification-polish). Blocks: roadmap.

---

## D-4

- [ ] **D-4** Copy the answers to Q1–Q28 (with their amendments) into `scope.md` and remove them from its "Open product questions".
