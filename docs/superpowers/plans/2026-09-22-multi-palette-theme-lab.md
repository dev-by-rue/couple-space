# Multi-Palette Theme Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port between-us token mapping into `apps/web`, host colors on named `data-palette` selectors (harbor default + four exploration palettes), and add a removable `NEXT_PUBLIC_THEME_LAB` floating switcher.

**Architecture:** `@theme inline` maps CSS vars to Tailwind utilities. Shared radius/fonts/shadows live on `:root`. Palette colors live on `[data-palette="…"]` and `html.dark[data-palette="…"]`. Exploration palettes sit at the bottom of `globals.css`. Theme lab is a single gated client component.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, `next/font` (Figtree, Geist Mono, Newsreader), CSS custom properties (oklch)

## Global Constraints

- Dev-only theme lab; product theming is out of scope
- Default palette id is `harbor` (Aug 31 brand OKLCH)
- Exploration palettes: `sage`, `honey`, `blush`, `clay` — bottom of CSS only
- Gate: `NEXT_PUBLIC_THEME_LAB=1`
- localStorage keys: `cs-theme-lab:palette`, `cs-theme-lab:dark`
- Do not commit secrets; do not auto-commit unless user asks (workspace rule)

---

### Task 1: Restructure `globals.css` tokens + harbor + exploration palettes

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces: `--color-*` theme maps including `surface`, `accent-soft`, `waiting*`, `destructive-foreground`, `font-display`, `shadow-soft`, `shadow-panel`
- Produces: `[data-palette="harbor"|…]` light/dark color blocks

- [ ] **Step 1:** Rewrite `globals.css` per spec §3–5: shared `:root`, harbor blocks from current brand OKLCH + derived extras, exploration block at bottom with sage (between-us), honey, blush, clay light+dark
- [ ] **Step 2:** Visually spot-check (or typecheck) that file has no `:root` color tokens left

### Task 2: Fonts + `data-palette` + ThemeLab mount

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `.env.example`
- Modify: `.gitignore` (add `.superpowers/`)
- Create: `apps/web/components/dev/theme-lab.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_THEME_LAB`
- Produces: `<html data-palette="harbor">` + optional `<ThemeLab />`
- ThemeLab sets `dataset.palette` and `.dark`; persists localStorage

- [ ] **Step 1:** Add Newsreader `--font-display`; set `data-palette="harbor"`; mount ThemeLab when flag is `"1"`
- [ ] **Step 2:** Implement ThemeLab floating UI (palette select + dark toggle) with teardown comment header
- [ ] **Step 3:** Document `NEXT_PUBLIC_THEME_LAB` in `.env.example`; ignore `.superpowers/`

### Task 3: Verify

- [ ] **Step 1:** Run `pnpm --filter web exec tsc --noEmit` (or project equivalent) and fix errors
- [ ] **Step 2:** Confirm lab gate and utilities mentally against couple page (`font-display`, `text-muted-foreground`)
