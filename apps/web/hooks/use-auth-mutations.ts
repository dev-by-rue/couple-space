"use client";

import {
  useMutation,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { LoginInput, RegisterInput } from "@couple-space/domain";
import { apiFetch } from "@/lib/api";

/**
 * Nest sets httpOnly cs_access / cs_refresh on success.
 * Web must never put access tokens in localStorage — apiFetch uses credentials: "include".
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

type ResendVerificationResponse = {
  ok: true;
  alreadyVerified?: true;
  sent?: false;
};

export function useResendVerificationMutation(
  options?: UseMutationOptions<
    ResendVerificationResponse,
    Error,
    void
  >,
) {
  return useMutation({
    ...options,
    mutationFn: () =>
      apiFetch<ResendVerificationResponse>("/auth/resend-verification", {
        method: "POST",
      }),
  });
}
