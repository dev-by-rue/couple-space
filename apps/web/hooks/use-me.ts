"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { UpdateProfileInput } from "@couple-space/domain";

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

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) =>
      apiFetch<Me>("/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (me) => queryClient.setQueryData(ME_QUERY_KEY, me),
  });
}
