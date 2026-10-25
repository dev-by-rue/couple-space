"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { SessionViewerPhase } from "@couple-space/domain";
import { apiFetch } from "@/lib/api";
import { sortSessionsByPriority } from "@/lib/session-sort";

export type SessionListItem = {
  id: string;
  promptTitle: string;
  promptText: string;
  phase: SessionViewerPhase;
  updatedAt: string;
};

export type SessionResponse = {
  userId: string;
  displayName: string;
  submitted: boolean;
  text: string | null;
};

/** One follow-up under a revealed main session. Never `ready_to_reveal`. */
export type FollowUp = {
  promptId: string;
  text: string;
  /** Null until either partner starts it. */
  sessionId: string | null;
  /** Null until started. */
  phase: SessionViewerPhase | null;
  responses: SessionResponse[];
};

export type SessionDetailDto = {
  id: string;
  parentSessionId: string | null;
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: "curated" | "follow_up";
  };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: SessionResponse[];
  /** Only once both have revealed. */
  followUps?: FollowUp[];
};

type SessionsResponse = {
  sessions: SessionListItem[];
};

type CreateSessionResponse = {
  id: string;
};

export const WAITING_POLL_MS = 20_000;
export const SESSIONS_QUERY_KEY = ["sessions"] as const;

export function sessionQueryKey(id: string) {
  return ["sessions", id] as const;
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => apiFetch<SessionsResponse>("/sessions"),
    select: (data) => sortSessionsByPriority(data.sessions),
    staleTime: 0,
  });
}

/**
 * Loads one session for the viewer, keeping it fresh while they wait.
 *
 * @remarks
 * The page polls only while something is waiting on the partner: the main
 * session in `waiting_for_partner`, or a follow-up in that phase. React Query
 * pauses polling in background tabs.
 *
 * @param id - Session id from the route
 * @returns The React Query result for `GET /sessions/:id`
 */
export function useSessionQuery(id: string) {
  return useQuery({
    queryKey: sessionQueryKey(id),
    queryFn: () => apiFetch<SessionDetailDto>(`/sessions/${id}`),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
    // Also poll while a follow-up is waiting on the partner.
    refetchInterval: (query) => {
      const data = query.state.data;
      const waiting =
        data?.phase === "waiting_for_partner" ||
        data?.followUps?.some((f) => f.phase === "waiting_for_partner");
      return waiting ? WAITING_POLL_MS : false;
    },
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

/**
 * Starts (or joins) the child session for one follow-up.
 *
 * @remarks
 * Either partner can start it; the API returns the same id to both.
 *
 * @param options - Extra React Query mutation options (e.g. `onSuccess`)
 * @returns The React Query mutation for starting a follow-up
 */
export function useStartFollowUpMutation(
  options?: UseMutationOptions<
    CreateSessionResponse,
    Error,
    { parentSessionId: string; promptId: string }
  >,
) {
  return useMutation({
    ...options,
    mutationFn: ({ parentSessionId, promptId }) =>
      apiFetch<CreateSessionResponse>(
        `/sessions/${parentSessionId}/follow-ups`,
        { method: "POST", body: JSON.stringify({ promptId }) },
      ),
  });
}

export function useSaveDraftMutation(
  options?: UseMutationOptions<
    void,
    Error,
    { sessionId: string; text: string }
  >,
) {
  return useMutation({
    ...options,
    mutationFn: ({ sessionId, text }) =>
      apiFetch<void>(`/sessions/${sessionId}/responses/draft`, {
        method: "PUT",
        body: JSON.stringify({ text }),
      }),
  });
}
