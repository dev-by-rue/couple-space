"use client";

import { redirect, useParams, useRouter } from "next/navigation";
import { AcceptInvitePanel } from "@/components/organisms/accept-invite-panel";
import { useMeQuery } from "@/hooks/use-me";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const me = useMeQuery();

  if (me.isPending) {
    return <main className="p-6 text-sm">Checking session…</main>;
  }

  // Invitees usually need an account first — send unauthenticated users to register.
  if (me.isError) {
    redirect(`/register?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <AcceptInvitePanel
        token={token}
        email={me.data.email}
        emailVerified={me.data.emailVerified}
        onAccepted={() => router.replace("/couple")}
        onVerifiedRefresh={() => {
          void me.refetch();
        }}
      />
    </main>
  );
}
