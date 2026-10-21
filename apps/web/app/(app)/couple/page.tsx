"use client";

import {
  useCoupleMeQuery,
  useRevokeInviteMutation,
  useSendNewInviteLinkMutation,
} from "@/hooks/use-couple";
import { CreateCouplePanel } from "@/components/organisms/create-couple-panel";
import { CoupleMembersList } from "@/components/organisms/couple-members-list";
import { InvitePartnerForm } from "@/components/organisms/invite-partner-form";
import { WelcomeBanner } from "@/components/molecules/welcome-banner";
import { StartConversation } from "@/components/molecules/start-conversation";
import { ConversationList } from "@/components/organisms/conversation-list/conversation-list";
import { InvitePendingCard } from "@/components/molecules/invite-pending-card/invite-pending-card";
import { HowItWorksSteps } from "@/components/molecules/how-it-works/how-it-works";

export default function CouplePage() {
  const couple = useCoupleMeQuery();
  const sendNewLink = useSendNewInviteLinkMutation();
  const revokeInvite = useRevokeInviteMutation();

  if (couple.isPending) {
    return <main className="p-6 text-sm">Loading couple…</main>;
  }

  if (couple.isError) {
    return (
      <main className="p-6 text-sm text-red-600">{couple.error.message}</main>
    );
  }

  if (!couple.data) {
    return <CreateCouplePanel />;
  }

  const { coupleId, status, members, pendingInvitation } = couple.data;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-6">
      <CoupleMembersList members={members} />
      <WelcomeBanner />
      {status === "active" ? (
        <>
          <StartConversation />
          <ConversationList />
        </>
      ) : (
        <>
          {pendingInvitation ? (
            <InvitePendingCard
              inviteUrl={`${window.location.origin}/invite/${pendingInvitation.token}`}
              inviteeEmail={pendingInvitation.email}
              isSending={sendNewLink.isPending}
              isCancelling={revokeInvite.isPending}
              isError={revokeInvite.isError || sendNewLink.isError}
              onSendNewLink={() =>
                sendNewLink.mutate({
                  coupleId,
                  token: pendingInvitation.token,
                  email: pendingInvitation.email,
                })
              }
              onCancelInvite={() =>
                revokeInvite.mutate({ token: pendingInvitation.token })
              }
            />
          ) : (
            <InvitePartnerForm coupleId={coupleId} />
          )}
          <HowItWorksSteps />
          <StartConversation disabledReason="You can start up a conversation once your partner has joined." />
        </>
      )}
    </main>
  );
}
