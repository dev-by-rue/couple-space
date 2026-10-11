# `/start` page — step-by-step build guide

**Created:** Sunday 2026-10-11, 19:22
**Plan step:** 4 of the walking skeleton ([Consolidated plan](2026-09-21-conversation-walking-skeleton.md#consolidated-plan-2026-10-09--start-here))
**Goal:** A partner can pick a theme → pick a curated prompt → a session is created → they land on `/conversation/[id]`.

---

## ▶ Resuming? Start here

1. Look at the **Progress log** below — the last line says where you stopped.
2. Find the first unticked `- [ ]` box in **The steps**. That's your next action.
3. Before coding, run the **Quick sanity check** so you know the app still works.
4. When you stop, add a line to the Progress log (date, step, any note). Tick boxes as you go.

### Quick sanity check (2 minutes)

```bash
brew services list | grep postgres      # postgresql@15 → started
pnpm dev                                 # from repo root; wait for web :3000 and api :8080
```

- Log in at `http://localhost:3000/login` → `ruebencee@gmail.com` / `Password1234` (partner: `partner@test.local`).
- `/couple` shows your conversation cards. If login fails, see "If something goes wrong" at the bottom.

### Progress log

| Date / time | Step reached | Notes |
|---|---|---|
| 2026-10-11 19:22 | Guide written — not started | |
| 2026-10-11 | Guide updated: readable slugs chosen over ids → new Step 0 | Routes are now `/start/[slug]` |

---

## Decisions already made (don't re-decide)

| Topic | Decision |
|---|---|
| Routes | `/start` = all themes · `/start/[slug]` = one theme + its prompts (e.g. `/start/dreams-and-plans`) |
| `/start` layout | All themes listed, centred, **closed** (no prompts shown) |
| Theme page layout | Selected theme centred at top; prompts **side by side** on desktop (`md:grid-cols-3`), **stacked** on mobile |
| Back navigation | Visible "← All themes" link **and** browser back works (it's a real route) |
| Prompts | Curated only (custom prompts are T3) |
| Picking a prompt | Creates the session (`POST /sessions`) and goes straight to `/conversation/[id]` |
| Icons | `theme.symbol` holds a Lucide key (`coffee`, …); the web maps key → component, with a fallback |
| URLs | Readable, stable **slugs** (`dreams-and-plans`) stored in a `slug` column — renaming a theme's title never breaks links. Ids stay as the internal key |
| Animation | None beyond defaults (parked until after T0) |
| Styling | Yours — the class names below are suggestions, change freely |

---

## What already exists (reuse, don't rebuild)

| Thing | Where | Notes |
|---|---|---|
| Themes data | `apps/web/hooks/use-themes.ts` → `useThemesQuery()` | Returns `{ themes: ThemeDto[] }`. `ThemeDto` = `id, title, description, symbol, prompts[]` (+ `slug` after Step 0). `ThemePrompt` = `id, title, description, text` |
| Themes API | `apps/api/src/conversations/conversations.service.ts` → `listThemes` | Maps DB rows to the response — Step 0 adds `slug` here |
| Catalogue seed | `packages/database/seed/catalogue.data.ts` + `catalogue.seed.ts` | Typed data + upsert; `pnpm --filter @couple-space/database seed` |
| Create session | `apps/web/hooks/use-sessions.ts` → `useCreateSessionMutation()` | Takes `{ promptId }`, returns `{ id }`. Already refreshes the hub's session list on success |
| Logged-in layout | `apps/web/app/(app)/layout.tsx` | Anything under `app/(app)/` is automatically behind login + email verification |
| Entry point | "Start a conversation" on `/couple` | Already links to `/start` |
| Card look | `ConversationCard` | `rounded-lg bg-card p-4 ring-1 ring-foreground/10 …` — reuse for consistency |
| Button look | `buttonVariants` from `@/components/ui/button` | |
| Folder convention | `components/molecules/<name>/<name>.tsx` | Same as the pill / card / loader |
| API data | 6 themes × 3 prompts, seeded | Check anytime with Postman → **Themes (A)** |

**Next.js 16 note** (see `apps/web/AGENTS.md`): read route params in client components with **`useParams()`** from `next/navigation`. The page `params` *prop* is a Promise in this version — avoid it in `"use client"` pages.

---

## The steps

Files you'll create or touch:

```
packages/database/
  src/schema/prompt-themes.ts        ← Step 0  (add slug column)
  drizzle/0005_*.sql                 ← Step 0  (generated, then hand-edited)
  seed/catalogue.data.ts             ← Step 0  (add slugs)
  seed/catalogue.seed.ts             ← Step 0  (upsert slug)
apps/api/src/conversations/
  conversations.service.ts           ← Step 0  (return slug)
apps/web/
  hooks/use-themes.ts                ← Step 0  (slug on ThemeDto)
  components/molecules/
    theme-icon/theme-icon.tsx        ← Step 1
    theme-card/theme-card.tsx        ← Step 2
    prompt-card/prompt-card.tsx      ← Step 4
  app/(app)/start/
    page.tsx                         ← Step 3   (/start)
    [slug]/page.tsx                  ← Step 5   (/start/[slug])
```

Order matters a little: each step is checkable on its own before the next.

---

### Step 0 — Add a `slug` to themes (DB → seed → API → web type)

- [ ] **0.1** Add the column to the schema
- [ ] **0.2** Generate the migration
- [ ] **0.3** Hand-edit the migration so it works on a table that already has rows
- [ ] **0.4** Apply the migration
- [ ] **0.5** Add slugs to the seed data + upsert, run the seed
- [ ] **0.6** Return `slug` from the API
- [ ] **0.7** Add `slug` to the web type
- [ ] **0.8** Check

**What a slug is:** a URL-safe, lowercase, hyphenated name (`dreams-and-plans`) that is **stable** — you can reword the title later and the slug (and every link) stays the same. It's separate from `id` (the internal key) and `title` (what people read).

#### 0.1 Schema

`packages/database/src/schema/prompt-themes.ts` — add under `title`:

```ts
slug: text("slug").notNull().unique(),
```

`.unique()` = no two themes can share a slug, enforced by the database (so the URL always finds exactly one theme).

#### 0.2 Generate

```bash
pnpm --filter @couple-space/database generate
```

Drizzle compares the schema to its last snapshot and writes a new `packages/database/drizzle/0005_<random_name>.sql`. Open it. It will look roughly like:

```sql
ALTER TABLE "prompt_themes" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt_themes" ADD CONSTRAINT "prompt_themes_slug_unique" UNIQUE("slug");
```

(The exact constraint name may differ — keep whatever it generated.)

#### 0.3 Hand-edit it (important)

**The problem:** your table already has 6 themes. `ADD COLUMN … NOT NULL` would fail — those rows would have no slug, and NOT NULL forbids empty.

**The fix — three phases in one migration:** add it as optional → fill it → then make it required. Replace the first line so the file reads:

```sql
ALTER TABLE "prompt_themes" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "prompt_themes" SET "slug" = "id"::text WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "prompt_themes" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt_themes" ADD CONSTRAINT "prompt_themes_slug_unique" UNIQUE("slug");
```

- The `UPDATE` gives each existing row a **temporary** unique slug (its own id). Step 0.5's seed immediately overwrites them with the real ones.
- On a fresh/empty database the `UPDATE` simply touches 0 rows — still safe.
- Keep the `--> statement-breakpoint` markers exactly; Drizzle uses them to split statements.
- Editing a generated migration **before** it's applied is normal and fine. Never edit one after it has been applied.

#### 0.4 Apply

```bash
pnpm --filter @couple-space/database migrate
```

✅ Ends with `migrations applied successfully!`

#### 0.5 Seed data + upsert

In `seed/catalogue.data.ts`:
1. Add `slug: string;` to the `ThemeSeed` type.
2. Add a `slug` to each theme in `catalogue`:

   | n | slug |
   |---|---|
   | 1 | `everyday-moments` |
   | 2 | `us-lately` |
   | 3 | `dreams-and-plans` |
   | 4 | `knowing-you` |
   | 5 | `money-and-home` |
   | 6 | `gratitude` |

   Rules: lowercase, words joined by `-`, no `&`/commas/spaces (write `and`). **Never change a slug once real users have links** — titles can change, slugs shouldn't.
3. In `themeRows`, add `slug: theme.slug,`.

In `seed/catalogue.seed.ts`, add to the **themes** upsert `set`:

```ts
slug: sql`excluded.slug`,
```

Run: `pnpm --filter @couple-space/database seed` → `seeded 6 themes, 18 prompts`.

#### 0.6 API

`apps/api/src/conversations/conversations.service.ts` → `listThemes`, in the `themes.map(...)` object add:

```ts
slug: theme.slug,
```

(`theme` comes from `select()` on the table, so `slug` is already typed — TypeScript will autocomplete it.)

The API in `pnpm dev` restarts on save. If it doesn't pick up the new column type, restart `pnpm dev` (the database package is rebuilt first).

#### 0.7 Web type

`apps/web/hooks/use-themes.ts` → add `slug: string;` to `ThemeDto`.

#### 0.8 Check

- `pnpm check-types` (repo root) passes.
- Postman → **1. Auth → Login A**, then **2. → Themes (A)** → each theme has a `slug` (`"everyday-moments"`, …).
- Re-run the seed once more → still 6 themes (no duplicates), slugs unchanged.

---

### Step 1 — `ThemeIcon` (map a key to a Lucide icon)

- [ ] **1.1** Create `components/molecules/theme-icon/theme-icon.tsx`
- [ ] **1.2** Build the map + fallback
- [ ] **1.3** Typecheck

**Why:** the DB stores `"coffee"`; React needs `<Coffee />`. A small explicit map keeps the bundle light (importing "any icon by name" pulls in 1,500+ icons) and the fallback means a typo or new theme never breaks the page.

```tsx
import {
  CalendarHeart,
  Coffee,
  Compass,
  HandHeart,
  House,
  MessageCircleHeart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const THEME_ICONS: Record<string, LucideIcon> = {
  coffee: Coffee,
  "calendar-heart": CalendarHeart,
  compass: Compass,
  "message-circle-heart": MessageCircleHeart,
  house: House,
  "hand-heart": HandHeart,
};

export function ThemeIcon({
  symbol,
  className,
}: Readonly<{ symbol: string; className?: string }>) {
  const Icon = THEME_ICONS[symbol] ?? Sparkles; // fallback
  return <Icon aria-hidden="true" className={className} />;
}
```

Notes:
- `const Icon = …` then `<Icon />` — a component stored in a variable must start with a **capital letter** for JSX to treat it as a component.
- `aria-hidden` — the icon is decorative; the theme title next to it carries the meaning.
- All seven icons were checked to exist in your installed `lucide-react`.
- Adding a theme later with a new icon = one import + one map line here.

✅ **Check 1.3:** `pnpm check-types` passes.

---

### Step 2 — `ThemeCard` (one theme, links to its page)

- [ ] **2.1** Create `components/molecules/theme-card/theme-card.tsx`
- [ ] **2.2** Props + link
- [ ] **2.3** Typecheck

**Props:** `theme: ThemeDto` (`import type { ThemeDto } from "@/hooks/use-themes"`), optional `className`.

**Structure** (whole card is a link — same pattern as `ConversationCard`):

```
Link href={`/start/${theme.slug}`}   (card look + hover + focus ring)
├── ThemeIcon symbol={theme.symbol}   (e.g. className="size-6 text-primary")
├── title         (font-semibold)
└── description   (text-sm text-muted-foreground)
```

Tips:
- Copy the outer classes from `ConversationCard` so cards feel like one family; add `text-center items-center` for the centred look.
- Copy the `focus-visible:` ring classes too — keyboard users need to see where they are.
- No prompt count / no prompts on this card — `/start` shows themes *closed*.

✅ **Check 2.3:** typecheck passes.

---

### Step 3 — `/start` page (all themes)

- [ ] **3.1** Create `app/(app)/start/page.tsx` with `"use client"`
- [ ] **3.2** Handle loading / error / list
- [ ] **3.3** Check in browser

```tsx
"use client";

export default function StartPage() {
  const themes = useThemesQuery();

  if (themes.isPending) return /* loading */;
  if (themes.isError) return /* short friendly message */;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      {/* heading, e.g. "Choose a theme" */}
      {/* link back to /couple, e.g. "← Back" (optional but kind) */}
      {themes.data.themes.map((theme) => (
        <ThemeCard key={theme.id} theme={theme} />
      ))}
    </main>
  );
}
```

Notes:
- `themes.data.themes` — the hook has no `select`, so the array is inside `.themes` (unlike sessions).
- Loading: a simple "Loading themes…" is fine for T0; a skeleton can come in T6.
- `max-w-xl` + `mx-auto` keeps the column centred and readable on desktop.

✅ **Check 3.3:**
- `/couple` → "Start a conversation" → you land on `/start` and see **6 themes** in seed order (Everyday moments, Us lately, Dreams & plans, Knowing you, Money & home, Gratitude), each with its icon.
- Clicking a theme goes to e.g. `/start/everyday-moments` — a **404 is expected** until Step 5.
- Tab key moves between theme cards with a visible ring.

---

### Step 4 — `PromptCard` (one prompt, a button)

- [ ] **4.1** Create `components/molecules/prompt-card/prompt-card.tsx`
- [ ] **4.2** Props + button
- [ ] **4.3** Typecheck

**Why a `<button>`, not a `<Link>`:** choosing a prompt *does something* (creates a session) rather than just navigating. Buttons are for actions, links are for going somewhere. The page handles the action; this card just reports "I was picked".

**Props:**

```ts
{
  prompt: ThemePrompt;               // import type from "@/hooks/use-themes"
  onSelect: (promptId: string) => void;
  disabled?: boolean;                // true while a session is being created
  className?: string;
}
```

**Structure:**

```
<button type="button" onClick={() => onSelect(prompt.id)} disabled={disabled}
        className="…card look… text-left disabled:opacity-60">
└── prompt.text   (the actual question — this is what people choose by)
```

Tips:
- Show `prompt.text` (the question), not `prompt.title` ("Everyday moments · 2" isn't helpful here).
- `type="button"` — always set it; a bare `<button>` defaults to `submit`, which bites inside forms.
- `line-clamp-3` keeps side-by-side cards tidy; grid rows already equalise heights.
- Optional: a small "Start this conversation" hint or `ChevronRight` icon so it reads as tappable.

✅ **Check 4.3:** typecheck passes.

---

### Step 5 — `/start/[slug]` page (one theme + prompts + create session)

- [ ] **5.1** Create `app/(app)/start/[slug]/page.tsx` with `"use client"`
- [ ] **5.2** Read `slug`, find the theme
- [ ] **5.3** Not-found state
- [ ] **5.4** Layout: theme at top, prompts grid, "← All themes"
- [ ] **5.5** Wire the create-session mutation + redirect
- [ ] **5.6** Check in browser

#### 5.2 Read the slug and find the theme

```tsx
const { slug } = useParams<{ slug: string }>();
const themes = useThemesQuery();
// after loading/error checks:
const theme = themes.data.themes.find((t) => t.slug === slug);
```

- The folder name `[slug]` is what makes `slug` appear in `useParams()`.
- Same `useThemesQuery()` as `/start` → React Query already has the data cached, so this page appears instantly when coming from `/start`. On a direct visit/refresh it fetches once.

#### 5.3 Not found

If `theme` is `undefined` (bad or old URL): show "We couldn't find that theme." + a link to `/start`. Don't throw.

#### 5.4 Layout

```
"← All themes"  (Link to /start)
Theme header: ThemeIcon + title + description   (centred; can reuse ThemeCard's look, but NOT a link here)
Prompts:  <div className="grid grid-cols-1 gap-3 md:grid-cols-3"> PromptCard × 3 </div>
```

- `grid-cols-1 md:grid-cols-3` = stacked on phones, side by side from ~768px. Mobile-first: the plain class is the phone layout, `md:` adds the wider one.
- The theme page can be a bit wider than `/start` (e.g. `max-w-3xl`) so three prompts fit side by side.

#### 5.5 Create the session and go to it

```tsx
const router = useRouter();                   // from "next/navigation"
const createSession = useCreateSessionMutation({
  onSuccess: ({ id }) => router.push(`/conversation/${id}`),
});

// in the grid:
<PromptCard
  key={prompt.id}
  prompt={prompt}
  onSelect={(promptId) => createSession.mutate({ promptId })}
  disabled={createSession.isPending}
/>
```

- `onSuccess` receives the API response `{ id }` → navigate there. The hook already refreshes the hub's list for you.
- `disabled={createSession.isPending}` disables **all** prompts while the request runs → no double-tap = no duplicate sessions.
- If `createSession.isError`, show a short message above the grid ("Couldn't start that conversation — please try again."). Most likely real cause: couple not active (`403 couple_not_active`).

✅ **Check 5.6:**
- `/start` → click a theme → `/start/everyday-moments` (readable URL) shows that theme + **3 prompts** + "← All themes".
- Type `/start/gratitude` straight into the address bar → the Gratitude theme loads (proves direct links/refresh work).
- Resize the window: prompts are 3-across on desktop, stacked on a narrow window.
- "← All themes" and the **browser back button** both return to `/start`.
- Visit `/start/nonsense` → friendly not-found message with a way back.
- Click a prompt → you go to `/conversation/<id>` — a **404 is expected** until plan step 5. Then go to `/couple`: a new card **"Your turn"** sits at the **top** of the list. 🎉
- As `partner@test.local` (private window): the same new session shows **"Your turn"** too (partner hasn't answered either).
- Quickly double-click a prompt → only **one** new session appears on `/couple`.

---

### Step 6 — Wrap up

- [ ] **6.1** `pnpm check-types` (repo root) passes
- [ ] **6.2** Prettier: save each new file once (format on save) or run Format Document
- [ ] **6.3** Commit, e.g. `feat(web): /start theme and prompt selection`
- [ ] **6.4** Tick plan step 4 in the [Consolidated plan](2026-09-21-conversation-walking-skeleton.md#consolidated-plan-2026-10-09--start-here)
- [ ] **6.5** Add a final line to the Progress log above

**Next:** plan step 5 — `/conversation/[id]` (the four viewer states + Reveal).

---

## If something goes wrong

| Symptom | Likely cause / fix |
|---|---|
| Login says "Invalid email or password" | Wrong Postgres on port 5432. `brew services list` → only `postgresql@15` should be `started`. Users missing? Recreate via Postman folder **0. Setup** or `docs/engineering/conversation-api-smoke.md` §6 |
| `/start` shows the error state | API not running (`pnpm dev`), or not logged in. Check Postman → **Themes (A)** |
| Fewer than 6 themes | Re-run the catalogue seed: `pnpm --filter @couple-space/database seed` |
| Icon shows ✨ (Sparkles) instead of the right one | `symbol` key not in `THEME_ICONS` — check spelling matches `packages/database/seed/catalogue.data.ts` |
| `slug` is `undefined` | Folder must be named exactly `[slug]`, and the generic must match: `useParams<{ slug: string }>()` |
| Migrate fails: `column "slug" … contains null values` | Step 0.3 edit missing — the migration must add the column as nullable, `UPDATE`, then `SET NOT NULL`. If it half-applied, ask for help before re-running |
| A change in `packages/database` / `packages/domain` has no effect (e.g. `slug` missing from the API) though the code is right | Apps load the packages' compiled `dist/` at startup. Restart `pnpm dev`. Still stale? A leftover API from an old session may own the port: `lsof -iTCP:8080 -sTCP:LISTEN` → if it started before your `pnpm dev`, stop it (`kill <pid>`) and restart `pnpm dev` (look for `EADDRINUSE` in the output) |
| Theme page always "not found" | API not returning `slug` (Step 0.6), or the seed wasn't re-run (slugs still the temporary ids). Check Postman → Themes (A) |
| `generate` says "No schema changes" | The `slug` line isn't saved in `prompt-themes.ts`, or was added to the wrong table |
| "Property 'themes' does not exist" / `data` possibly undefined | Missing `isPending` / `isError` early returns before using `data` |
| Clicking a prompt does nothing | `onSelect` not wired, or button is `disabled`. Check Network tab for `POST /sessions` |
| `POST /sessions` → 403 | Couple not active — `/couple` should show the invite form instead of Start |
| Type errors after a `pnpm --filter … add` | Run a plain `pnpm install` at the repo root to relink packages |
| Two sessions from one click | `disabled={createSession.isPending}` missing |

---

## Parked (not part of this guide)

- Skeleton loaders for `/start` (T6)
- Theme colours / themed prompt titles
- More questions; compound themes (Dreams & plans, Money & home) split or tagged
- Animation (after T0)
