# ERD · Design review

[← Plan index](../README.md) · Diagrams: [current](current-schema.md) · [MVP-1](mvp-1.md) · [MVP-2](mvp-2.md) · [MVP-3](mvp-3.md)

These are modelling issues the current schema doesn't handle yet, each with the client's decision. The
MVP diagrams already include these decisions. Each issue has its own heading so it can be linked
(for example `erd/design-review.md#e-1`).

| # | Issue | Fixed by |
| --- | --- | --- |
| [E-1](#e-1) | Prompt wording can drift | H-11 |
| [E-2](#e-2) | Prompts can't be removed safely | H-11 |
| [E-3](#e-3) | Couple membership only enforced in code | Test helper |
| [E-4](#e-4) | No membership end date | H-13 |
| [E-5](#e-5) | Response rows created up front | Accepted for MVP |
| [E-6](#e-6) | Status columns are free text | H-4 |
| [E-7](#e-7) | Audit metadata could hold content | Rule |
| [E-8](#e-8) | No purge job | P1-11 |
| [E-9](#e-9) | Mixed timestamp types | H-2 |
| [E-10](#e-10) | Billing owner (future) | Nothing now |
| [E-11](#e-11) | Couple identity for community | MVP-3 |
| [E-12](#e-12) | Follow-up nesting depth | P1-8 |

---

## E-1

**Prompt wording can drift.** Sessions reference `prompts.id`, and the seed upserts on every deploy.

*Why it matters:* if you fix a typo or reword a prompt, every past conversation silently changes the
question both partners answered.

*Decision:* never reword a prompt; retire it and add a new one ([Q13](../03-product-decisions.md#q13), H-11).
Prompt ids come from each question's position in `seed/catalogue.data.ts`, so that list is
append-only. *Revised 2026-10-18:* snapshot columns on `conversation_sessions` were dropped.

## E-2

**Prompts can't be removed safely.** Deleting a prompt breaks the foreign key, and leaving it in place
keeps showing it on `/start`.

*Why it matters:* you'll prune weak prompts after feedback.

*Decision:* `prompts.retired_at` ([Q14](../03-product-decisions.md#q14)). The seed retires prompts instead of deleting them.

## E-3

**"Is this user in this couple?" is only enforced in code.** Nothing in the database stops a
`session_responses` row for a non-member.

*Why it matters:* the rule is correct today in `requireSessionMember`, but a future endpoint could forget it.

*Decision:* keep it in app code (a composite foreign key would be clumsy). Add a domain-level test helper
that every new session endpoint uses.

## E-4

**Membership history.** `couple_memberships` has `status` but no `left_at`.

*Why it matters:* dissolution and re-coupling ([Q19](../03-product-decisions.md#q19)) need to know when someone
left, for audit and for the 30-day purge ([Q18](../03-product-decisions.md#q18)).

*Decision:* add `left_at` (H-13). Re-coupling creates a new membership row in a new couple.

## E-5

**Response rows exist before anyone answers.** One row per member is inserted when the session is created.

*Why it matters:* it's good for drafts, but it bakes in "members at creation time". If someone leaves
mid-session, their empty row stays.

*Decision:* fine for MVP. On dissolution, all sessions become inaccessible anyway ([Q7](../03-product-decisions.md#q7)).

## E-6

**Status columns are free `text`.**

*Why it matters:* a typo like `'actve'` would be accepted by the database.

*Decision:* Postgres enums or `CHECK` constraints that mirror the `packages/domain` status lists (H-4).

## E-7

**Deletion vs audit.** `audit_events.actor_user_id` has no foreign key, which is good. But `metadata`
could contain content.

*Why it matters:* account deletion ([Q8](../03-product-decisions.md#q8)) must not leave intimate text behind
in audit metadata.

*Decision:* audit metadata holds **ids and enums only, never answer or prompt text**. Add this as a line
in your code review checklist.

## E-8

**Purge job.** [Q18](../03-product-decisions.md#q18) needs something to hard-delete a dissolved couple's
content after 30 days.

*Why it matters:* no scheduler exists yet.

*Decision:* a Railway cron service that runs a script in `packages/database` daily and purges sessions
where `couples.dissolved_at < now() - 30 days`. Built with P1-11.

## E-9

**Timezones.** Every timestamp except `refresh_tokens.expires_at` is `timestamptz`.

*Why it matters:* `timestamptz` is correct. Mixing types causes off-by-an-hour bugs around BST.

*Decision:* fix the one outlier (H-2). Keep storing UTC and format in the browser.

## E-10

**Billing owner (future).**

*Why it matters:* if a paid tier ever happens, the payer is likely the couple, but couples dissolve.

*Decision:* build nothing now, and don't put plan columns on `users`. If needed later, `subscriptions`
hangs off `couples` ([O-3](../04-owner-answers.md#o-3), M-1).

## E-11

**Couple-level identity for community.**

*Why it matters:* the community's public actor is the couple, so a handle has to outlive name changes but
not dissolution.

*Decision:* `community_profiles` keyed by `couple_id` ([MVP-3 sketch](mvp-3.md)). Dissolution withdraws the
profile and its posts.

## E-12

**Follow-up depth.** Child sessions could nest forever.

*Why it matters:* the UI and queries get messy.

*Decision:* one level only. A follow-up session can't have its own follow-ups. Enforce with a domain check
on create (P1-8, P2-7).
