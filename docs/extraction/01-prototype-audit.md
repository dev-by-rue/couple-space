# Prototype audit — `between-us-source`

**Role of this prototype:** visual / IA reference for Couple Space private product surfaces.  
**Not authoritative for behaviour.** Behaviour comes from [`docs/product/scope.md`](../product/scope.md) and decisions recorded in [`03-requirements.md`](./03-requirements.md).

**Authority stack**

| Source | Use for |
|--------|---------|
| `docs/product/scope.md` + clarified product decisions | MVP behaviour, privacy rules, direction of final product |
| `between-us-source` | Screens, layout vocabulary, UI states, copy tone |
| `apps/web` | Structure, conventions, tooling (do not restructure to match Lovable) |

Do not scaffold prototype-wrong behaviour (auto-reveal, DEV state machines, known directed-card as the final model) intending to rip it out later.

---

## 1. Screens / routes (visual map)

Prototype stack: TanStack Start + file routes (ignore for implementation).

| Prototype route | Visual role | Maps to in `apps/web` |
|-----------------|-------------|-------------------------|
| `/` — `src/routes/index.tsx` | Post-login couple hub (invite-pending **or** active) | `/couple` |
| `/start` — `src/routes/start.tsx` | Theme/prompt selection + custom tab | `/start` (new) |
| `/conversation/$id` — `src/routes/conversation.$id.tsx` | Answer → wait → reveal → discussion | `/conversation/[id]` (new) |
| `__root.tsx` | Providers, 404/error, DEV controls | Existing root + `(app)` gate; **no** PrototypeControls |

```
/couple  ──(active)──►  /start  ──►  /conversation/[id]
   ▲                       │                │
   └───────────────────────┴────────────────┘
```

Evidence: navigation and gates in `index.tsx` L29–31; start → conversation in `start.tsx` L28–30; back links in `conversation.$id.tsx` L34, L42.

---

## 2. User flows (as drawn in the prototype)

### Invite-pending hub
- Partner not fully joined → `InviteStatusCard`, Steps education, Start disabled (`index.tsx` L29–31; `couple-space.tsx` L46–48).
- Invite actions are **stubs** (toast + hard-coded URL).

### Active hub
- Optional welcome banner (`index.tsx` L31; provider `firstVisit` L34).
- Start CTA → `/start`; conversation list or empty dashed state (`index.tsx` L31).
- “How it works” collapsible + disabled settings (`index.tsx` L31; `couple-space.tsx` L91–92).

### Start
- Curated: theme grid → prompt list → Start (`start.tsx` L34).
- Custom: composer 280 chars; prototype starts immediately when flag false (`start.tsx` L29–30; `productFlags.ts` L1–2).

### Conversation (prototype behaviour — **do not copy as product rules**)
- Soft-lock banner; partner “has answered” without content (`conversation.$id.tsx` L42).
- Confirm dialog; irreversible submit.
- Waiting UI if partner not done (`WaitingState`, `couple-space.tsx` L70–71).
- When both submitted → **auto** `RevealPanel` (no Reveal button) (`conversation.$id.tsx` L37–42; TODO L39).
- Discussion only if `status === "in_discussion"` — **unreachable** via normal submit (provider `submitResponse` L69–72 never advances status; DEV controls L95–100).

---

## 3. Feature list as behaviour (“A user can…”)

### Visual behaviours worth preserving (UX intent)
- See a calm hub with greeting, partner-facing title, dual avatar mark.
- See invite-pending vs active states with education (“How it works”).
- Dismiss a first-visit welcome.
- Browse conversations with status + CTA; see empty list.
- Choose curated themes/prompts; compose a custom question (UI).
- Answer privately with lock messaging and submit confirmation.
- Wait for partner after submitting.
- See loading skeletons and missing-conversation / couple-load failure copy.

### Product behaviours (authoritative — not “because Lovable did it”)
See `03-requirements.md`. Short list locked in brainstorming:

- Soft-lock: no partner **answer content** until both have submitted.
- After both submitted: each partner taps **Reveal** for themselves (Nest-owned).
- Custom prompts: per-partner cap **3**; partner **accept or discard**; queue of conversations.
- Partner-created prompts appear **anonymously in `/start` catalog**; labelled partner-created after both answered and each has revealed (requires `scope.md` promotion — see gaps).
- Guided discussion unlocks only after **both** have revealed; follow-ups optional; partners may choose a follow-up, ask their own later model, or take it offline.
- Formation/auth: already in `apps/web` + Nest — prototype out of scope by its own plan (`.lovable/plan/...` L21–23).

---

## 4. Implicit rules the prototype encodes (treat as hypotheses)

| Prototype implication | Evidence | Product stance |
|----------------------|----------|----------------|
| Active iff every member `emailVerified && inviteAccepted` | `index.tsx` L29 | Aligns with formation; keep Nest truth |
| Cannot start until active | `index.tsx` L31 | Keep |
| Soft-lock until both submit | `conversation.$id.tsx` L42; plan L13 | Keep; Nest redacts |
| Auto-reveal when both submit | L37–42; TODO L39 | **Reject** — per-user Reveal |
| Card CTA “Reveal together” | `couple-space.tsx` L34, L42 | **Reject** copy/model — use **Reveal** (self) |
| Follow-ups / directed only at `in_discussion` | `conversation.$id.tsx` L38 | Discussion after **both** revealed; optional |
| Directed answer visible on recipient submit | `DirectedQuestionCard` L83–88 | **Reject** as MVP model — anonymous `/start` pool instead |
| Custom starts immediately | `productFlags.ts` L2 | **Reject** — accept/discard + cap 3 |
| Names from email local-part | `types/couple.ts` L68–74 | Accept for MVP until profiles exist |
| Exactly two members in UI | partner `find` patterns | MVP two-person; prefer membership rows in Nest |

---

## 5. UI states inventory

| State | Prototype evidence | Notes for real app |
|-------|-------------------|-------------------|
| Loading skeleton | `pendingComponent` + `PageSkeleton` L17–18 | Keep pattern; wire to React Query |
| Couple load failure | `index.tsx` L28 | Map to query error |
| Invite pending | `index.tsx` L29–31 | Use real invite APIs, not stubs |
| First-visit welcome | L31; not persisted | Prefer preference or accept ephemeral |
| Empty conversations | L31 | Keep |
| Empty themes | `start.tsx` L32 | Keep |
| Answering / partner answered first | `conversation.$id.tsx` L42 | Keep messaging; redact content in API |
| Submit confirm | Dialog L42 | Keep |
| Waiting | `WaitingState` L70–71 | Update copy for per-user Reveal |
| Ready to reveal (self) | **Missing in prototype** | Required for MVP |
| Revealed (self) | `RevealPanel` L65–67 (auto) | Show only after own Reveal |
| Discussion | L38, L42 | After both revealed; optional |
| 404 / error | `__root.tsx` | Use Next patterns |
| Settings disabled | L91–92 | Optional stub OK |

---

## 6. Mocked / hard-coded data → real contract needs

| Mock | Location | Real need (Nest-owned) |
|------|----------|-------------------------|
| Couple + members | `mocks/data.ts` L3–6, L47 | Existing `GET /couples/me` |
| Themes / prompts | L8–43 | `GET` catalog (curated + eligible anonymous partner prompts) |
| Sessions list/detail | L49–64; provider | `GET` sessions; redacted detail |
| Start curated | provider L89–94 | `POST` session `{ promptId }` |
| Start custom | L97–101 | Propose → accept/discard → queue (not instant start) |
| Submit answer | L69–72 | `POST` response; immutable |
| Reveal | **absent** | `POST` reveal for current user; per-user visibility |
| Follow-up / directed | L74–87 | Later; optional follow-ups after both revealed |
| Invite resend/copy | `InviteStatusCard` L47–48 | Existing invitation endpoints |
| Viewer | `viewerId` state | Session `/me` |
| “Good evening” / “Just now” | `index.tsx` L31; card L43 | Time-based greeting (web already has `greetingForHour`); real `updatedAt` |
| PrototypeControls | L95–100 | Never ship |

`CoupleDataSource` (`types/couple.ts` L62–66) is unused by the provider — ignore as architecture.

---

## 7. Gaps, inconsistencies, questions before building

### Prototype defects (do not preserve)
1. `submitResponse` never advances status → discussion unreachable without DEV (`CouplePrototypeProvider.tsx` L69–72 vs `conversation.$id.tsx` L38).
2. Reveal UX mismatch: cards say “Reveal together”; detail auto-reveals (`couple-space.tsx` L42 vs `conversation.$id.tsx` L39–42).
3. Seed draft texts unused by empty local textarea (`data.ts` L55–56 vs conversation `useState("")`).
4. Plan asked “dusty-rose”; tokens are green/olive + waiting blue (`styles.css`; plan L16).

### Product / scope alignment
5. **Promote into `scope.md`:** anonymous partner prompts in `/start` catalog; per-user Reveal; custom accept/discard + cap 3 + queue. Current scope still describes directed partner Qs with answer visible on submit (`scope.md` L20–22) and leaves custom acceptance open (L68).
6. Unanswered / never-started pool items: expiry vs withdraw — still open (lean Nest config; discard never-shown answers).
7. Concurrent sessions: queue implies many; confirm Nest allows multiple open sessions (scope open question L69).
8. Session “completed” rule — still open (`scope.md` L71).
9. Display names vs email-derived names.

### Visual
10. Prototype fonts (Newsreader + DM Sans) vs locked Figtree brand — **do not swap brand**; use semantic token mapping + multi-theme testing (`02-extraction-map.md`).

---

## 8. Ignored Lovable / scaffolding (explicit)

- TanStack Start / Router / Nitro / Vite / `routeTree.gen.ts`
- `@lovable.dev/*`, `src/server.ts`, `src/start.ts`, `src/lib/error-*.ts`, `lovable-error-reporting.ts`
- `PrototypeControls` and all DEV-only state forcing
- Unused shadcn/Radix kitchen-sink under `src/components/ui/` (see `02`)
- Generic Lovable `README.md` / `AGENTS.md` process warnings
- React Query wired but unused for product data (`__root.tsx` / `router.tsx`)
- Brand name “Between Us” in meta — product is Couple Space

---

## 9. Visual tokens (reference only)

`src/styles.css`: warm neutrals, green/olive primary, `--waiting*` cool blue, `--radius-card`, `reveal-once` motion, `prefers-reduced-motion`. Map intents onto `apps/web` CSS variables; do not replace the locked brand wholesale.
