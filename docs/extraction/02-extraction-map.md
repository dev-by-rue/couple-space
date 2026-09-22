# Extraction map — prototype → `apps/web`

Map visual / structural pieces onto **existing** `apps/web` conventions. Atomic design: atoms = `components/ui/`, molecules/organisms flat under those folders. Auth stays in `components/auth/`.

**Reuse policy:** rewrite product UI against your atoms. **Do not copy** prototype `components/ui/*` (Radix new-york ≠ Base UI lyra stack).

**Legend — Reuse:** as-is / adapt / rewrite / add-via-shadcn / skip

**Citation note (important):** Lovable originally shipped some routes as dense single-line JSX. `routes/index.tsx` is now formatted (~152 lines). Prefer **symbol name + file** over stale “L31” blobs. Line ranges below match the tree as of 2026-09-22.

**Two kinds of prototype UI**

1. **Named exports** in `between-us-source/src/components/couple-space.tsx` — extract as molecules/organisms.
2. **Inline route sections** in `routes/*.tsx` — not separate components in the prototype; decide whether to leave on the page or lift into a molecule when rewriting.

---

## UI components

### Hub — inline in `routes/index.tsx` (maps to `/couple`)

These are **not** named components in `couple-space.tsx`. Visual reference only.

| Prototype item | Type | Purpose | Where in MY structure | Reuse | Notes / risks |
|----------------|------|---------|----------------------|-------|---------------|
| Hub page composition (`Index`, L37–152) | page | Post-login couple home | `app/(app)/couple/page.tsx` | rewrite | Compose existing formation + new session list; Nest-backed |
| Hub header greeting + title (L51–59) | inline | “Good evening” / “You & Partner” | Prefer `CoupleMembersList` + `greetingForHour` | adapt | Prototype hard-codes evening; web already has time-based greeting |
| Invite-pending branch (L60–85) | inline + `InviteStatusCard` | Waiting education + disabled Start | Compose `InvitePartnerForm` / link display; optional chrome | rewrite | Don’t port toast / `example.com` from card |
| Welcome banner (L88–106) | inline | First-visit dismissible | Already partial on `couple/page.tsx` | adapt | `bg-accent-soft` → semantic soft surface |
| **Start CTA section (L107–115)** | inline | “A little time…” + link to `/start` | Page section or `molecules/start-conversation-cta.tsx` | rewrite | **Walking skeleton need**; copy still says “open your answers together” — change to per-user Reveal wording |
| Conversations list section (L116–136) | inline + `ConversationCard` | Empty state or card grid | `couple/page.tsx` + `conversation-card` | rewrite | Empty dashed box is inline (L132–134) |
| How it works collapsible (L137–144) | inline + `Steps` | Education | Collapsible + `how-it-works-steps` | rewrite | T1 polish OK; optional on active hub |
| Settings footer (L145–147) | inline + `DisabledSettings` | Coming soon | optional | rewrite | Low priority |

### Named components — `components/couple-space.tsx`

| Prototype item | Type | Purpose | Where in MY structure | Reuse | Dependencies | Notes / risks |
|----------------|------|---------|----------------------|-------|--------------|---------------|
| `PageShell` (L13–15) | layout | max-w 720 shell | layout class or thin shell | adapt | — | Align with `max-w-3xl` deliberately |
| `PageSkeleton` (L17–19) | molecule | Loading | `molecules/couple-page-skeleton.tsx` | rewrite | `ui/skeleton` | |
| `CoupleMark` (L21–23) | organism | Dual initials | `organisms/couple-mark.tsx` | **adapt** | members API | **Duplicate** — already exists |
| `Steps` (L25–28) | molecule | Education | `molecules/how-it-works-steps.tsx` | rewrite | lucide | “Open together” → per-user Reveal copy |
| `StatusPill` (L30–36) | molecule | Session status | `molecules/conversation-status-pill.tsx` | rewrite | `SessionViewerPhase` | Use Nest phase, not proto A/B/C/D |
| `ConversationCard` (L38–44) | molecule | Session list item | `molecules/conversation-card.tsx` | rewrite | status pill, Link | CTA: never “Reveal together” |
| `InviteStatusCard` (L46–49) | organism | Invite-pending panel | Prefer existing invite organisms | rewrite | real invite APIs | Stubs only in proto |
| `ThemeCard` (L51–53) | molecule | Theme picker | `molecules/theme-card.tsx` | rewrite | — | |
| `PromptComposer` (L55–59) | organism | Custom prompt | `organisms/prompt-composer.tsx` | rewrite | textarea | Later ticket (T3); not walking skeleton |
| `AnswerCard` (L61–63) | molecule | One person’s answer | `molecules/answer-card.tsx` | rewrite | — | |
| `RevealPanel` (L65–68) | organism | Show both answers | `organisms/session-reveal-panel.tsx` | rewrite | AnswerCard | Proto auto-reveals; we gate on per-user Reveal |
| `WaitingState` (L70–72) | molecule | Waiting for partner submit | `molecules/session-waiting.tsx` | rewrite | — | Update copy for per-user Reveal |
| `FollowUpCard` (L74–81) | organism | Optional follow-up | `organisms/follow-up-card.tsx` | rewrite | — | Later (T5) |
| `DirectedQuestionCard` (L83–89) | organism | Known directed Q | — | **skip** | — | Anonymous `/start` pool instead |
| `DisabledSettings` (L91–93) | molecule | Coming soon | optional | rewrite | tooltip | |
| `PrototypeControls` (L95–100) | — | DEV only | — | **skip** | — | Never extract |
| Reveal CTA | molecule | Per-user **Reveal** button | `molecules/session-reveal-button.tsx` | **new** | Nest reveal | **Missing in prototype** |

### Start + conversation routes

| Prototype item | Type | Purpose | Where in MY structure | Reuse | Notes |
|----------------|------|---------|----------------------|-------|-------|
| Start page (`routes/start.tsx` L23–34) | page | Theme/prompt selection | `app/(app)/start/page.tsx` | rewrite | Still dense single-line return; curated uses `ThemeCard`; prompt rows are **inline `<article>`** inside that return (not a named component) → lift to `prompt-list-item` |
| Conversation page (`routes/conversation.$id.tsx` L24–42) | page | Session UX | `app/(app)/conversation/[id]/page.tsx` | rewrite | Soft-lock banner + answer form + confirm Dialog are **inline** in the return (L42) → lift to `session-answer-form`; then `WaitingState` / `RevealPanel` |

### Atoms (`components/ui`)

| Need | Prototype uses | Where | Reuse | Notes |
|------|----------------|-------|-------|-------|
| Button | yes | existing `ui/button` | as-is | |
| Textarea | yes | — | **add-via-shadcn** | Do not copy prototype file |
| Dialog | yes | — | **add-via-shadcn** | Confirm submit |
| Tabs | yes | — | **add-via-shadcn** | Start curated/custom |
| Tooltip | yes | — | **add-via-shadcn** | Disabled Start / settings |
| Skeleton | yes | — | **add-via-shadcn** | |
| Collapsible | yes | — | **add-via-shadcn** | How it works |
| Sonner / toast | invite stubs | optional | skip or add later | Formation already has patterns |
| Input, Label, Field, Card, Separator | web has | existing | as-is | |
| Entire unused Radix kit | `components/ui/*` | — | **skip** | chart, sidebar, carousel, calendar, … |

### Auth / formation (already in web — do not re-extract from prototype)

| Item | Location | Notes |
|------|----------|-------|
| Login / register | `components/auth/*` | Prototype has none |
| Create couple / invite / accept | organisms already present | Hub invite-pending should compose these, not Lovable stubs |

---

## Hooks

| Prototype item | Type | Purpose | Where | Reuse | Notes |
|----------------|------|---------|-------|-------|-------|
| `useCouplePrototype` | context hook | Mock world | — | **skip** | Replace with React Query hooks |
| `useMe` / `useCouple` (web) | hooks | Session + couple | `hooks/*` | as-is | |
| `useThemes` / `useSessions` / `useSession` / mutations | hooks | Conversation engine | `hooks/use-themes.ts`, `use-sessions.ts`, … | **new** | Shape payloads for Nest redaction + per-user reveal |
| `use-mobile` (proto) | hook | sidebar | — | **skip** | Unused product |

---

## Services / API layer

| Item | Type | Purpose | Where | Reuse | Notes |
|------|------|---------|-------|-------|-------|
| `apiFetch` (web) | util | Cookie Nest client | `lib/api.ts` | as-is | No BFF |
| `mockDataSource` / provider | mock | — | — | **skip** | Fixtures OK only if JSON matches final Nest contract |
| Nest session/prompt/reveal APIs | service | Source of truth | `apps/api` (you design) | new | Web thin |

---

## Types / models

| Prototype item | Type | Purpose | Where | Reuse | Notes |
|----------------|------|---------|-------|-------|-------|
| `Member`, `Couple`, `Prompt`, `Theme`, `Session`, `Response` | types | Domain shapes | Prefer `@couple-space/domain` + API DTOs | rewrite | Add per-user `revealedAt` / reveal flag; attribution hidden for partner prompts |
| `FollowUp`, `DirectedQuestion` | types | Discussion | domain later | adapt / defer | Directed card model deferred; follow-ups optional |
| `memberName` | util | Display | `lib/member-name.ts` or domain | adapt | Duplicate risk if profiles added |
| `ConversationStatus` | enum | Hub pills | domain | rewrite | Must express: awaiting you / awaiting partner / ready to reveal (self) / revealed (self) / optional discussion — not proto A/B/C/D |

---

## Utilities

| Item | Purpose | Where | Reuse | Notes |
|------|---------|-------|-------|-------|
| `cn` | class merge | `lib/utils.ts` | as-is (both have) | |
| `greetingForHour` | greeting | `lib/greeting.ts` | as-is | Prefer over hard-coded evening |
| `productFlags.ts` | feature flags | Nest config / env — not a Lovable bool | rewrite | Cap 3, acceptance required |
| `reveal-once` / reduced-motion | motion | `globals.css` | adapt | Map to existing tokens |
| Semantic token map + multi-theme | theming | `globals.css` + small theme switch (dev/test) | **new** | Keep current brand default; themes override CSS vars |

---

## Duplicates with `apps/web` (flag)

| Prototype | Existing | Action |
|-----------|----------|--------|
| `CoupleMark` | `organisms/couple-mark.tsx` | Adapt one; do not add second |
| Welcome banner | `couple/page.tsx` | Merge into hub rewrite |
| Invite pending UI | `InvitePartnerForm`, `InviteLinkDisplay` | Compose; don’t port `InviteStatusCard` stubs |
| Button / cn / RHF / RQ | already present | Reuse |

---

## New dependencies from prototype — worth adding?

| Dependency | In prototype | Worth adding to web? |
|------------|--------------|----------------------|
| Extra `@radix-ui/*` mass | yes | **No** — use Base UI / existing shadcn pipeline |
| `sonner` | yes | Optional; only if you want toasts beyond current UX |
| `cmdk`, `recharts`, `embla`, `vaul`, `react-day-picker`, `input-otp` | yes | **No** — unused by product screens |
| TanStack Start / Router | yes | **No** — Next App Router |
| Newsreader / DM Sans | yes | **No** as brand default — Figtree stays; optional theme experiment only |

Atoms to **add when tickets need them** (via apps/web shadcn): Textarea, Dialog, Tabs, Tooltip, Skeleton, Collapsible.

---

## NOT to extract (and why)

| Item | Why |
|------|-----|
| `src/components/ui/**` wholesale | Wrong primitive stack; kitchen-sink unused |
| `CouplePrototypeProvider` / mocks as architecture | Throwaway; Nest is source of truth |
| `PrototypeControls` | DEV-only; teaches wrong status machine |
| Auto-reveal / “Reveal together” as behaviour | Conflicts with product decisions |
| `DirectedQuestionCard` as MVP | Anonymous `/start` pool is the direction |
| Lovable server/error/reporting | Scaffolding |
| Auth/register from plan | Already built; prototype excluded it |
| Route files as copy-paste | TanStack ≠ Next; rewrite pages thin |

---

## Token adoption pattern (recommendation)

1. **Default:** keep current `apps/web` `:root` tokens and Figtree.
2. **Semantic map** (document in CSS comments or a small `docs/extraction` appendix later): prototype intent → your var  
   - proto `bg-primary` / accent → `bg-primary` / `text-primary-foreground`  
   - proto `accent-soft` → soft primary/secondary surface you already have  
   - proto `waiting*` → introduce **semantic** `--waiting` (or map to secondary) so waiting UI is themeable without hard-coding blue  
3. **Multi-theme test:** alternate theme class/data attribute swapping the same CSS variable names — never fork components on hex values.
4. **Lock together only where UX requires a named role** (e.g. waiting state, reveal motion). Brand palette experiments stay at the token layer.
