"use client";

import { useAcceptInviteMutation } from "@/hooks/use-couple";
import { useResendVerificationMutation } from "@/hooks/use-auth-mutations";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";

type AcceptInvitePanelProps = {
  token: string;
  email: string;
  emailVerified: boolean;
  onAccepted: () => void;
  onVerifiedRefresh: () => void;
};

export function AcceptInvitePanel({
  token,
  email,
  emailVerified,
  onAccepted,
  onVerifiedRefresh,
}: AcceptInvitePanelProps) {
  const accept = useAcceptInviteMutation({
    onSuccess: () => onAccepted(),
  });

  const resend = useResendVerificationMutation({
    onSuccess: (data) => {
      if (data.alreadyVerified) {
        onVerifiedRefresh();
      }
    },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">Accept invitation</h1>
      <p className="text-muted-foreground text-sm">
        Signed in as {email}. Accepting joins this couple if the invite matches
        your email and you are verified.
      </p>

      {!emailVerified ? (
        <div className="space-y-3 rounded-md border p-3 text-sm">
          <p>
            Your email is not verified yet. Check your inbox for a verification
            link.
          </p>

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

          <Button onClick={() => resend.mutate()} disabled={resend.isPending}>
            {resend.isPending ? "Sending…" : "Resend verification email"}
          </Button>
        </div>
      ) : null}

      {accept.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {accept.error.message}
        </p>
      ) : null}

      {emailVerified ? (
        <Button
          onClick={() => accept.mutate({ token })}
          disabled={accept.isPending}
        >
          {accept.isPending ? "Accepting…" : "Accept invite"}
        </Button>
      ) : null}
    </>
  );
}
