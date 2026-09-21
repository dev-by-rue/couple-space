# Product scope (authoritative)

This document is the **active product source of truth**. Future ideas live in `docs/product/future-roadmap.md` and are **not** approved for implementation until promoted here.

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

- **Reveal:** Soft lock. A partner may submit and wait. Waiting UI may show that the partner has not answered yet. **No partner answer content** until both have submitted. After both have submitted, **each partner reveals for themselves** (Nest-owned per-user reveal). One partner revealing does not reveal for the other.
- **Guided discussion (MVP):**
  - **Curated follow-ups** packaged with platform prompts (custom prompts get a small generic set): **mutual reveal** (same soft-lock rules).
  - **Partner-added questions:** directed — one poses, the other answers; answer visible to both on submit (not freeform messaging). MVP will evolve toward an anonymous `/start` catalog (see `docs/extraction/03-requirements.md`); promote that model fully here before implementing T3/T4.
- **Couple thread / DMs:** not in MVP (abuse surface; planned only for later scale if explicitly promoted).
- **Reflection / wrap-up, session history, browse/explore UX, journaling:** not defined as MVP requirements. Do not model until explicitly specified.

## Prompts

- MVP supports **platform-curated** prompts and **custom** prompts.
- “Themes/topics/prompts” in MVP means a **content model plus enough selection to start a session**, not full discovery/search UX.
- **Custom prompts (decided for extraction wave):** a partner may propose; the other **accepts or discards**; per-partner cap of **3** pending/queued customs. Implementation is a later plan (T3), not the walking skeleton.

## Verification

- **MVP:** email verification + accepting a partner invitation (relationship link, not KYC).
- **Before public launch:** stronger identity checks are in scope to design/implement later; not required for the first formation slice.

## Couple model

- A user may belong to at most one **active** couple.
- Full activation requires two verified members (email + invite accept).
- Public community content (when built) represents the **couple**, not anonymous individuals.
- Publication requires partner approval; edits to published shared content require renewed approval (community slices).
- MVP is two-person couples. Avoid schema assumptions that make future multi-partner support prohibitively hard (e.g. prefer membership rows over hard-coded partner_a/partner_b-only design). Do **not** implement multi-partner behaviour in MVP.

## MVP foundation (implementation order)

1. Couple formation and partner invitation  
2. Private conversation engine (prompts, independent responses, mutual reveal, guided discussion)  
3. Opt-in structured community  
4. Community publishing workflow (joint approval)  
5. Reporting, moderation, enforcement, and auditability  

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

- Concrete meaning of **dual liability** (legal copy vs couple-level sanctions vs both).  
- ~~Whether a **custom prompt** requires partner acceptance before the session starts.~~ **Decided:** accept/discard with per-partner cap of 3 (see Prompts).  
- One vs many **concurrent sessions** per couple.  
- Dissolution confirmation UX.  
- Exact rule for marking a session **completed**.  

## Related docs

- Future directional roadmap: `docs/product/future-roadmap.md`  
- Platform design: `docs/superpowers/specs/2026-08-29-couple-space-platform-design.md`  
- Extraction requirements: `docs/extraction/03-requirements.md`  
- Engineering / agent build brief: `docs/engineering/build-brief.md`  
