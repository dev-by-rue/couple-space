import type { TagSlug } from "./tags.js";

/**
 * Keep in step with the `prompts_depth_preset` check in `src/schema/prompts.ts`
 * and `PROMPT_DEPTHS` in `@couple-space/domain` (this package doesn't depend on it).
 */
export type Depth = "light" | "medium" | "deep";

/**
 * One curated question.
 *
 * `key` is permanent: never change or reuse it (E-13). To reword a question,
 * set `retired: true` and add the new wording with a new key (Q13).
 */
export type QuestionSeed = {
  /** kebab-case, unique across the whole catalogue. */
  key: string;
  /** Shown on the hub card and the session header. */
  title: string;
  text: string;
  depth: Depth;
  tags: TagSlug[];
  /**
   * Optional follow-ups. Ids come from position, so append only:
   * never reorder or remove one. Retiring the question retires them too.
   */
  followUps?: string[];
  retired?: true;
};

/**
 * A theme and its questions. The slug is permanent (the theme id comes from it).
 * Questions can be reordered freely: ids don't depend on position.
 */
export type ThemeSeed = {
  slug: string;
  title: string;
  description: string;
  /** A key of `THEME_ICONS` in apps/web. */
  symbol: string;
  questions: QuestionSeed[];
};
