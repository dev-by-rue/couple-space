# P1-30 · Browse with filters and paging (first slice)

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Decisions: [Q26](../../03-product-decisions.md#q26) · After: [P1-28](P1-28-catalogue-at-scale.md) · Wireframe: [`wireframes/p1-30-browse.html`](../../wireframes/p1-30-browse.html)

**Goal:** browsing stays short on a phone now that themes have 27–30 questions. A theme shows **6
questions at a time** with **Show more**, plus **depth and tag filter chips** kept in the URL. The theme
list becomes a compact **two-column grid** on phones.

Open the wireframe in a browser and switch on devtools' device toolbar (iPhone SE) to see the target.
It uses the real seed catalogue.

**Done when:**

- `PROMPT_DEPTHS` lives in `@couple-space/domain`, with tests.
- `GET /themes` returns each prompt's `depth` and `tags`, plus a top-level `tags` list (slug, label,
  in order), with a test.
- `/start` shows two columns on phones, with "N questions" on each card.
- `/start/[slug]` shows 6 questions, "Showing X of Y" and **Show more** (+6, no jump to the top). Depth
  chips are single-choice; tag chips match *any* selected tag. "Clear" appears when anything is set.
  An empty filter result shows its own message.
- Filters and the count live in the URL (`?depth=light&tag=playful&show=12`), so back and refresh keep them.

### Scope and decisions

- **This is a first slice of P1-30.** Hiding answered or skipped prompts (Q25), server-side paging, and
  "Explored" stay in P1-29 / P1-30 proper. Filtering here is **client-side**: `GET /themes` already
  returns every prompt in one request (about 290 rows, a few tens of KB), so a second request per
  filter isn't worth it yet.
- **No `useState`.** The URL is the state. Chips and Show more are `<Link>`s to the next URL, so
  they work with the keyboard, back/forward, and sharing.
- **Tags OR, depth single.** "Playful + Romantic" means either. Depth is one choice, because a
  question has exactly one.
- **Theme icons:** `feather`, `fingerprint` and `heart-handshake` are already in `THEME_ICONS`, so
  nothing to do there.
- **Web tests:** `apps/web` still has no test runner. `lib/prompt-filters.ts` is pure, so it's ready
  for tests once one is added.

---

## Step 1 · Domain

### `packages/domain/src/prompts/prompt-depth.ts` (new)

```ts
/** How deep a curated prompt goes (Q26). Follow-ups take their parent's depth. */
export const PROMPT_DEPTHS = ["light", "medium", "deep"] as const;

export type PromptDepth = (typeof PROMPT_DEPTHS)[number];

export const PROMPT_DEPTH_LABELS: Record<PromptDepth, string> = {
  light: "Light",
  medium: "Medium",
  deep: "Deep",
};

/** Narrows an unknown value (e.g. a URL param) to a depth. */
export function isPromptDepth(value: unknown): value is PromptDepth {
  return (PROMPT_DEPTHS as readonly unknown[]).includes(value);
}
```

### `packages/domain/src/prompts/prompt-depth.test.ts` (new)

```ts
import { describe, expect, it } from "vitest";
import {
  isPromptDepth,
  PROMPT_DEPTH_LABELS,
  PROMPT_DEPTHS,
} from "./prompt-depth.js";

describe("PROMPT_DEPTHS", () => {
  it("has a label for every depth", () => {
    expect(Object.keys(PROMPT_DEPTH_LABELS).sort()).toEqual(
      [...PROMPT_DEPTHS].sort(),
    );
  });
});

describe("isPromptDepth", () => {
  it.each(["light", "medium", "deep"])("accepts %s", (value) => {
    expect(isPromptDepth(value)).toBe(true);
  });

  it.each(["Light", "shallow", "", null, undefined])("rejects %s", (value) => {
    expect(isPromptDepth(value)).toBe(false);
  });
});
```

### `packages/domain/src/index.ts` (change): add

```ts
export * from "./prompts/prompt-depth.js";
```

### `packages/database/seed/catalogue/types.ts` (change)

**Before**

```ts
/** Keep in step with the `prompts_depth_preset` check in `src/schema/prompts.ts`. */
export type Depth = "light" | "medium" | "deep";
```

**After**

```ts
/**
 * Keep in step with the `prompts_depth_preset` check in `src/schema/prompts.ts`
 * and `PROMPT_DEPTHS` in `@couple-space/domain` (this package doesn't depend on it).
 */
export type Depth = "light" | "medium" | "deep";
```

Run `pnpm --filter @couple-space/domain build` afterwards. The API and web read the built `dist`.

---

## Step 2 · API: depth and tags on `GET /themes`

### `apps/api/src/conversations/conversations.service.ts` (change)

**Imports, before**

```ts
import {
  conversationSessions,
  coupleMemberships,
  couples,
  promptThemes,
  prompts,
```

**After**

```ts
import {
  conversationSessions,
  coupleMemberships,
  couples,
  promptTagLinks,
  promptTags,
  promptThemes,
  prompts,
```

Also add `type PromptDepth` to the `@couple-space/domain` import.

**`listThemes`, before**

```ts
    const allPrompts = await this.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.kind, "curated"), isNull(prompts.retiredAt)))
      .orderBy(asc(prompts.sortOrder), asc(prompts.title));

    return {
      themes: themes.map((theme) => ({
        id: theme.id,
        slug: theme.slug,
        title: theme.title,
        description: theme.description,
        symbol: theme.symbol,
        prompts: allPrompts
          .filter((p) => p.themeId === theme.id)
          .map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            text: p.text,
          })),
      })),
    };
```

**After**

```ts
    const allPrompts = await this.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.kind, "curated"), isNull(prompts.retiredAt)))
      .orderBy(asc(prompts.sortOrder), asc(prompts.title));

    // One query for every prompt's tag slugs, grouped in memory.
    const links =
      allPrompts.length === 0
        ? []
        : await this.db
            .select({ promptId: promptTagLinks.promptId, slug: promptTags.slug })
            .from(promptTagLinks)
            .innerJoin(promptTags, eq(promptTags.id, promptTagLinks.tagId))
            .where(
              inArray(
                promptTagLinks.promptId,
                allPrompts.map((p) => p.id),
              ),
            );
    const tagsByPrompt = new Map<string, string[]>();
    for (const link of links) {
      tagsByPrompt.set(link.promptId, [
        ...(tagsByPrompt.get(link.promptId) ?? []),
        link.slug,
      ]);
    }

    // The filter chips' labels and order come from here, not from the web.
    const tags = await this.db
      .select({ slug: promptTags.slug, label: promptTags.label })
      .from(promptTags)
      .orderBy(asc(promptTags.sortOrder));

    return {
      tags,
      themes: themes.map((theme) => ({
        id: theme.id,
        slug: theme.slug,
        title: theme.title,
        description: theme.description,
        symbol: theme.symbol,
        prompts: allPrompts
          .filter((p) => p.themeId === theme.id)
          .map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            text: p.text,
            // Curated prompts always have a depth (prompts_catalogue_key_depth check).
            depth: p.depth as PromptDepth,
            tags: tagsByPrompt.get(p.id) ?? [],
          })),
      })),
    };
```

### `apps/api/src/conversations/conversations.service.test.ts` (change): add at the end

`queryResult` is already imported (P1-8). `listThemes` doesn't touch memberships, so the four selects
are themes, prompts, links and tags, in that order.

```ts
describe("ConversationsService.listThemes", () => {
  const user = { id: "u1", email: "a@example.com", emailVerified: true };

  async function serviceWith(db: unknown) {
    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: db },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();
    return module.get(ConversationsService);
  }

  it("returns each prompt's depth and tag slugs, and the tag list in order", async () => {
    const db = { select: vi.fn() };
    db.select
      .mockReturnValueOnce(
        queryResult([
          { id: "t1", slug: "say-it-softly", title: "Say it softly", description: "d", symbol: "feather" },
        ]),
      )
      .mockReturnValueOnce(
        queryResult([
          { id: "p1", themeId: "t1", title: "A small ask", description: "d", text: "Q1", depth: "light" },
          { id: "p2", themeId: "t1", title: "Guess my signs", description: "d", text: "Q2", depth: "medium" },
        ]),
      )
      .mockReturnValueOnce(
        queryResult([
          { promptId: "p1", slug: "practical" },
          { promptId: "p1", slug: "thoughtful" },
        ]),
      )
      .mockReturnValueOnce(
        queryResult([
          { slug: "playful", label: "Playful" },
          { slug: "thoughtful", label: "Thoughtful" },
        ]),
      );

    const result = await (await serviceWith(db)).listThemes(user);

    expect(result.tags).toEqual([
      { slug: "playful", label: "Playful" },
      { slug: "thoughtful", label: "Thoughtful" },
    ]);
    expect(result.themes[0]!.prompts).toEqual([
      expect.objectContaining({ id: "p1", depth: "light", tags: ["practical", "thoughtful"] }),
      expect.objectContaining({ id: "p2", depth: "medium", tags: [] }),
    ]);
  });

  it("skips the links query when there are no prompts", async () => {
    const db = { select: vi.fn() };
    db.select
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([]));

    const result = await (await serviceWith(db)).listThemes(user);

    expect(db.select).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ tags: [], themes: [] });
  });
});
```

---

## Step 3 · Web: data and filter helpers

### `apps/web/hooks/use-themes.ts` (change)

**Before**

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ThemePrompt = {
  id: string;
  title: string;
  description: string;
  text: string;
};
```

**After**

```ts
import { useQuery } from "@tanstack/react-query";
import type { PromptDepth } from "@couple-space/domain";
import { apiFetch } from "@/lib/api";

export type ThemePrompt = {
  id: string;
  title: string;
  description: string;
  text: string;
  depth: PromptDepth;
  /** Tag slugs; labels are in {@link ThemesResponse} `tags`. */
  tags: string[];
};

export type ThemeTag = {
  slug: string;
  label: string;
};
```

**Before**

```ts
type ThemesResponse = {
  themes: ThemeDto[];
};
```

**After**

```ts
type ThemesResponse = {
  /** Every tag, in the order the filter chips show them. */
  tags: ThemeTag[];
  themes: ThemeDto[];
};
```

### `apps/web/lib/prompt-filters.ts` (new)

```ts
import { isPromptDepth, type PromptDepth } from "@couple-space/domain";

/** How many questions a theme shows at first, and how many "Show more" adds. */
export const PROMPT_PAGE_SIZE = 6;

export type PromptFilters = {
  depth: PromptDepth | null;
  /** Selected tag slugs. A prompt matches if it has any of them. */
  tags: string[];
  /** How many matching prompts to show. */
  show: number;
};

type ReadableParams = Pick<URLSearchParams, "get" | "getAll">;

/**
 * Reads the browse filters from the URL.
 *
 * @remarks
 * Unknown depths, unknown tags and bad numbers are ignored rather than
 * erroring, so an old or hand-edited link still opens.
 *
 * @param params - The page's search params
 * @param knownTags - Tag slugs from `GET /themes`
 * @returns The filters, with `show` at least {@link PROMPT_PAGE_SIZE}
 */
export function readPromptFilters(
  params: ReadableParams,
  knownTags: string[],
): PromptFilters {
  const depth = params.get("depth");
  const show = Number(params.get("show"));
  return {
    depth: isPromptDepth(depth) ? depth : null,
    tags: params.getAll("tag").filter((tag) => knownTags.includes(tag)),
    show:
      Number.isInteger(show) && show > PROMPT_PAGE_SIZE
        ? show
        : PROMPT_PAGE_SIZE,
  };
}

/**
 * Keeps the prompts that match the filters.
 *
 * @param prompts - A theme's prompts
 * @param filters - From {@link readPromptFilters}
 * @returns A new array, in the original order
 */
export function filterPrompts<T extends { depth: PromptDepth; tags: string[] }>(
  prompts: T[],
  filters: Pick<PromptFilters, "depth" | "tags">,
): T[] {
  return prompts.filter(
    (prompt) =>
      (!filters.depth || prompt.depth === filters.depth) &&
      (filters.tags.length === 0 ||
        prompt.tags.some((tag) => filters.tags.includes(tag))),
  );
}

/**
 * Builds the URL for a set of filters. Defaults are left out, so the
 * unfiltered page is just the pathname.
 *
 * @param pathname - e.g. `/start/say-it-softly`
 * @param filters - The filters to encode
 * @returns The pathname plus any query string
 */
export function promptFiltersHref(
  pathname: string,
  filters: PromptFilters,
): string {
  const params = new URLSearchParams();
  if (filters.depth) params.set("depth", filters.depth);
  for (const tag of filters.tags) params.append("tag", tag);
  if (filters.show > PROMPT_PAGE_SIZE) params.set("show", String(filters.show));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Selects a depth, or clears it if it's already selected.
 *
 * @remarks Changing a filter resets "show", so the list starts from the top.
 *
 * @param filters - The current filters
 * @param depth - The depth chip that was tapped
 * @returns The next filters
 */
export function toggleDepth(
  filters: PromptFilters,
  depth: PromptDepth,
): PromptFilters {
  return {
    ...filters,
    depth: filters.depth === depth ? null : depth,
    show: PROMPT_PAGE_SIZE,
  };
}

/**
 * Adds or removes one tag.
 *
 * @remarks Changing a filter resets "show", so the list starts from the top.
 *
 * @param filters - The current filters
 * @param tag - The tag chip that was tapped
 * @returns The next filters
 */
export function toggleTag(filters: PromptFilters, tag: string): PromptFilters {
  return {
    ...filters,
    tags: filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag],
    show: PROMPT_PAGE_SIZE,
  };
}
```

---

## Step 4 · Web: components

### `apps/web/components/molecules/prompt-filters/prompt-filters.tsx` (new)

```tsx
import Link from "next/link";
import { PROMPT_DEPTH_LABELS, PROMPT_DEPTHS } from "@couple-space/domain";
import type { ThemeTag } from "@/hooks/use-themes";
import {
  PROMPT_PAGE_SIZE,
  promptFiltersHref,
  toggleDepth,
  toggleTag,
  type PromptFilters as Filters,
} from "@/lib/prompt-filters";
import { cn } from "@/lib/utils";

type PromptFiltersProps = {
  /** The theme page's path, e.g. `/start/say-it-softly`. */
  pathname: string;
  /** The filters read from the URL. */
  filters: Filters;
  /** Every tag, in display order. */
  tags: ThemeTag[];
};

/**
 * Depth and tag chips for a theme's questions.
 *
 * @remarks
 * Each chip is a link to the toggled URL, so the URL is the only state and
 * back/refresh keep the selection. One row that scrolls sideways on phones.
 */
export function PromptFilters({
  pathname,
  filters,
  tags,
}: Readonly<PromptFiltersProps>) {
  const anySelected = filters.depth !== null || filters.tags.length > 0;

  return (
    <nav
      aria-label="Filter questions"
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      {PROMPT_DEPTHS.map((depth) => (
        <FilterChip
          key={depth}
          href={promptFiltersHref(pathname, toggleDepth(filters, depth))}
          selected={filters.depth === depth}
          label={PROMPT_DEPTH_LABELS[depth]}
        />
      ))}
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
      {tags.map((tag) => (
        <FilterChip
          key={tag.slug}
          href={promptFiltersHref(pathname, toggleTag(filters, tag.slug))}
          selected={filters.tags.includes(tag.slug)}
          label={tag.label}
        />
      ))}
      {anySelected ? (
        <Link
          href={promptFiltersHref(pathname, {
            depth: null,
            tags: [],
            show: PROMPT_PAGE_SIZE,
          })}
          scroll={false}
          className="shrink-0 rounded text-sm whitespace-nowrap text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear
        </Link>
      ) : null}
    </nav>
  );
}

type FilterChipProps = {
  href: string;
  selected: boolean;
  label: string;
};

function FilterChip({ href, selected, label }: Readonly<FilterChipProps>) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
```

`aria-current="true"` tells screen readers which chips are on. `aria-pressed` is for buttons, and
these are links.

### `apps/web/components/molecules/prompt-card/prompt-card.tsx` (change): depth badge

**Before**

```tsx
import { ThemePrompt } from "@/hooks/use-themes";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";
```

**After**

```tsx
import { PROMPT_DEPTH_LABELS } from "@couple-space/domain";
import type { ThemePrompt } from "@/hooks/use-themes";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";
```

**Before**

```tsx
      <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
        Start this conversation
        <ArrowRightIcon
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </span>
```

**After**

```tsx
      <span className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-foreground">
          {PROMPT_DEPTH_LABELS[prompt.depth]}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
          Start this conversation
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
```

`ThemePrompt` becomes `import type`, as `apps/web/CLAUDE.md` asks for type-only imports.

### `apps/web/components/molecules/theme-card/theme-card.tsx` (replace whole file)

```tsx
import Link from "next/link";
import type { ThemeDto } from "@/hooks/use-themes";
import { ThemeIcon } from "@/components/molecules/theme-icon/theme-icon";

type ThemeCardProps = {
  /** The theme, as returned by `GET /themes`. */
  theme: ThemeDto;
};

/**
 * A `/start` card linking to one theme.
 *
 * @remarks
 * Compact on phones (icon, title, question count) so two fit side by side;
 * the description appears from the `sm` breakpoint up.
 */
export function ThemeCard({ theme }: Readonly<ThemeCardProps>) {
  const count = theme.prompts.length;

  return (
    <Link
      href={`/start/${theme.slug}`}
      className="flex flex-col gap-2 rounded-md p-4 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:gap-4"
    >
      <ThemeIcon
        symbol={theme.symbol}
        className="size-6 shrink-0 text-secondary sm:mt-0.5"
      />
      <div className="flex flex-col gap-1.5">
        <h3 className="leading-snug font-semibold">{theme.title}</h3>
        <p className="line-clamp-2 hidden text-sm text-muted-foreground sm:block">
          {theme.description}
        </p>
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "question" : "questions"}
        </span>
      </div>
    </Link>
  );
}
```

---

## Step 5 · Web: pages

### `apps/web/app/(app)/start/page.tsx` (change)

**Before**

```tsx
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 p-6">
```

**After**

```tsx
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:p-6">
```

**Before**

```tsx
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
```

**After**

```tsx
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
```

### `apps/web/app/(app)/start/[slug]/page.tsx` (replace whole file)

```tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useThemesQuery } from "@/hooks/use-themes";
import { useCreateSessionMutation } from "@/hooks/use-sessions";
import {
  filterPrompts,
  PROMPT_PAGE_SIZE,
  promptFiltersHref,
  readPromptFilters,
} from "@/lib/prompt-filters";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PromptCard } from "@/components/molecules/prompt-card/prompt-card";
import { PromptFilters } from "@/components/molecules/prompt-filters/prompt-filters";
import { ErrorState } from "@/components/molecules/error-state/error-state";
import { PageLoading } from "@/components/organisms/page-loading/page-loading";
import { RedirectTo } from "@/components/organisms/redirect-to/redirect-to";

function ThemePromptsContent() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const createSession = useCreateSessionMutation({
    onSuccess: ({ id }) => router.push(`/conversation/${id}`),
  });

  const themes = useThemesQuery();

  if (themes.isPending) return <PageLoading message="Loading prompts…" />;
  if (themes.isError)
    return (
      <main className="flex min-h-svh items-center">
        <ErrorState
          title="We couldn't load this theme"
          onRetry={() => void themes.refetch()}
        />
      </main>
    );

  const theme = themes.data.themes.find((theme) => theme.slug === slug);

  if (!theme)
    return (
      <RedirectTo
        pageTitle="Theme not found"
        pageMessage="The theme you are looking for does not exist."
        redirectTo="/start"
      />
    );

  const pathname = `/start/${theme.slug}`;
  const filters = readPromptFilters(
    searchParams,
    themes.data.tags.map((tag) => tag.slug),
  );
  const matching = filterPrompts(theme.prompts, filters);
  const shown = matching.slice(0, filters.show);
  const remaining = matching.length - shown.length;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{theme.title}</h1>
        <p className="text-sm text-muted-foreground">{theme.description}</p>
      </div>

      <PromptFilters
        pathname={pathname}
        filters={filters}
        tags={themes.data.tags}
      />

      {matching.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-8 text-center">
          <p>No questions match these filters.</p>
          <Link
            href={pathname}
            scroll={false}
            className="text-sm underline underline-offset-4"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {shown.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                disabled={createSession.isPending}
                onSelect={(promptId) => createSession.mutate({ promptId })}
              />
            ))}
          </div>

          {createSession.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t start that conversation. Please try again.
            </p>
          ) : null}

          <div className="flex flex-col items-center gap-3 pb-6">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {shown.length} of {matching.length}
            </p>
            {remaining > 0 ? (
              <Link
                href={promptFiltersHref(pathname, {
                  ...filters,
                  show: filters.show + PROMPT_PAGE_SIZE,
                })}
                // Keep the reader's place: new cards appear below.
                scroll={false}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full max-w-sm",
                )}
              >
                Show {Math.min(PROMPT_PAGE_SIZE, remaining)} more
              </Link>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading message="Loading prompts…" />}>
      <ThemePromptsContent />
    </Suspense>
  );
}
```

What changed from today's page:
- `useSearchParams` is wrapped in `Suspense`, the same way `login/page.tsx` does it.
- The page reads the filters, filters the prompts and slices them to `show`.
- It adds the chips, the count, Show more and the empty state.
- The create-session error moved out of the grid, so it no longer takes up a grid cell.
- Padding is `px-4` on phones (16px gutters).

`themes.data` no longer needs `?.`: the `isPending` and `isError` guards above narrow it.

---

## Step 6 · Docs

In `docs/plan/tasks/phase-1-mvp-1.md`, add a guide link on P1-30 and a short note:
"First slice (client-side paging and filters) in the guide. Q25 hiding, server paging and 'Explored'
are still to do."

---

## Verification

1. `pnpm --filter @couple-space/domain build`, then `pnpm check-types && pnpm lint && pnpm test`.
2. After your local `migrate` and `seed`: `curl -b <cookies> localhost:8080/themes | jq '.tags, .themes[0].prompts[0]'`
   → 6 tags in order, and a prompt with `depth` and `tags`.
3. In the browser, devtools → iPhone SE (375px):
   - `/start`: 10 themes in two columns, each with "N questions", no description, and no
     horizontal scroll.
   - Open *Say it softly*: 6 cards, "Showing 6 of 30". **Show 6 more** → 12, and the page doesn't
     jump to the top.
   - Tap **Light**, then **Practical**: the list narrows, the count resets to 6, and the URL reads
     `?depth=light&tag=practical`. Refresh → same view. Back → the previous filter.
   - Pick **Deep** + **Playful** → "No questions match these filters." → Clear filters.
   - Tab through the chips: each shows a focus ring, and Enter toggles it.
4. Start a conversation from a filtered list → you land on the conversation page.
5. Compare against the wireframe (`docs/plan/wireframes/p1-30-browse.html`) side by side.
