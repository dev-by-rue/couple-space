"use client";

import { redirect, useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import { useResendVerificationMutation } from "@/hooks/use-auth-mutations";
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

  const resend = useResendVerificationMutation({
    onSuccess: (data) => {
      if (data.alreadyVerified) {
        me.refetch();
      }
    },
  });

  if (me.isPending) {
    return <main className="p-6 text-sm">Checking session…</main>;
  }

  // Invitees usually need an account first — send unauthenticated users to register.
  if (me.isError) {
    redirect(`/register?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Accept invitation</h1>
      <p className="text-muted-foreground text-sm">
        Signed in as {me.data.email}. Accepting joins this couple if the invite
        matches your email and you are verified.
      </p>

      {!me.data.emailVerified ? (
        <div className="space-y-3 rounded-md border p-3 text-sm">
          <p>Your email is not verified yet. Check your inbox for a verification link.</p>

          {resend.isSuccess && !resend.data?.alreadyVerified ? (
            <p className="text-muted-foreground">
              {resend.data?.sent === false
                ? "We could not send the email right now. Please try again shortly."
                : "Verification email sent. Check your inbox."}
            </p>
          ) : null}

          {resend.isError ? (
            <p className="text-destructive" role="alert">
              {friendlyAuthErrorMessage(resend.error.message)}
            </p>
          ) : null}

          <Button
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
          >
            {resend.isPending ? "Sending…" : "Resend verification email"}
          </Button>
        </div>
      ) : null}

      {accept.error ? (
        <p className="text-sm text-red-600">{accept.error.message}</p>
      ) : null}

      {me.data.emailVerified ? (
        <Button
          onClick={() => accept.mutate()}
          disabled={accept.isPending}
        >
          {accept.isPending ? "Accepting…" : "Accept invite"}
        </Button>
      ) : null}
    </main>
  );
}
