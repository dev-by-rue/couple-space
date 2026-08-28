# Couple Space — Platform Design

**Date:** 2026-08-29  
**Status:** Draft for review (not committed by request)  
**Product source of truth:** `docs/product/scope.md`  
**Roadmap (directional only):** `docs/product/future-roadmap.md`

## 1. Product interpretation

### Core user problem

Couples need a **private shared space** to work through structured prompts together—with fairness (independent answers before reveal) and facilitated discussion—without becoming a dating, anonymous, or messaging-centric social product.

### Primary user journey (MVP private loop)

1. Form a couple (invite + email verification).  
2. Start a session from a curated or custom prompt.  
3. Each partner responds independently.  
4. Mutual reveal when both have submitted (waiting state allowed; no content leak).  
5. Guided discussion: curated mutual follow-ups and/or partner-directed questions.

### Couple-as-account model

- Couple is the shared container; membership links users to couples.  
- At most one **active** membership per user.  
- Activation: two email-verified members after invite accept.  
- Community (later MVP slices): public actor is the **couple**; publish/edit needs partner approval.

### Dual liability

Named in early engineering notes; **not yet defined** as a concrete product/legal rule. Do not invent. Open question in product scope.

### Partner consent and veto

- Private loop: reveal gates and structured discussion (not freeform DMs).  
- Community slices: joint approval for publish; renewed approval on edit.  
- Partner-directed discussion questions are asymmetric by design (poser → answerer).

### Private-first / opt-in community

Private product must be valuable with zero community activity. Community is an extension, implemented after the conversation engine.

### Moderation

No assumption that automation is enough. Reporting/enforcement is MVP foundation slice 5, after community exists. Solo-maintainer constraint: avoid DM surfaces in MVP.

### Explicit non-goals

Dating, hookup, matching, pornography, anonymous networks, unrestricted DMs, follower/popularity social, competitive intimacy ranking.

### Ambiguities that could cause technical/data issues if invented

| Topic | Risk if invented |
|---|---|
| Dual liability | Wrong sanction/audit model |
| Custom prompt accept-before-start | Session start races / consent gaps |
| Concurrent sessions | Unique constraints and UX |
| Session `completed` rule | Orphan discussion items |
| Dissolution confirm | Accidental data lockouts |

---

## 2. Architecture

### Chosen approach

**NestJS modular monolith + shared domain + Supabase Postgres/Auth** (Approach A).

```
apps/web (Next.js) --JWT--> apps/api (NestJS)
                               |
                               | Drizzle (service role)
                               v
                        Supabase Postgres + Auth
```

| Concern | Choice | MVP vs later |
|---|---|---|
| Web | Next.js `apps/web` | MVP |
| API | NestJS `apps/api` | MVP |
| Auth | Supabase Auth; Nest verifies JWT | MVP |
| DB | Supabase Postgres | MVP |
| ORM | Drizzle in `packages/db` | MVP |
| Validation | Zod (or Nest pipes + shared schemas) | MVP |
| Domain | `packages/domain` pure TS | MVP |
| RLS | Light defense-in-depth | MVP |
| Jobs | None until needed | Later |
| Notifications | Not in first slices | Roadmap |
| Media | Not required for text loop | Later |
| Mobile | Same HTTP API; no mobile infra | Roadmap |
| Community/moderation | After private engine | MVP slices 3–5 |

**Bias:** one experienced full-stack engineer; no microservices.

### Repository structure

```
apps/web/                 # Next.js
apps/api/                 # NestJS (to scaffold with slice 1)
packages/domain/          # types + pure invariants
packages/db/              # Drizzle schema + migrations
docs/product/             # scope + future roadmap
docs/engineering/         # build brief
docs/superpowers/specs/   # designs
docs/architecture/        # ADRs (as decisions lock)
```

---

## 3. Domain model (slices 1–2)

### Entities

| Entity | Purpose |
|---|---|
| User | Profile keyed to Supabase Auth user id |
| Couple | Relationship container (`forming` / `active` / `dissolving` / `dissolved`) |
| CoupleMembership | User↔Couple; enforce ≤1 active membership per user |
| CoupleInvitation | Invite lifecycle |
| PromptTemplate | Curated prompt + packaged mutual follow-ups; theme/topic metadata as needed for selection |
| Session | One loop run (template or custom prompt text) |
| SessionResponse | Independent answer for mutual-reveal steps |
| DiscussionItem | `curated_mutual` \| `partner_directed` |
| DirectedAnswer | Answer to directed item |
| AuditEvent | Security-sensitive actions; avoid logging full intimate bodies by default |

### Deferred (no speculative schema)

Reflection, history product, save/favourite, journeys, community/moderation entities, chat thread, multi-partner behaviour, notifications infra.

### Invariants

- ≤1 active couple membership per user (DB partial unique index).  
- Activate only with two verified active members.  
- Mutual steps: never return partner body until both submitted.  
- Directed answers visible on submit to active members only.  
- Membership-shaped for possible future >2; MVP behaviour remains two-person.

---

## 4. State machines

### Couple

`forming → active → dissolving → dissolved`  
Forbidden: resurrect dissolved; activate without email+invite rules.

### Invitation

`pending → accepted | revoked | expired`  
Forbidden: accept if invitee has active couple; accept unverified/expired/revoked.

### Session

`open → awaiting_reveal → revealed → discussing → completed` (and `cancelled` on dissolve/cancel — product detail open).

### Mutual discussion item

`open → awaiting_reveal → revealed` (same soft-lock).

### Directed discussion item

`open → answered`.

### Community/moderation machines

Deferred until slices 3–5; dissolution/suspension must block publish when those exist.

### Race handling

Idempotent upserts on `(session, membership)`; transactional reveal checks; membership checks on every mutation; unique invite tokens; leak tests for partner content.

---

## 5. Data flow & errors

- Web uses Supabase Auth; API verifies Bearer JWT.  
- Formation and session mutations go through NestJS only.  
- GET session returns own answer + partner status until reveal; then both bodies.  
- Errors: 401 / 403 / 409 (invalid transition) / 400 validation / 410-or-409 invite / 500 without intimate payloads in logs.

---

## 6. Security, trust & safety

| Threat | Control |
|---|---|
| Private content leak | Server reveal gates + tests + light RLS |
| Account takeover | Supabase Auth; service role server-only |
| Coercive partner / DM abuse | No freeform DM in MVP; structured turns only |
| Fake couples / evasion | Email+invite; stronger ID before public launch |
| Invite spam | Expiry, revoke, rate limits |
| Privilege escalation | No client-trusted authz |
| Audit tampering | Append-only AuditEvent from API |
| Community harms | Manual report queue when community ships; no “automation is enough” |

Roadmap policy: do not build speculative safety subsystems for unpromoted features.

---

## 7. MVP definition & slices

### MVP foundation (ordered)

1. Couple formation  
2. Private conversation engine (themes/topics/prompts = content + selection to start; not full search)  
3. Opt-in community  
4. Publishing + joint approval  
5. Reporting & enforcement  

### First vertical slice (next implementation plan)

**User registration → partner invitation → couple activation**

- DB: User, Couple, CoupleMembership, CoupleInvitation, AuditEvent  
- API: auth guard, create couple, invite, accept  
- Web: signup/login, invite, accept  
- Tests: membership uniqueness, invite accept races, activation rules  
- Security: JWT verify, rate-limit invites, audit invite accept  

Session engine is **slice 2**, not scaffolded in slice 1 beyond leaving room in the monorepo.

### Post-MVP

See `docs/product/future-roadmap.md`. Directional only.

---

## 8. Documentation layout

| Path | Role |
|---|---|
| `docs/product/scope.md` | Authoritative product |
| `docs/product/future-roadmap.md` | Directional roadmap |
| `docs/engineering/build-brief.md` | Agent/engineering process |
| `project_scope.md` | Pointer only |
| `.cursor/rules/project_rules.mdc` | Points at product scope + roadmap policy |
| `docs/architecture/decisions/` | ADRs as choices lock |

---

## 9. Decisions required from product owner

1. Dual liability definition  
2. Custom prompt: start immediately vs partner accept first  
3. One vs many concurrent sessions  
4. Dissolution confirmation  
5. Session completed rule  
6. Confirm themes/topics MVP = content + start selection (not discovery/search)

## 10. Out of scope for scaffolding until slice plan

- NestJS/Drizzle codegen beyond slice 1 needs  
- Community tables  
- Reflection/history  
- Mobile app  
- AI, payments, affiliate, expert accounts  

---

## Spec self-review notes

- Placeholders: open questions listed explicitly; no silent defaults.  
- Consistency: community is MVP foundation but ordered after private engine; roadmap policy forbids speculative modelling.  
- Scope: platform design is broad; **implementation** should still proceed one vertical slice at a time via a separate plan.  
- Ambiguity: dual liability and custom-prompt start called out.
