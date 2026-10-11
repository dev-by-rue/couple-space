"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ThemePrompt = {
  id: string;
  title: string;
  description: string;
  text: string;
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
  themes: ThemeDto[];
};

export const THEMES_QUERY_KEY = ["themes"] as const;

export function useThemesQuery() {
  return useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: () => apiFetch<ThemesResponse>("/themes"),
  });
}
