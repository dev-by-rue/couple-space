# P1-20 · Hardening (T6)

[← Phase 1](../board.md) · Size **M** · After: [P1-18](P1-18-error-monitoring.md) · Last code task before [P1-22](../board.md)

**Goal:** a polish pass covering skeletons instead of "Loading…" text, keyboard paths, focus rings,
reduced motion, small phone widths, and no stray `console.log`s.

**Done when:** each section below is applied and its check passes. The final verification is a
keyboard-only and 320px-wide run through the whole loop.

### Flags

- **"Dismiss welcome" doesn't exist.** `WelcomeBanner` has no dismiss button today. Either drop it from
  the task, or add one (Step 4c shows the version without `useState`). It's a small product call: is the
  quote meant to stay?
- **No new libraries.** Everything uses Tailwind's `motion-safe:` / `motion-reduce:` and the existing
  `Skeleton`.

---

## Step 1 · Remove stray `console.log`s

### `apps/web/app/api/relationship-quote/route.ts` (change)
**Before**
```ts
  const data = (await res.json()) as NinjaQuote[];
  const quote = data[0];

  console.log(quote)
  console.log(categories)
  console.log(data)
  if (!quote?.quote) {
```
**After**
```ts
  const data = (await res.json()) as NinjaQuote[];
  const quote = data[0];

  if (!quote?.quote) {
```

### `apps/web/lib/api/quotes.ts` (change)
**Before**
```ts
  if (!res.ok) {
    const body = await res.text();
    console.log(body)
    throw new Error(`Quote ${res.status}: ${body}`);
  }
```
**After**
```ts
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Quote ${res.status}: ${body}`);
  }
```

### Keep them out: `apps/web/eslint.config.mjs` (change)
Add a rule to the existing config object (match its shape):
```js
  {
    rules: {
      // Logs reach the browser console and Railway; answers must never be in them (Q17).
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
```
For the API, oxlint has the same rule. In `apps/api/oxlint.json`, add `"no-console": "error"` under
`rules` (Nest code uses `Logger`). Scripts in `packages/database` print with `console.log` on purpose
and aren't linted.

**Check:** `pnpm lint` passes; `rg -n "console\.log" apps/web/app apps/web/components apps/web/hooks apps/web/lib` finds nothing.

---

## Step 2 · Reduced motion

### `apps/web/app/globals.css` (change)
**Before**
```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```
**After**
```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }

  /* Catch-all for anything not already written with motion-safe: */
  @media (prefers-reduced-motion: reduce) {
    *,
    ::before,
    ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```
`SessionRevealPanel` already uses `motion-safe:animate-in`, which is the preferred pattern. The CSS
catch-all covers `transition-*` classes in cards and the `Skeleton` pulse.

### `apps/web/components/molecules/prompt-card/prompt-card.tsx` (change)
**Before**
```tsx
          className="size-4 transition-transform group-hover:translate-x-0.5"
```
**After**
```tsx
          className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
```
Movement is the thing reduced-motion users ask to avoid. Colour transitions can stay.

**Check:** macOS → Accessibility → Display → Reduce motion → the reveal panel appears without sliding,
and the skeletons don't pulse.

---

## Step 3 · Skeletons instead of "Loading…"

### `apps/web/components/molecules/app-shell-skeleton/app-shell-skeleton.tsx` (new)
```tsx
import { Skeleton } from "@/components/ui/skeleton";

/** Header + content placeholder while /me loads in the (app) layout. */
export function AppShellSkeleton() {
  return (
    <output aria-label="Loading your space" className="block">
      <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3 sm:px-6">
        <Skeleton aria-hidden="true" className="size-11 rounded-full" />
        <Skeleton aria-hidden="true" className="size-9 rounded-full" />
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:p-6">
        <Skeleton aria-hidden="true" className="h-8 w-2/3" />
        <Skeleton aria-hidden="true" className="h-24 w-full" />
        <Skeleton aria-hidden="true" className="h-24 w-full" />
      </div>
    </output>
  );
}
```
Same `<output aria-label>` pattern as `ConversationLoader`.

### `apps/web/app/(app)/layout.tsx` (change)
**Before**
```tsx
  if (me.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6 text-sm">
        Loading session…
      </main>
    );
  }
```
**After**
```tsx
  if (me.isPending) {
    return <AppShellSkeleton />;
  }
```
with `import { AppShellSkeleton } from "@/components/molecules/app-shell-skeleton/app-shell-skeleton";`.

### `apps/web/components/organisms/page-loading/page-loading.tsx` (change)
`/couple` uses it inside the layout, under the real header, so it only needs the content part.
**Before**
```tsx
export function PageLoading({ message }: Readonly<PageLoadingProps>) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-bold">Loading...</h1>
      <p className="text-sm text-muted-foreground">
        {message || "Please wait while we load the page."}
      </p>
    </div>
  );
}
```
**After**
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function PageLoading({ message }: Readonly<PageLoadingProps>) {
  return (
    <output
      aria-label={message || "Loading"}
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:p-6"
    >
      <Skeleton aria-hidden="true" className="h-16 w-full" />
      <Skeleton aria-hidden="true" className="h-32 w-full" />
      <Skeleton aria-hidden="true" className="h-24 w-full" />
    </output>
  );
}
```
The `message` prop is kept as the accessible label, so callers don't change.

The auth pages' `<Suspense fallback>Loading…</Suspense>` (login, register, verify, check-email) can stay.
They flash for a few milliseconds, before `useSearchParams` resolves.

---

## Step 4 · Keyboard paths

### 4a · Submit: Cmd/Ctrl+Enter opens the confirm dialog
`apps/web/components/organisms/session-answer-form/session-answer-form.tsx` (change). A ref to the
trigger, not dialog state:

**Before**
```tsx
import { useForm, useWatch } from "react-hook-form";
```
**After**
```tsx
import { useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
```
**Before**
```tsx
  const { errors, isValid } = form.formState;
```
**After**
```tsx
  const { errors, isValid } = form.formState;
  const confirmTrigger = useRef<HTMLButtonElement>(null);
```
**Before**
```tsx
            {...form.register("text", {
              onChange: (event) => onTextChange?.(event.target.value),
            })}
          />
          <FieldDescription className="flex justify-between gap-4">
```
**After**
```tsx
            {...form.register("text", {
              onChange: (event) => onTextChange?.(event.target.value),
            })}
            onKeyDown={(event) => {
              // Cmd/Ctrl+Enter = "Submit my answer". It still goes through the confirm dialog.
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                confirmTrigger.current?.click();
              }
            }}
            aria-describedby="answer-shortcut"
          />
          <FieldDescription className="flex justify-between gap-4">
```
**Before**
```tsx
          <DialogTrigger
            render={
              <Button
                type="button"
                size="lg"
                className="self-start px-6 text-sm"
                disabled={!isValid || isSubmitting}
              />
            }
          >
```
**After**
```tsx
          <DialogTrigger
            render={
              <Button
                ref={confirmTrigger}
                type="button"
                size="lg"
                className="self-start px-6 text-sm"
                disabled={!isValid || isSubmitting}
              />
            }
          >
```
and, inside the `FieldDescription`, add
`<span id="answer-shortcut" className="sr-only">Press Control or Command plus Enter to submit.</span>`.
A disabled trigger ignores `.click()`, so an invalid answer can't be submitted through the shortcut.
Check that `Button` forwards `ref` (shadcn's Base UI button does; React 19 passes `ref` as a prop).

The Base UI `Dialog` already traps focus, closes on Escape and returns focus to the trigger. Nothing
to add there.

### 4b · Reveal: move focus to the answers
After **Reveal answers**, the button unmounts and focus falls to `<body>`. Focus the new heading instead.

`apps/web/components/organisms/session-reveal-panel/session-reveal-panel.tsx` (change)
**Before**
```tsx
      <h2 id="revealed-heading" className="text-2xl">
        Both answers
      </h2>
```
**After**
```tsx
      <h2
        id="revealed-heading"
        className="text-2xl outline-none"
        tabIndex={-1}
        // Focus lands here after Reveal so keyboard and screen reader users continue from the answers.
        autoFocus={autoFocusHeading}
      >
        Both answers
      </h2>
```
with a new prop `autoFocusHeading?: boolean` on `SessionRevealPanelProps`. On the conversation page,
pass `autoFocusHeading={reveal.isSuccess}`, so it only grabs focus right after *you* revealed, not on
every page load. `autoFocus` focuses on mount, with no `useEffect`.

Do the same for `SessionWaiting` after submit: pass `autoFocusHeading={submit.isSuccess}` and add
`tabIndex={-1}` + `autoFocus` to its heading.

### 4c · Dismiss welcome (only if you want it, see Flags)
`WelcomeBanner` takes `onDismiss` and gets a real `<button>`:
```tsx
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss welcome message"
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon aria-hidden="true" className="size-4" />
      </button>
```
Where to store "dismissed" is the product question. The cheapest option is the same pattern the push
banner's `useDismissPushBannerMutation` uses (check `use-push.ts`). It already has a "dismissed"
concept you can copy.

---

## Step 5 · Focus rings

Find interactive elements that remove the outline without adding a visible ring:
```sh
rg -n "outline-none" apps/web/components apps/web/app | rg -v "focus-visible:"
```
Each hit is either a non-interactive element (OK) or needs `focus-visible:ring-2 focus-visible:ring-ring`.
Today `ConversationCard`, `ThemeCard` and `PromptCard` (both its button and its P1-32 link) are fine.
After P1-8, also check the `Collapsible` triggers in `FollowUpCard`, and any `Collapsible` you wrap
"We talked about" in (P1-6). A bare `CollapsibleTrigger` needs:
```tsx
          <CollapsibleTrigger className="… rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
```
The checkbox in P1-14 keeps the browser's ring. Don't add `outline-none` to it. (P1-7's skip dialog is
shelved, 2026-10-26.)

**Check:** Tab through `/couple`, `/start`, a conversation in every phase, and `/settings`. Every stop
shows a ring.

---

## Step 6 · Mobile widths (320px)

The main containers use `p-6` (24px each side), which leaves 272px of content at 320px. Use 16px on
small screens:

| File | Before | After |
| --- | --- | --- |
| `app/(app)/couple/page.tsx` | `… max-w-5xl flex-col gap-6 p-6` | `… max-w-5xl flex-col gap-6 px-4 py-6 sm:p-6` |
| `app/(app)/conversation/[id]/page.tsx` | `… max-w-3xl flex-col gap-8 p-6` | `… max-w-3xl flex-col gap-8 px-4 py-6 sm:p-6` |
| `app/(app)/settings/page.tsx` (P1-4) | `… max-w-2xl flex-col gap-6 p-6` | `… max-w-2xl flex-col gap-6 px-4 py-6 sm:p-6` |
| `components/organisms/app-header/app-header.tsx` | `… gap-4 border-b border-primary/20 px-6 py-3` | `… gap-4 border-b border-primary/20 px-4 py-3 sm:px-6` |

Also check at 320px:
- `ConversationCard`: title + pill on one row. The pill has `shrink-0`; long titles wrap. OK.
- `SessionAnswerForm`'s confirm dialog footer: two buttons side by side. If they wrap badly, add
  `flex-col-reverse sm:flex-row` to `DialogFooter` (shadcn's default already does this; verify).
- `FollowUpCard`'s answer grid is `sm:grid-cols-2`, so it's one column on phones. OK.

**Check:** Chrome devtools → iPhone SE (375) and a custom 320×640 → no horizontal scroll on any page
(`document.documentElement.scrollWidth === 320` in the console).

---

## Verification
1. `pnpm lint && pnpm check-types && pnpm test`.
2. **Keyboard only**, no mouse: log in → start a conversation → write → Cmd/Ctrl+Enter → confirm with
   Enter → (partner answers) → Tab to Reveal → Enter → focus is on "Both answers" → Tab to a follow-up →
   answer it → Tab to the account menu → Settings → Tab through every form.
3. Repeat at 320px wide with Reduce motion on.
4. VoiceOver (Cmd+F5) on the conversation page: loading is announced once; after reveal, it reads "Both
   answers, heading".
