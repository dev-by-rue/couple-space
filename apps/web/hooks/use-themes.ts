"use client";

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

export type ThemeDto = {
  id: string;
  title: string;
  description: string;
  symbol: string;
  prompts: ThemePrompt[];
  slug: string;
};

type ThemesResponse = {
  /** Every tag, in the order the filter chips show them. */
  tags: ThemeTag[];
  themes: ThemeDto[];
};

export const THEMES_QUERY_KEY = ["themes"] as const;

export function useThemesQuery() {
  return useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: () => apiFetch<ThemesResponse>("/themes"),
  });
}
