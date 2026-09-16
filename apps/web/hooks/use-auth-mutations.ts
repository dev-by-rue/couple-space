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

/**
 * Register then, in development only, call POST /auth/dev/verify.
 * TEMPORARY: stands in for "click link in verification email".
 * Replace with a real mailer + verify-token flow later.
 */
export function useRegisterMutation(
  options?: UseMutationOptions<unknown, Error, RegisterInput>,
) {
  return useMutation({
    ...options,
    mutationFn: async (body: RegisterInput) => {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (process.env.NODE_ENV === "development") {
        try {
          await apiFetch("/auth/dev/verify", { method: "POST" });
        } catch {
          // Register already succeeded and cookies are set. Dev verify is
          // TEMPORARY — a failed verify must not fail the mutation or strand
          // the user with email_taken on retry.
        }
      }
    },
  });
}
