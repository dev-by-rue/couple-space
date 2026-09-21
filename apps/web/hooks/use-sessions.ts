"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { SessionViewerPhase } from "@couple-space/domain";
import { apiFetch } from "@/lib/api";

export type SessionListItem = {
  id: string;
  promptTitle: string;
  promptText: string;
  phase: SessionViewerPhase;
  updatedAt: string;
};

export type SessionDetailDto = {
  id: string;
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: "curated";
  };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: Array<{
    userId: string;
    displayName: string;
    submitted: boolean;
    text: string | null;
  }>;
};

type SessionsResponse = {
  sessions: SessionListItem[];
};

type CreateSessionResponse = {
  id: string;
};

export const SESSIONS_QUERY_KEY = ["sessions"] as const;

export function sessionQueryKey(id: string) {
  return ["sessions", id] as const;
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => apiFetch<SessionsResponse>("/sessions"),
  });
}

export function useSessionQuery(id: string) {
  return useQuery({
    queryKey: sessionQueryKey(id),
    queryFn: () => apiFetch<SessionDetailDto>(`/sessions/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateSessionMutation(
  options?: UseMutationOptions<
    CreateSessionResponse,
    Error,
    { promptId: string }
  >,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation({
    ...rest,
    mutationFn: ({ promptId }) =>
      apiFetch<CreateSessionResponse>("/sessions", {
        method: "POST",
        body: JSON.stringify({ promptId }),
      }),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      await onSuccess?.(...args);
    },
  });
}

export function useSubmitResponseMutation(
  options?: UseMutationOptions<
    SessionDetailDto,
    Error,
    { sessionId: string; text: string }
  >,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation({
    ...rest,
    mutationFn: ({ sessionId, text }) =>
      apiFetch<SessionDetailDto>(`/sessions/${sessionId}/responses`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      queryClient.setQueryData(sessionQueryKey(data.id), data);
      await onSuccess?.(data, ...args);
    },
  });
}

export function useRevealSessionMutation(
  options?: UseMutationOptions<SessionDetailDto, Error, string>,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation({
    ...rest,
    mutationFn: (id: string) =>
      apiFetch<SessionDetailDto>(`/sessions/${id}/reveal`, {
        method: "POST",
      }),
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      queryClient.setQueryData(sessionQueryKey(data.id), data);
      await onSuccess?.(data, ...args);
    },
  });
}
