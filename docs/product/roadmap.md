# Future Product Roadmap

> **Status:** Directional product context only.
>
> These features are **not MVP requirements** unless explicitly promoted into the active product scope ([`scope.md`](scope.md)).

## Roadmap Policy

The architecture should avoid unnecessarily preventing future capabilities, but future roadmap items must **not** be implemented or modelled speculatively.

Only account for a future capability now when an MVP architectural decision would otherwise make that capability prohibitively difficult to introduce later.

Do not create database entities, APIs, packages, abstractions, or infrastructure solely for roadmap features.

**The roadmap is directional context, not an implementation specification.**

---

# 1. MVP Foundation

The first public MVP establishes the product's core model:

- Couple formation and partner invitation
- MVP-appropriate user verification
- Private couple space
- Guided conversation sessions
- Independent partner responses
- Mutual reveal
- Guided discussion
- Themes/topics/prompts
- Opt-in structured community
- Joint approval for community publishing
- Reporting, moderation, enforcement, and auditability

The private couple experience must provide value even if the community has very few or zero contributions.

**Community is an extension of the private product, not the primary product.**

Implementation order for MVP is defined in `docs/product/scope.md` (formation → conversation engine → community → publishing → enforcement).

---

# 2. Post-MVP — Near-Term Candidates

*Added 2026-10-26 from the Phase 1 plan review. The owner wants these in the phase after MVP-1, not
before it. Decisions so far are in [`decisions.md`](decisions.md) (Q1, Q3, Q4, Q28).*

## Keep the Discussion Going

Couples may want a conversation to carry on after the curated follow-ups run out, in some format still
to be designed. Constraints from what's already built:

- Session completion is derived, not stored (Q1), so a new way of continuing only changes what counts as
  "open".
- Every child session counts towards "In discussion", whatever its prompt kind. MVP-2's partner-added
  questions (Q21, P2-7) are already one way to keep going; this item may be an extension of them.
- It must not become a chat or direct-message channel (the reason Q21 rejected one-sided questions).

## Mutual Archive

Archiving (setting a conversation aside) needs **both partners to agree**, like the reveal: one asks,
the other confirms (Q4, overruled 2026-10-26). Nothing is archived in MVP-1. Open points:

- Whether the request carries an optional **preset reason** the partner sees when asked to confirm. The
  shelved P1-7 guide (removed 2026-10-26; in git history as `docs/plan/tasks/phase-1/P1-7-skip-archive.md`)
  has a draft list, a check-constraint approach and an audit event to reuse. Avoid reasons that read
  like "Skip for now" (Q24), which is a different, per-person action.
- What happens to a started follow-up nobody finishes: archive it the same way, so its session can leave
  "In discussion".
- Whether a request expires, and what the partner who asked sees while waiting.
- Whether an archived conversation can be brought back.

## Reminders and Notification Polish

Decided (Q28): one push **24 hours** after a conversation or a started follow-up starts waiting on a
partner, **once each**, never repeated. Text picked at random from a small set, starting with "You have a
conversation waiting for you"; never the prompt or answers. Needs a scheduled job (none exists yet). Also:

- **Quiet hours** are left to the phone's own notification settings for now. Later: a setting each user
  can change in the app (needs a stored timezone).
- **More message variations**, for reminders and the existing notifications.
- **Which conversation?** Tapping a follow-up notification opens the right conversation, but nothing on
  the hub's cards shows which conversations have a follow-up waiting for you (partner feedback). See the
  hub layout item below.

## Hub Layout and Follow-up Indicators

The owner plans to rework the hub: sorting by state with `Array.filter`, and separate tabs (e.g. open
discussions, unrevealed, …), with an indicator on each card when a follow-up is waiting on you. Needs
per-viewer follow-up state in `GET /sessions`. P1-6's "We talked about" section is the starting point.

## New Content Notice

When new questions or follow-ups are added to the catalogue (Q27), show something on the root
dashboard / landing page. Follow-ups added to an already-completed conversation don't reopen it (Q1), so
this is how a couple would find them.

## Session History

Allow couples to revisit previous completed conversations.

This has not yet been defined as editable journaling or a diary system.

Historical behaviour, retention, privacy, deletion, and revision rules must be designed before implementation.

## Save / Favourite / Explore Later

Allow couples to privately save prompts, themes, discussions, or exploration content they want to return to.

## Conversation Journeys

Curated multi-session sequences around themes such as:

- Communication
- Intimacy
- Boundaries
- Affection
- Relationship expectations
- Exploration
- Conflict
- Difficult conversations

Journeys should build on the core conversation engine rather than become a separate interaction system.

## Couple-Created Private Questions

Allow a partner to introduce something they would like to discuss without turning the product into private messaging.

Potential model:

1. Partner privately proposes a subject/question.
2. The platform presents it as a neutral structured prompt.
3. Both partners respond independently.
4. Responses are mutually revealed.
5. The couple discusses the subject.

This requires additional design around consent, coercion, safety, and abuse before implementation.

Note: MVP already allows **custom prompts** and **partner-directed discussion questions** under simpler rules. This roadmap item is a richer consent-oriented proposal flow, not a license to expand MVP scope.

## Discovery and Search

Improve navigation across:

- Prompts
- Themes
- Journeys
- Exploration content
- Community topics

## Notifications and Reminders

Potential examples:

- Partner invitation accepted
- Partner has completed their response
- Both responses are ready to reveal
- Community contribution awaiting partner approval
- Optional reminders for unfinished conversations (decided for the next phase: see *Reminders and
  Notification Polish* above)

Notification design must preserve privacy, particularly on device lock screens.

## Native Mobile Application

A future Expo / React Native client may consume the same backend/API used by the web application.

The MVP is web-first.

Do not implement mobile-specific infrastructure until required.

---

# 3. Post-MVP — Expanded Couple Experience

## Games

Playful couple interactions built on top of the established conversation/response system.

Avoid creating an unrelated games subsystem where existing domain primitives are sufficient.

## Structured Toy Exploration

Allow couples to explore products through the communication and consent model.

Potential interaction:

**Discover → Discuss → Independently indicate interest/comfort → Mutual reveal → Learn → Read structured couple experiences → Discuss**

The objective is not to create a conventional product catalogue.

## Position / Activity / Experience Exploration

Apply the same model to intimate activities, positions, experiences, and other adult subjects.

Content should focus on:

- Comfort
- Communication
- Boundaries
- Expectations
- Experience
- What couples learned

It should not become pornographic, performative, or competitive.

## Couple Experiences / Reviews

Structured contributions from couples about toys, activities, positions, or experiences.

Potential areas include:

- What prompted the discussion
- How the couple approached the conversation
- Expectations beforehand
- Comfort considerations
- What they learned
- Whether they would revisit it
- Advice they would give another couple considering the subject

Avoid simple star-rating mechanics where they undermine the communication-focused purpose.

## Community Q&A

Structured questions and responses between couples.

This must remain distinct from:

- Dating
- Solicitation
- Direct messaging
- Unrestricted anonymous forums

## Aggregated Community Insights

Use aggregated community responses to provide healthy perspective without establishing relationship or intimacy benchmarks.

Instead of presenting information such as:

> "67% of couples do X."

Prefer contextual presentation such as:

> Couples discussing this topic described themselves as:
>
> - Curious
> - Comfortable
> - Unsure
> - Not interested

Aggregated information should be framed as **perspective, not a standard couples should meet**.

## Topic Groups

More focused opt-in community spaces around particular subjects.

These require appropriate moderation and consent controls.

---

# 4. Longer-Term Candidates

## Personalised Recommendations

Suggest prompts, conversations, journeys, or educational material based on mutually expressed interests and previous activity.

Recommendations must never expose one partner's private/unrevealed answers to the other.

## AI Conversation Assistance

Potential uses:

- Help users phrase difficult questions respectfully
- Neutralise unnecessarily confrontational wording
- Suggest follow-up questions
- Help couples identify subjects they may want to discuss

AI must not present itself as a therapist, doctor, counsellor, or relationship authority.

Private intimate data requires particularly careful handling before AI functionality is introduced.

## Expert-Created Content

Content created by appropriately qualified relationship, sexual-health, counselling, or educational professionals.

## Verified Expert Accounts

Experts must be clearly distinguished from ordinary couple accounts.

Expert verification requirements would need to be defined separately.

## Premium / Subscription Features

Potential monetisation model once genuine user value has been established.

Monetisation requirements should not distort the initial private couple experience.

## Product Discovery / Affiliate Commerce

Potential future commercial layer for relevant products.

Commercial relationships must be transparent and must not compromise the integrity of couple reviews or educational content.

## Multi-Partner Relationships

The MVP supports two-person couples.

Future versions may support relationships involving more than two people.

Do not implement multi-partner behaviour in the MVP.

However, avoid unnecessary architectural assumptions that would make future expansion prohibitively difficult.

## Internationalisation

Future support may include:

- Multiple languages
- Regional terminology
- Cultural adaptation
- Region-specific moderation requirements
- Region-specific legal/compliance requirements

---

# 5. Explicit Product Boundaries

Future development must not gradually transform the platform into:

- A dating application
- A hookup application
- A partner-matching service
- A pornography platform
- An anonymous posting network
- An unrestricted direct-messaging network
- A popularity/follower-driven social network
- A competitive intimacy-ranking platform

Any proposed feature that moves the product toward one of these behaviours must be explicitly reviewed against the product vision before implementation.

---

# 6. Engineering Guidance for Cursor / AI Agents

Treat this document as **future directional context**.

Do not assume an item in this document is approved for implementation.

Before implementing a roadmap feature:

1. Confirm that it has been promoted into the active product scope.
2. Define its functional requirements.
3. Define privacy and consent implications.
4. Define moderation implications where applicable.
5. Update the domain model intentionally.
6. Add architecture only when justified by the approved requirement.

Do not prematurely generalise MVP code to support every feature described here.

Prefer a clean, well-tested MVP domain over speculative future-proof abstractions.

When an MVP design decision appears likely to make a roadmap capability prohibitively difficult later, flag the trade-off for discussion rather than automatically engineering around it.
