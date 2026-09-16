# Web Brand Palette & Typography — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Couple Space brand palette (soft teal primary, soft sage secondary, warm ivory/charcoal surfaces) and Figtree typography to `apps/web` via existing shadcn CSS variables.

**Architecture:** No new color API — replace `:root` and `.dark` token values in `globals.css` with OKLCH equivalents of the locked hex spec. Swap `next/font` wiring in `layout.tsx` from Nunito Sans (+ unused Geist Sans) to Figtree; keep Geist Mono. Auth pages already use semantic Tailwind classes (`bg-muted`, `Button`, etc.) and pick up tokens automatically.

**Tech Stack:** Next.js `apps/web`, Tailwind CSS v4, shadcn CSS variables, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-08-31-web-brand-palette-design.md`

## Global Constraints

- Primary: soft teal; secondary: soft sage (hue, not gray); surfaces: warm ivory (light) / warm charcoal (dark).
- Neutrals: warm stone for `muted`, `border`, `input` only.
- Destructive: independent red — not a brand accent.
- Light and dark both first-class in CSS variables.
- UI typeface: Figtree via `next/font`; mono: Geist Mono only.
- No rose, pink, purple, or cool blue brand accents.
- Out of scope: landing redesign, illustrations, logo, per-page palettes, component API changes, native theming.
- **Git commits:** only when the user explicitly asks.

## File structure

```
apps/web/
  app/globals.css          # :root + .dark shadcn tokens (modify)
  app/layout.tsx           # Figtree font wiring (modify)
  app/login/page.tsx       # manual spot-check only (read)
  app/signup/page.tsx      # manual spot-check only (read, if present)
```

---

### Task 1: Brand color tokens in `globals.css`

**Files:**
- Modify: `apps/web/app/globals.css:51-118`

**Interfaces:**
- Produces: updated CSS custom properties consumed by all shadcn/Tailwind semantic classes (`bg-primary`, `text-muted-foreground`, `border-border`, etc.).

- [ ] **Step 1: Replace `:root` token block**

Replace the entire `:root { ... }` block (lines 51–84) with:

```css
:root {
  --background: oklch(0.966 0.006 59.7);
  --foreground: oklch(0.247 0.007 48.4);
  --card: oklch(0.981 0.004 56.4);
  --card-foreground: oklch(0.247 0.007 48.4);
  --popover: oklch(0.981 0.004 56.4);
  --popover-foreground: oklch(0.247 0.007 48.4);
  --primary: oklch(0.586 0.075 195.3);
  --primary-foreground: oklch(0.983 0.008 186.9);
  --secondary: oklch(0.855 0.023 151.6);
  --secondary-foreground: oklch(0.370 0.037 157.3);
  --muted: oklch(0.921 0.008 73.7);
  --muted-foreground: oklch(0.511 0.011 62.4);
  --accent: oklch(0.855 0.023 151.6);
  --accent-foreground: oklch(0.370 0.037 157.3);
  --destructive: oklch(0.541 0.148 28.5);
  --border: oklch(0.857 0.012 71.9);
  --input: oklch(0.857 0.012 71.9);
  --ring: oklch(0.668 0.073 195.5);
  --chart-1: oklch(0.668 0.073 195.5);
  --chart-2: oklch(0.855 0.023 151.6);
  --chart-3: oklch(0.511 0.011 62.4);
  --chart-4: oklch(0.480 0.065 195.3);
  --chart-5: oklch(0.370 0.037 157.3);
  --radius: 0.625rem;
  --sidebar: oklch(0.981 0.004 56.4);
  --sidebar-foreground: oklch(0.247 0.007 48.4);
  --sidebar-primary: oklch(0.586 0.075 195.3);
  --sidebar-primary-foreground: oklch(0.983 0.008 186.9);
  --sidebar-accent: oklch(0.855 0.023 151.6);
  --sidebar-accent-foreground: oklch(0.370 0.037 157.3);
  --sidebar-border: oklch(0.857 0.012 71.9);
  --sidebar-ring: oklch(0.668 0.073 195.5);
}
```

- [ ] **Step 2: Replace `.dark` token block**

Replace the entire `.dark { ... }` block (lines 86–118) with:

```css
.dark {
  --background: oklch(0.198 0.004 48.5);
  --foreground: oklch(0.952 0.008 61.5);
  --card: oklch(0.229 0.006 56.1);
  --card-foreground: oklch(0.952 0.008 61.5);
  --popover: oklch(0.229 0.006 56.1);
  --popover-foreground: oklch(0.952 0.008 61.5);
  --primary: oklch(0.668 0.073 195.5);
  --primary-foreground: oklch(0.198 0.004 48.5);
  --secondary: oklch(0.392 0.026 157.5);
  --secondary-foreground: oklch(0.855 0.023 151.6);
  --muted: oklch(0.272 0.007 48.4);
  --muted-foreground: oklch(0.736 0.014 63.9);
  --accent: oklch(0.392 0.026 157.5);
  --accent-foreground: oklch(0.855 0.023 151.6);
  --destructive: oklch(0.674 0.141 25.7);
  --border: oklch(0.372 0.011 56.0);
  --input: oklch(0.372 0.011 56.0);
  --ring: oklch(0.759 0.065 195.9);
  --chart-1: oklch(0.759 0.065 195.9);
  --chart-2: oklch(0.855 0.023 151.6);
  --chart-3: oklch(0.736 0.014 63.9);
  --chart-4: oklch(0.586 0.075 195.3);
  --chart-5: oklch(0.392 0.026 157.5);
  --sidebar: oklch(0.229 0.006 56.1);
  --sidebar-foreground: oklch(0.952 0.008 61.5);
  --sidebar-primary: oklch(0.668 0.073 195.5);
  --sidebar-primary-foreground: oklch(0.198 0.004 48.5);
  --sidebar-accent: oklch(0.392 0.026 157.5);
  --sidebar-accent-foreground: oklch(0.855 0.023 151.6);
  --sidebar-border: oklch(0.372 0.011 56.0);
  --sidebar-ring: oklch(0.759 0.065 195.9);
}
```

- [ ] **Step 3: Verify build compiles CSS**

Run from repo root:

```bash
pnpm --filter web exec next build
```

Expected: build succeeds with no CSS errors.

---

### Task 2: Figtree typography in `layout.tsx`

**Files:**
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `--font-sans` / `--font-heading` references in `globals.css` `@theme inline`.
- Produces: Figtree loaded via `next/font`, applied on `<html>`; Geist Mono retained on `--font-mono`.

- [ ] **Step 1: Replace font imports and wiring**

Replace the full contents of `apps/web/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Couple Space",
  description: "Private couple space",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased font-sans", figtree.variable, geistMono.variable)}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Confirm no remaining Nunito / Geist Sans references**

Run:

```bash
rg -n "Nunito|geist-sans|Geist[^_]|Geist," apps/web
```

Expected: no matches (only `Geist_Mono` in `layout.tsx`).

- [ ] **Step 3: Verify build**

Run:

```bash
pnpm --filter web exec next build
```

Expected: PASS.

---

### Task 3: Manual acceptance on auth surfaces

**Files:**
- Read: `apps/web/app/login/page.tsx`
- Read: `apps/web/app/signup/page.tsx` (if it exists)

**Interfaces:**
- Consumes: Task 1 tokens + Task 2 font wiring.

- [ ] **Step 1: Start dev server**

```bash
pnpm --filter web dev
```

Open `http://localhost:3000/login`.

- [ ] **Step 2: Light-mode checklist**

Confirm visually:

- Page background is warm ivory (not pure white / cool gray).
- Primary button is soft teal; any secondary/outline controls read as sage or warm stone — not stock blue.
- Body text uses Figtree (rounded humanist sans — distinct from prior Nunito/Geist).
- Error text: if present, prefer `text-destructive` over hardcoded `text-red-600` on login (one-line fix only if you touch the file during spot-check).

- [ ] **Step 3: Dark-mode checklist**

In DevTools, add class `dark` to `<html>` (no theme toggle required for this pass).

Confirm:

- Background is warm charcoal (not cool blue-gray).
- Primary teal is lighter (`#5AA3A3` equivalent); text remains readable.
- Secondary sage fills are visible and distinct from primary teal.
- Destructive red is independent from teal/sage.

- [ ] **Step 4: Repeat on signup**

Open `http://localhost:3000/signup` — same checks in light and `.dark`.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Soft teal primary | Task 1 |
| Soft sage secondary/accent | Task 1 |
| Warm ivory / charcoal surfaces | Task 1 |
| Warm stone neutrals | Task 1 |
| Independent destructive red | Task 1 |
| Light + dark first-class | Task 1 |
| Figtree UI font | Task 2 |
| Geist Mono retained | Task 2 |
| Remove Nunito / unused Geist Sans | Task 2 |
| Sidebar tokens aligned | Task 1 |
| Auth screens branded (acceptance) | Task 3 |
| No component/layout rewrites | Tasks 1–2 only touch tokens/fonts |
