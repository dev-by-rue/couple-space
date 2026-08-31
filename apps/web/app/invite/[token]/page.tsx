"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Me = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
};

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/me"),
    retry: false,
  });

  useEffect(() => {
    if (me.isError) {
      router.replace(`/login?next=/invite/${token}`);
    }
  }, [me.isError, router, token]);

  const accept = useMutation({
    mutationFn: () =>
      apiFetch<{ coupleId: string; status: string }>(
        `/invitations/${token}/accept`,
        { method: "POST" },
      ),
    onSuccess: () => {
      router.replace("/couple");
    },
  });

  const devVerify = useMutation({
    mutationFn: () => apiFetch("/auth/dev/verify", { method: "POST" }),
    onSuccess: () => me.refetch(),
  });

  if (me.isPending || me.isError) {
    return <main className="p-6 text-sm">Checking session…</main>;
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Accept invitation</h1>
      <p className="text-muted-foreground text-sm">
        Signed in as {me.data.email}. Accepting joins this couple if the invite
        matches your email and you are verified.
      </p>

      {!me.data.emailVerified ? (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p>Your email is not verified yet.</p>
          {process.env.NODE_ENV === "development" ? (
            <Button
              onClick={() => devVerify.mutate()}
              disabled={devVerify.isPending}
            >
              Dev verify email
            </Button>
          ) : (
            <p>
              Check your inbox for a verification link (mailer not wired yet).
            </p>
          )}
        </div>
      ) : null}

      {accept.error ? (
        <p className="text-sm text-red-600">{accept.error.message}</p>
      ) : null}

      <Button
        onClick={() => accept.mutate()}
        disabled={!me.data.emailVerified || accept.isPending}
      >
        {accept.isPending ? "Accepting…" : "Accept invite"}
      </Button>
    </main>
  );
}
