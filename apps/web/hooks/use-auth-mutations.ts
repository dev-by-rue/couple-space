"use client";

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from "@couple-space/domain";
import { apiFetch } from "@/lib/api";
import { unsubscribeThisDevice } from "@/hooks/use-push";

type ResendVerificationResponse = {
  ok: true;
  alreadyVerified?: true;
  sent?: false;
};

/**
 * Logs a user in via `POST /auth/login`.
 *
 * @remarks
 * Nest sets the httpOnly `cs_access` / `cs_refresh` cookies on success. The web
 * client must never put access tokens in `localStorage` — `apiFetch` sends
 * cookies with `credentials: "include"`.
 *
 * @param options - Extra React Query mutation options (e.g. `onSuccess`)
 * @returns The React Query mutation for logging in
 */
export function useLoginMutation(
  options?: UseMutationOptions<unknown, Error, LoginInput>,
) {
  return useMutation({
    ...options,
    mutationFn: (body: LoginInput) =>
      apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useRegisterMutation(
  options?: UseMutationOptions<unknown, Error, RegisterInput>,
) {
  return useMutation({
    ...options,
    mutationFn: (body: RegisterInput) =>
      apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useVerifyEmailMutation(
  options?: UseMutationOptions<unknown, Error, { token: string }>,
) {
  return useMutation({
    ...options,
    mutationFn: ({ token }: { token: string }) =>
      apiFetch("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
  });
}

export function useResendVerificationMutation(
  options?: UseMutationOptions<ResendVerificationResponse, Error, void>,
) {
  return useMutation({
    ...options,
    mutationFn: () =>
      apiFetch<ResendVerificationResponse>("/auth/resend-verification", {
        method: "POST",
      }),
  });
}

export function useLogoutMutation(
  options?: UseMutationOptions<unknown, Error, void>,
) {
  return useMutation({
    ...options,
    mutationFn: async () => {
      // Before logout, while the auth cookie still works. A failure here
      // must not block logging out.
      await unsubscribeThisDevice().catch(() => undefined);
      return apiFetch("/auth/logout", { method: "POST" });
    },
  });
}

export function useChangePasswordMutation(
  options?: UseMutationOptions<unknown, Error, ChangePasswordInput>,
) {
  return useMutation({
    ...options,
    mutationFn: (body: ChangePasswordInput) =>
      apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
