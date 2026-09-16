# Web Brand Palette & Typography — Design

**Date:** 2026-08-31  
**Status:** Approved for planning  
**Product source of truth:** `docs/product/scope.md`  
**Applies to:** `apps/web` (shadcn + Tailwind CSS variables)

## 1. Goal

Define a warm, friendly, professional brand color system and typography for the Couple Space web UI — private-first and couple-centric, not dating-app aesthetics — with light and dark modes as first-class equals.

## 2. Why

- Current UI uses stock shadcn cool blues; it does not signal product identity.
- Product principles emphasize privacy, consent, calm mutual-reveal conversation, and explicit non-goals (dating / hookup / anonymous social). Visual language should reinforce trust and quiet intimacy without romance-marketing cues.
- Auth and formation screens ship next; branding tokens should land before those surfaces feel “generic SaaS.”

## 3. Decisions locked

| Topic | Choice |
|---|---|
| Primary | Soft teal |
| Secondary | Soft sage (hue, not gray) |
| Surfaces | Warm ivory (light) / warm charcoal (dark) |
| Neutrals | Warm stone for muted, border, input |
| Destructive | Independent red (errors / destructive actions only) |
| Modes | Light and dark both first-class |
| UI typeface | Figtree (humanist sans) via `next/font` |
| Mono | Geist Mono (rare technical strings only) |
| Display / serif | None — one sans for body and headings |
| Rejected primaries | Rose/blush, coral-rose, wine rose, peach, lavender, navy, clay (as primary) |
| Rejected secondaries | Gray-as-secondary; peach/clay (user chose sage) |

## 4. Color system

Hex values are the review source of truth. Implementation maps them into existing shadcn CSS variables as OKLCH (matching current `globals.css` style).

### 4.1 Light

| Token | Hex | Role |
|---|---|---|
| `background` | `#F7F3F0` | Page surface (warm ivory) |
| `card` / `popover` | `#FBF8F6` | Elevated surface |
| `foreground` | `#24201E` | Primary text |
| `primary` | `#3E8A8A` | CTAs, links, brand accent |
| `primary-foreground` | `#F4FBFA` | Text on primary |
| `secondary` | `#C5D4C8` | Secondary buttons, chips, soft highlights |
| `secondary-foreground` | `#2F4638` | Text on secondary |
| `muted` | `#E8E4DF` | Quiet fills |
| `muted-foreground` | `#6B6560` | Secondary text |
| `accent` | `#C5D4C8` | Hover/soft highlight (same as secondary) |
| `accent-foreground` | `#2F4638` | Text on accent |
| `border` / `input` | `#D5CFC8` | Structure |
| `ring` | `#5AA3A3` | Focus ring (teal) |
| `destructive` | `#B5453A` | Errors / destructive only |

### 4.2 Dark

| Token | Hex | Role |
|---|---|---|
| `background` | `#171514` | Warm charcoal (not cool slate) |
| `card` / `popover` | `#1F1C1A` | Elevated surface |
| `foreground` | `#F3EEEA` | Primary text |
| `primary` | `#5AA3A3` | CTAs / links (lighter teal for contrast) |
| `primary-foreground` | `#171514` | Text on primary |
| `secondary` | `#3A4A40` | Secondary fills |
| `secondary-foreground` | `#C5D4C8` | Text on secondary |
| `muted` | `#2A2624` | Quiet fills |
| `muted-foreground` | `#B0A8A1` | Secondary text |
| `accent` | `#3A4A40` | Same as secondary |
| `accent-foreground` | `#C5D4C8` | Text on accent |
| `border` / `input` | `#453F3B` | Structure |
| `ring` | `#7EBEBE` | Focus ring |
| `destructive` | `#E07068` | Errors / destructive only |

### 4.3 Rules

- Soft teal is the **only** brand accent for primary actions, text links, and focus rings.
- Soft sage is the **secondary brand hue** — never replace it with gray for `secondary` / `accent`.
- Warm stone neutrals are for structure (`muted`, `border`, `input`) only.
- No rose, pink, purple, or cool blue brand accents.
- Sidebar tokens follow the same surface / primary / accent system as the main theme.
- Chart tokens may reuse teal → sage → warm stone steps; exact chart sequence can be derived at implementation time from the locked hues.

## 5. Typography

- **UI / body / headings:** Figtree (`next/font/google`), wired to `--font-sans` and `--font-heading`.
- **Mono:** keep Geist Mono on `--font-mono`.
- **Remove:** Nunito Sans (and unused Geist Sans variable if it is not required after the switch).
- Weights: regular/medium for body; semibold/bold for headings and buttons — same family, no second display face.

## 6. Application (implementation boundary)

### In scope

- Update `apps/web/app/globals.css` `:root` and `.dark` variables to the locked palette.
- Update `apps/web/app/layout.tsx` to load Figtree and drop Nunito Sans.
- Spot-check auth/login (and any existing themed surfaces) in light and dark.

### Out of scope

- Marketing landing redesign, illustration, or logo mark.
- Per-page custom palettes or decorative gradient systems.
- Component API or layout rewrites — tokens and font wiring only.
- Native app theming (later).

## 7. Acceptance checks

- Login and auth screens read as branded in **both** light and dark.
- Primary (teal) vs secondary (sage) buttons are clearly distinct.
- Body/UI text renders in Figtree; Nunito is gone.
- Dark mode stays warm charcoal, not cool blue-gray.
- Destructive remains visually independent from brand teal/sage.
- Basic contrast: primary buttons and body text remain readable on ivory and charcoal (manual spot-check).

## 8. Product alignment

- Private-first / consent-first product → calm teal + grounded sage, not dating pinks or loud coral.
- Warm ivory surfaces keep friendliness; teal primary keeps professionalism.
- Dual light/dark equals product seriousness without defaulting to “tech dark mode” blues.
