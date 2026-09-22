"use client";

import { fetchRelationshipQuote } from "@/lib/api/quotes";
import { useQuery } from "@tanstack/react-query";

export function useRelationshipQuote() {
  return useQuery({
    queryKey: ["relationship-quote"],
    queryFn: () => fetchRelationshipQuote("relationships"),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
