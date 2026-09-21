# Multi-Palette Theme Lab — Design

**Date:** 2026-09-22  
**Status:** Approved for implementation  
**Product source of truth:** `docs/product/scope.md`  
**Applies to:** `apps/web` (Tailwind v4 `@theme` + CSS variables)  
**Related:** `docs/superpowers/specs/2026-08-31-web-brand-palette-design.md` (harbor = current brand)

## 1. Goal

Port between-us semantic token mapping into `apps/web`, structure colors as named palettes (not color values on `:root`), and add a removable dev-only floating switcher so we can compare warm, intimate looks (light + dark) without shipping a product theming feature.

## 2. Decisions locked

| Topic | Choice |
|---|---|
| Audience | Development / design exploration only |
| Default palette | `harbor` (soft teal-slate on warm paper; matches Aug 31 brand) |
| Exploration palettes | `sage`, `honey`, `blush`, `clay` (bottom of CSS for easy deletion) |
| Modes | Every palette has light + dark |
| Switcher | Floating picker; `NEXT_PUBLIC_THEME_LAB=1` gated; `localStorage` |
| Teardown | One layout import + delete `components/dev/` + delete bottom CSS block |
| Color host | `[data-palette="…"]` on `<html>`; dark via existing `.dark` class |
| Shared on `:root` | Radius, fonts, soft shadows only — no palette colors |
| Extra tokens | Port `surface`, `accent-soft`, `waiting*`, `destructive-foreground` |
| Fonts | Keep Figtree + Geist Mono; add display (Newsreader) for `font-display` |
| Out of scope | User-facing theme product, backend persistence, URL query switching |

## 3. Token mapping

Unchanged shadcn pattern:

- CSS custom property: `--muted-foreground`
- `@theme inline`: `--color-muted-foreground: var(--muted-foreground)`
- Utility: `text-muted-foreground`

Same pattern for all semantic colors, including extras:

| Token | Utility examples |
|---|---|
| `--surface` | `bg-surface` |
| `--accent-soft` | `bg-accent-soft` |
| `--waiting` / `--waiting-soft` / `--waiting-foreground` / `--waiting-border` | `bg-waiting-soft`, `text-waiting-foreground`, `border-waiting-border` |
| `--shadow-soft` / `--shadow-panel` | `shadow-soft`, `shadow-panel` |
| `--font-display` | `font-display` |

## 4. CSS file structure (`apps/web/app/globals.css`)

1. Imports + `@custom-variant dark`
2. `@theme inline` — full color + radius + font + shadow maps
3. `:root` — shared non-color tokens only
4. **Default palette** — `[data-palette="harbor"]` and `html.dark[data-palette="harbor"]`
5. Base layer
6. **Exploration block (BOTTOM, marked)** — sage / honey / blush / clay × light/dark

When exploration ends: delete section 6 only; keep harbor as the sole palette (or later fold harbor values back if desired). HTML may keep `data-palette="harbor"` indefinitely as a stable hook.

## 5. Palette directions

All values in **oklch**. Direction (not final pixel tuning in this spec):

| ID | Feel |
|---|---|
| `harbor` | Soft teal primary, sage secondary, warm ivory/charcoal — brand default |
| `sage` | Between-us moss on warm cream |
| `honey` | Amber-ochre evening warmth |
| `blush` | Dusty rose on linen (adult, not candy) |
| `clay` | Olive primary + earthy clay secondary |

Visual intent: warm, intimate, friendly, safe space for adults — avoid purple glow, candy pink, and terracotta-cream cliché.

Harbor light/dark color values should stay aligned with the Aug 31 brand spec (already present in current `globals.css` OKLCH). Exploration palettes are authored from the brainstorming companion directions and between-us sage source.

## 6. Theme lab

**Location:** `apps/web/components/dev/theme-lab.tsx` (folder is wholly temporary)

**Gate:** Render only when `process.env.NEXT_PUBLIC_THEME_LAB === "1"`.

**Behavior:**

- Floating control: palette select + light/dark toggle
- Sets `document.documentElement.dataset.palette` and toggles `.dark`
- Persists `cs-theme-lab:palette` and `cs-theme-lab:dark` in `localStorage`
- On mount (client): re-apply stored values
- When flag is off: do not mount; do not read storage; SSR default remains harbor

**Root layout:**

- `<html data-palette="harbor" …>`
- Conditionally mount `<ThemeLab />` when flag is set
- Load Newsreader as `--font-display`

**Teardown checklist** (also as file header comment in theme-lab):

1. Remove layout mount + unset `NEXT_PUBLIC_THEME_LAB`
2. Delete `apps/web/components/dev/`
3. Delete exploration CSS block at bottom of `globals.css`
4. Optionally clear `localStorage` keys in the browser

## 7. Verification

- Lab on: switch each of 5 palettes × light/dark on couple and auth pages; utilities resolve
- Lab off: always harbor; no picker
- `font-display` renders on couple page headings
- `text-muted-foreground` / `bg-primary` / surface & waiting utilities work under harbor

## 8. Non-goals

- Product “choose your couple theme” feature
- Query-param or shareable theme URLs
- Committing exploration palettes as permanent product surface after the lab is removed
