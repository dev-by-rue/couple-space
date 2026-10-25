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
