/**
 * Tags couples can filter by (Q26). Draft list.
 *
 * Slugs are permanent once live: add new tags at the end, never rename a slug.
 * Labels can change. The order here is the order the filters show in.
 */
export const TAGS = [
  { slug: "playful", label: "Playful" },
  { slug: "thoughtful", label: "Thoughtful" },
  { slug: "romantic", label: "Romantic" },
  { slug: "practical", label: "Practical" },
  { slug: "nostalgic", label: "Nostalgic" },
  { slug: "hopeful", label: "Hopeful" },
] as const;

export type TagSlug = (typeof TAGS)[number]["slug"];
