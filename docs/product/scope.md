# Product scope (authoritative)

This document is the **active product source of truth**: what the product does today. Future ideas live in [`roadmap.md`](roadmap.md) and are **not** approved for implementation until promoted here. The reasoning behind each rule is in [`decisions.md`](decisions.md) (cited as `Qn`); tasks and order are on the [board](../plan/board.md).

## Principles

- **Private-first and couple-centric.** The couple is the primary account/unit of shared experience.
- Private couple experience must provide value even if the community has few or zero contributions.
- **Community is an extension of the private product, not the primary product.**
- Partner consent, veto, privacy, auditability, and safety take priority over implementation convenience.
- Never silently invent a product rule. Surface ambiguity instead.

## Core interaction loop

```
Prompt → Independent response → Mutual reveal → Guided discussion
```

- **Reveal:** Soft lock. A partner may submit and wait. Waiting UI may show that the partner has answered, but **not when** (Q15). **No partner answer content** until both have submitted. After both have submitted, **each partner reveals for themselves** (Nest-owned per-user reveal). One partner revealing does not reveal for the other.
- **Guided discussion:**
  - **MVP-1: curated follow-ups only.** Follow-ups are packaged with platform prompts and run as **child sessions**. Both partners answer blind; answers **auto-show** to both as soon as the second partner submits. There is no Reveal tap on follow-ups; only the main prompt keeps the per-user reveal (Q22).
  - **MVP-2: partner-added questions.** Once both have revealed, either partner can write a follow-up question. It becomes a child session exactly like a curated follow-up: **both answer**, blind, auto-show on second submit. It shows its author's name. Max **3** open partner-added questions per session (Q21). This replaces the earlier "directed" model (one poses, the other answers, visible on submit), which pressured the answerer and was halfway to direct messaging.
- **Couple thread / DMs:** not in MVP (abuse surface; planned only for later scale if explicitly promoted).
- **Reflection / wrap-up, browse/explore UX, journaling:** not defined as MVP requirements. Do not model until explicitly specified.

## Conversations

- **Concurrent sessions:** unlimited per couple, except a couple can't have two *open* sessions on the same prompt (Q2).
- **Completion** is derived, not stored. A session is **completed** when both partners have revealed the main prompt **and** every follow-up they started has been submitted by both. Between those points it is **in discussion**. Starting a new follow-up moves a completed session back to active. The hub shows active sessions first, then **"We talked about"** (Q1).
- **Skip:** only **Skip for now**, per person, on the preview before anything is saved, with no reason. It hides that prompt from that partner for 2 hours. No one-sided skip of a conversation for both (Q3, Q24).
- **Archive / delete:** none in MVP-1. Archiving will need both partners to agree (roadmap). No hard delete except through account deletion (Q4). A conversation one partner doesn't answer stays open.
- **Drafts** autosave (Q5).
- **Freshness:** the session page refetches on focus and polls lightly while waiting (Q6). Web push notifies the partner, with names only, never prompt or answer text (Q23).
- **Answer length:** 1–5,000 characters, enforced in the domain schema and the database (Q16).

## Prompts

- **MVP-1 is curated-only.** Custom prompts arrive in **MVP-2**.
- Prompts are grouped by **theme**, and each has one **depth** (light / medium / deep) and any number of **tags**; browsing filters by both (Q26). There's also a **Random** start: pick a theme or Surprise me (Q24).
- **Offered prompts:** curated, not retired, never answered by the couple (both submitted in a main session), no open session on it, and not skipped for now by the viewer in the last 2 hours. Answered prompts are hidden on `/start` unless "Show talked about" is on, and then open the old conversation; they're never started twice (Q25).
- **The catalogue never runs out:** the owner keeps adding questions and themes (Q27).
- **Never reword or delete a curated prompt.** To change one, **retire** it and add the new wording as a new prompt. Retired prompts disappear from `/start`; existing sessions on them keep working. Typo fixes may be made in place (Q13, Q14).
- **Custom prompts (MVP-2):** a partner may propose; the other **accepts or discards**; per-partner cap of **3** pending/queued customs. Custom prompts get a small generic set of follow-ups (Q11).

## Verification

- **MVP:** email verification + accepting a partner invitation (relationship link, not KYC).
- **Sandbox auto-verify** may stay on for Gate A (people you know). Real email verification is required from Gate B (Q10).
- **Age gate:** 18+ only, enforced server-side at registration (Q9).
- **Before public launch:** stronger identity checks are in scope to design/implement later; not required for the first formation slice.

## Couple model

- A user may belong to at most one **active** couple.
- Full activation requires two verified members (email + invite accept).
- **Display name:** required, not unique, 1–40 characters, editable. In MVP-1 it's only shown to your partner (Q20).
- **Leaving:** either partner can leave, with a confirmation step and an audit event. The couple becomes dissolved and **all session content becomes inaccessible to both**; it is not handed to either partner (Q7).
- **Re-coupling:** allowed immediately, into a new couple. The old couple's history never carries over (Q19).
- Public community content (when built) represents the **couple**, not anonymous individuals.
- Publication requires partner approval; edits to published shared content require renewed approval (community slices).
- MVP is two-person couples. Avoid schema assumptions that make future multi-partner support prohibitively hard (e.g. prefer membership rows over hard-coded partner_a/partner_b-only design). Do **not** implement multi-partner behaviour in MVP.

## Data and privacy

- **Account deletion:** the user's answers are deleted (the partner sees "This answer was removed") and the couple is dissolved (Q8).
- **Retention:** a dissolved couple's session content is hard-deleted after **30 days**. Audit rows are kept, without content (Q18).
- **Answer text** is never logged and is scrubbed from error reports. App-level encryption is not required for Gate A; revisit before Gate B (Q17).

## Releases (implementation order)

The MVP ships as three releases, each usable on its own. Community remains part of the MVP for **public launch**, just not for the first releases.

1. **MVP-1 · Private:** couple formation (done), the full conversation loop, curated follow-ups, completion, finding a conversation (browse, Random), account essentials, safety/legal, ops basics.
2. **MVP-2 · Couple-created:** custom prompts (propose/accept), anonymous partner prompts on `/start`, partner-added discussion questions.
3. **MVP-3 · Community (public launch):** opt-in community profile, joint-approval publishing, reporting, moderation, enforcement and auditability.

MVP-1 reaches users through two gates:

- **Gate A · Family alpha:** couples the owner knows personally. Sandbox auto-verify and informal password reset are acceptable.
- **Gate B · Stranger beta:** any couple the owner doesn't know. Requires the rest of MVP-1, real email verification, password reset, and the legal groundwork.

The exact task list for each gate is on the [board](../plan/board.md).

## Non-goals / boundaries

Do not build toward:

- Dating, hookup, or partner-matching  
- Pornography platform  
- Anonymous posting network  
- Unrestricted direct messaging  
- Follower / popularity-driven social network  
- Competitive intimacy ranking  

Any proposal that drifts toward these must be reviewed against this document before implementation.

## Open product questions (do not invent answers)

- Concrete meaning of **dual liability** (legal copy vs couple-level sanctions vs both). Parked until MVP-3 (Q12).  
- Dissolution confirmation UX (the rule is decided in Q7; the screen copy and flow are not).  

## Related docs

- Why each rule exists: [`decisions.md`](decisions.md)
- Future, directional only: [`roadmap.md`](roadmap.md)
- Tasks, order and gates: [`../plan/board.md`](../plan/board.md)
- Architecture and engineering rules: [`../engineering/README.md`](../engineering/README.md)
