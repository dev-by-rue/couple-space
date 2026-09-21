"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** Matches GET /me from the Nest users service. */
export type Me = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  dateOfBirth: string;
  couple: null;
};

export const ME_QUERY_KEY = ["me"] as const;

export function useMeQuery() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<Me>("/me"),
    retry: false,
  });
}
