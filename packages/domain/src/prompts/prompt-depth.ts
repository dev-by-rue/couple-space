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
