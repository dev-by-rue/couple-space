"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type CoupleMe = {
  coupleId: string;
  status: string;
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
  }>;
};

type CreateCoupleResponse = {
  coupleId: string;
  status: string;
};

type CreateInviteResponse = {
  token: string;
  expiresAt: string;
};

type AcceptInviteResponse = {
  coupleId: string;
  status: string;
};

const COUPLE_ME_QUERY_KEY = ["couples", "me"] as const;

export function useCoupleMeQuery() {
  return useQuery({
    queryKey: COUPLE_ME_QUERY_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<CoupleMe>("/couples/me");
      } catch (err) {
        // 404 no_couple is an expected empty state
        if (err instanceof Error && err.message.includes("404")) {
          return null;
        }
        throw err;
      }
    },
  });
}

export function useCreateCoupleMutation(
  options?: UseMutationOptions<CreateCoupleResponse, Error, void>,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation({
    ...rest,
    mutationFn: () =>
      apiFetch<CreateCoupleResponse>("/couples", {
        method: "POST",
      }),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: COUPLE_ME_QUERY_KEY });
      await onSuccess?.(...args);
    },
  });
}

export function useCreateInviteMutation(
  options?: UseMutationOptions<
    CreateInviteResponse,
    Error,
    { coupleId: string; email: string }
  >,
) {
  return useMutation({
    ...options,
    mutationFn: ({ coupleId, email }) =>
      apiFetch<CreateInviteResponse>(`/couples/${coupleId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
  });
}

export function useAcceptInviteMutation(
  options?: UseMutationOptions<
    AcceptInviteResponse,
    Error,
    { token: string }
  >,
) {
  return useMutation({
    ...options,
    mutationFn: ({ token }) =>
      apiFetch<AcceptInviteResponse>(`/invitations/${token}/accept`, {
        method: "POST",
      }),
  });
}
