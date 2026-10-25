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
