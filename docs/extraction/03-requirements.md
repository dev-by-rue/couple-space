# Requirements — private conversation extraction wave

Behaviour authority: [`docs/product/scope.md`](../product/scope.md) + decisions below.  
Prototype (`between-us-source`) is visual evidence only.

**Principles:** private-first; Nest owns rules/redaction; no throwaway scaffolding; MVP points at the final product.

---

## Clarified product decisions (this wave)

| Topic | Decision |
|-------|----------|
| Hub | Prototype `index` visual → `/couple` post-login destination |
| Wave scope | Hub + conversation engine (approach B); discussion tickets after walking skeleton |
| Soft-lock | No partner answer **content** until both submitted |
| Reveal | After both submitted, each partner taps **Reveal** for **themselves** (Nest) |
| Custom prompts | Cap **3** per partner (pending/queued custom); partner **accept or discard**; enables queue |
| Partner-created prompts | Appear **only on `/start`**, mixed into catalog **without attribution** until both answered and each revealed → then **partner-created** label |
| Discussion | Unlocks only after **both** have revealed; curated follow-ups **optional**; may choose follow-up, later ask-own models, or take offline |
| Visual tokens | Keep `apps/web` brand; multi-theme test + semantic map; do not adopt Newsreader/DM Sans as default |
| Atoms | Add missing shadcn via `apps/web`; do not copy prototype `ui/` |

**Scope promotion required:** anonymous partner-prompt pool and per-user Reveal extend/replace parts of `scope.md` L19–22 and resolve L68. Do not implement community couple↔couple yet; keep data shapes open to it.

---

## Functional requirements

### Formation / hub (mostly exists)

| ID | Requirement |
|----|-------------|
| FR-01 | A verified user lands in the couple hub (`/couple`) after login when that is the safe default. |
| FR-02 | A user with no couple can create a couple (existing). |
| FR-03 | A user can invite a partner and share an invite link (existing). |
| FR-04 | Until the couple is **active** (both verified + invite accepted), the user cannot start a conversation; hub shows waiting/education (visual from prototype). |
| FR-05 | An active couple sees Start CTA, optional welcome, and a conversation list (empty or populated). |

### Catalog & starting sessions

| ID | Requirement |
|----|-------------|
| FR-06 | An active couple can open `/start` and browse **platform-curated** themes/prompts (content model + selection — not full search). |
| FR-07 | Starting a curated prompt creates a session and opens it. |
| FR-08 | A partner may **propose** a custom prompt (composer UI). Proposals count toward a per-partner cap of **3** pending/queued customs. |
| FR-09 | The other partner can **accept** or **discard** a custom proposal. Accept places it in the conversation queue / catalog eligibility per Nest rules. |
| FR-10 | Partner-created prompts eligible for selection appear in the `/start` catalog **without** revealing authorship. |
| FR-11 | After both have submitted answers and **each** has revealed, the UI may show the prompt as **partner-created**. |

### Session — answer, wait, reveal

| ID | Requirement |
|----|-------------|
| FR-12 | Each member answers independently; drafts are private to them. |
| FR-13 | Submit is confirmed and treated as immutable (no edit after submit) for MVP. |
| FR-14 | UI may show that the partner has submitted **without** showing their answer text. |
| FR-15 | Nest **must not** return partner answer content to a client until both have submitted **and** the requesting user has revealed. |
| FR-16 | After both have submitted, each user sees a **Reveal** control (not “Reveal together”). Revealing affects **only** that user’s ability to see answers. |
| FR-17 | After the user reveals, they see both answers. |
| FR-18 | Hub list statuses reflect the viewer’s perspective (your turn / waiting for partner / ready to reveal / revealed / etc.). |

### Guided discussion (after skeleton)

| ID | Requirement |
|----|-------------|
| FR-19 | Discussion UI is available only after **both** partners have revealed on the main prompt. |
| FR-20 | Curated follow-ups are **optional**; partners may skip them. |
| FR-21 | Follow-up answers use soft-lock (no partner follow-up content until both submitted that follow-up) when a follow-up is chosen. |
| FR-22 | UI copy may encourage taking the conversation offline (dinner, etc.); no DM thread. |
| FR-23 | In-session “known asker” directed question card from the prototype is **out of MVP UI**; do not scaffold it as the product model. |

### Non-goals encoded as FRs (negative)

| ID | Requirement |
|----|-------------|
| FR-24 | System does not provide unrestricted couple DMs, archives browser, journaling, community publish, or dissolution in this wave. |

---

## Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | **Accessibility:** visible focus; meaningful labels on dismiss/reveal/submit; `aria-live` for waiting/reveal where appropriate; respect `prefers-reduced-motion` for reveal animation. |
| NFR-02 | **Responsiveness:** mobile-first; hub/start/session readable at narrow widths (prototype ~720px content column is a visual guide, not a hard constraint). |
| NFR-03 | **Performance:** thin client; no large unused UI kits; list/detail queries via React Query; avoid leaking large redacted payloads. |
| NFR-04 | **Error handling:** loading, empty, not-found session, couple query error; failed mutations surfaced clearly. |
| NFR-05 | **Security / privacy:** redaction enforced server-side; cookies/`apiFetch` as today; never trust the client for soft-lock. |
| NFR-06 | **Testability:** domain/API Vitest for reveal/submit invariants; web manual until a web test harness exists. |
| NFR-07 | **Theming:** components use semantic tokens; multi-theme testing swaps CSS variables without component forks. |

---

## Out of scope / deferred

- Auth registration redesign; Lovable stack; PrototypeControls  
- Copying prototype shadcn/Radix tree  
- Auto-reveal or couple-wide single Reveal  
- Anonymous pool beyond **this couple’s** `/start` (cross-couple community)  
- Partner-created prompts in post-reveal follow-up chooser  
- Session completion / dissolution UX  
- Profiles / display names beyond email-derived  
- Web E2E suite (unless separately adopted)  
- Replacing Figtree brand fonts as default  

---

## Open questions (do not invent in implementation)

1. Exact Nest schema for per-user reveal and prompt authorship/attribution.  
2. Expiry/discard of accepted-but-never-answered or never-selected pool items (answers never shown).  
3. Whether anonymous partner prompts require prior accept/discard when created as “custom,” or a separate contribute flow — product intent is accept/discard + catalog mix; confirm API shape.  
4. Promote anonymous-pool + per-user Reveal language into `scope.md`.  
5. Concurrent session limits beyond custom cap of 3.  
6. Marking a session completed (`scope.md`).
