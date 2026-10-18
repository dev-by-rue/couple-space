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
| [Q3](#q3) | Skip/decline a prompt? | Yes, preset reason only | P1-7 |
| [Q4](#q4) | Delete a session? | Archive only | P1-7 |
| [Q5](#q5) | Draft autosave? | Yes | P0-4 |
| [Q6](#q6) | How does a partner see changes? | Refetch on focus + light polling | P0-6 |
| [Q7](#q7) | Leaving a couple? | Either can leave; content locked for both | P1-11 |
| [Q8](#q8) | Account deletion? | Answers deleted; couple dissolved | P1-12 |
| [Q9](#q9) | Age gate? | 18+ | P1-9 |
| [Q10](#q10) | Real email verification? | Yes, from Gate B | P1-10 |
| [Q11](#q11) | Follow-ups for custom prompts? | Small generic set | P2-4 |
| [Q12](#q12) | Dual liability? | Parked until MVP-3 | P3-1 |
| [Q13](#q13) | Rewording a prompt changes old sessions? | No, snapshot | H-11 |
| [Q14](#q14) | Removing a prompt? | Retire, never delete | H-11 |
| [Q15](#q15) | Show *when* the partner answered? | No timestamp shown | P0-2 |
| [Q16](#q16) | Answer length? | 1–5,000 characters | P0-2, H-12 |
| [Q17](#q17) | App-level encryption? | Not yet; never log answers | P1-18 |
| [Q18](#q18) | Retention after dissolution? | Purge after 30 days | P1-11, P1-12 |
| [Q19](#q19) | Re-couple after leaving? | Yes, fresh couple | P1-11 |
| [Q20](#q20) | Display name rules? | Required, not unique, 1–40 chars | P1-4 |
| [Q21](#q21) | Partner-added questions? | Both answer, MVP-2 | P2-7 |
| [Q22](#q22) | Reveal tap on follow-ups? | No, auto-show after both submit | P1-8, P2-7 |

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

## Q2

**Concurrent sessions per couple?** Unlimited (already decided for T0). Revisit after Gate A feedback.
The exception is that a couple can't have two *open* sessions on the same prompt (P0-7).

## Q3

**Can a partner skip/decline a prompt?** Yes, either partner, with an optional **preset** reason and no
free text. Free text would add pressure and open a DM-like channel. Blocks: P1-7.

## Q4

**Can a session be deleted?** Archive only: hidden from the hub, kept in history. No hard delete in MVP-1
except through account deletion ([Q8](#q8)). Blocks: P1-7.

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

---

## D-4

- [ ] **D-4** Copy the answers to Q1–Q22 into `scope.md` and remove them from its "Open product questions".
