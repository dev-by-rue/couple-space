# Extraction map — prototype → `apps/web`

Map visual / structural pieces onto **existing** `apps/web` conventions. Atomic design: atoms = `components/ui/`, molecules/organisms flat under those folders. Auth stays in `components/auth/`.

**Reuse policy:** rewrite product UI against your atoms. **Do not copy** prototype `components/ui/*` (Radix new-york ≠ Base UI lyra stack).

**Legend — Reuse:** as-is / adapt / rewrite / add-via-shadcn / skip

---

## UI components

### Organisms

| Prototype item | Type | Purpose | Where in MY structure | Reuse | Dependencies | Notes / risks |
|----------------|------|---------|----------------------|-------|--------------|---------------|
| Hub composition (`index.tsx` L24–31) | organism / page | Post-login couple home | `app/(app)/couple/page.tsx` + organisms | rewrite | `useCoupleMeQuery`, session list hooks | Evolve current page; keep Nest formation |
| `CoupleMark` (`couple-space.tsx` L21–22) | organism | Dual initials | `components/organisms/couple-mark.tsx` | **adapt** | members from API | **Duplicate** — already exists; align waiting/accent mapping to tokens |
| `CoupleMembersList` / greeting (web) | organism | Hub header | `couple-members-list.tsx` | as-is / adapt | `greetingForHour` | Keep; prototype hard-codes “Good evening” |
| `InviteStatusCard` (L46–48) | organism | Invite-pending panel | Prefer existing `InvitePartnerForm` + link display; optional new organism for waiting chrome | rewrite | real invite APIs | **Do not** port toast stubs / example.com URL |
| `ConversationCard` + `StatusPill` (L30–43) | molecule / organism | Session list item | `molecules/conversation-card.tsx`, status pill molecule | rewrite | session DTO + per-user reveal status | CTA copy must be **Reveal** / waiting / answer — not “Reveal together” |
| `Steps` (L25–27) | molecule | Education | `molecules/how-it-works-steps.tsx` | rewrite | lucide | Update “Open together” copy to match per-user Reveal |
| Welcome banner (`index.tsx` L31) | molecule / inline | First visit | Already partially on `couple/page.tsx` L35–54 | adapt | local or preference | Token: prototype `bg-accent-soft` → map to semantic soft surface |
| `DisabledSettings` (L91–92) | molecule | Coming soon | optional footer | rewrite | tooltip atom when added | Low priority |
| Start page shell (`start.tsx`) | page | Prompt selection | `app/(app)/start/page.tsx` | rewrite | themes query | Gate: couple active |
| `ThemeCard` (L51–52) | molecule | Theme picker | `molecules/theme-card.tsx` | rewrite | — | Emoji `symbol` OK for MVP content |
| Prompt list articles (`start.tsx` L34) | molecule | Prompt row + Start | `molecules/prompt-list-item.tsx` | rewrite | — | Later: mix anonymous partner prompts without attribution |
| `PromptComposer` (L55–58) | organism | Custom prompt propose | `organisms/prompt-composer.tsx` | rewrite | textarea atom | Wire to propose/accept — **not** instant `startCustomPrompt` |
| Conversation page (`conversation.$id.tsx`) | page | Session UX | `app/(app)/conversation/[id]/page.tsx` | rewrite | session hooks | States: answer / wait / reveal CTA / revealed |
| Soft-lock banner + answer form (L42) | organism | Private answer | `organisms/session-answer-form.tsx` | rewrite | dialog, textarea | Confirm submit |
| `WaitingState` (L70–71) | molecule | Waiting for partner submit | `molecules/session-waiting.tsx` | rewrite | waiting token map | Copy: reveal is per-user later |
| Reveal CTA (missing in proto) | molecule | Per-user Reveal | `molecules/session-reveal-button.tsx` | **new** | Nest reveal | Final-shaped; do not build auto-reveal |
| `RevealPanel` / `AnswerCard` (L61–67) | organism / molecule | Show answers after reveal | `organisms/session-reveal-panel.tsx`, `molecules/answer-card.tsx` | rewrite | — | Only after **viewer** revealed |
| `FollowUpCard` (L74–80) | organism | Optional curated follow-up | `organisms/follow-up-card.tsx` | rewrite | — | Later ticket; soft-lock; optional choose |
| `DirectedQuestionCard` (L83–88) | organism | Known directed Q | — | **skip** for MVP UI | — | Product chose anonymous `/start` pool instead; do not scaffold this as final |
| `PageShell` (L13–14) | layout util | max-w 720 | shared layout class or `CoupleSpaceShell` organism | adapt | — | Align with current `max-w-3xl` or unify deliberately |
| `PageSkeleton` (L17–18) | molecule | Loading | `molecules/couple-page-skeleton.tsx` | rewrite | skeleton atom | Add skeleton via shadcn if missing |
| `PrototypeControls` (L95–100) | — | DEV only | — | **skip** | — | Never extract |

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
