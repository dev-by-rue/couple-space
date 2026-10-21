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
  pendingInvitation: PendingInvitation;
};

export type PendingInvitation = {
  email: string;
  expiresAt: string;
  token: string;
};

type CreateCoupleResponse = {
  coupleId: string;
  status: string;
};

type CreateInviteResponse = {
  token: string;
  expiresAt: string;
};

type CreateInvitePayload = { coupleId: string; email: string };

type AcceptInviteResponse = {
  coupleId: string;
  status: string;
};

type NewInvitePayload = CreateInvitePayload & { token: string };

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
    CreateInvitePayload
  >,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation({
    ...rest,
    mutationFn: ({ coupleId, email }) =>
      apiFetch<CreateInviteResponse>(`/couples/${coupleId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: COUPLE_ME_QUERY_KEY });
      await onSuccess?.(...args);
    },
  });
}

export function useAcceptInviteMutation(
  options?: UseMutationOptions<AcceptInviteResponse, Error, { token: string }>,
) {
  return useMutation({
    ...options,
    mutationFn: ({ token }) =>
      apiFetch<AcceptInviteResponse>(`/invitations/${token}/accept`, {
        method: "POST",
      }),
  });
}

export function useSendNewInviteLinkMutation(
  options?: UseMutationOptions<CreateInviteResponse, Error, NewInvitePayload>,
) {
  const queryClient = useQueryClient();
  const { onSuccess, onSettled, ...rest } = options ?? {};
  return useMutation({
    ...rest,
    mutationFn: async ({ coupleId, token, email }) => {
      await apiFetch(`/invitations/${token}/revoke`, {
        method: "POST",
      });
      return apiFetch<CreateInviteResponse>(
        `/couples/${coupleId}/invitations`,
        { method: "POST", body: JSON.stringify({ email }) },
      );
    },
    onSuccess: async (...args) => {
      await onSuccess?.(...args);
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: COUPLE_ME_QUERY_KEY });
      await onSettled?.(...args);
    },
  });
}
