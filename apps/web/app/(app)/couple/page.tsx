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
import { ErrorState } from "@/components/molecules/error-state/error-state";
import { PageLoading } from "@/components/organisms/page-loading/page-loading";

export default function CouplePage() {
  const couple = useCoupleMeQuery();
  const sendNewLink = useSendNewInviteLinkMutation();
  const revokeInvite = useRevokeInviteMutation();

  if (couple.isPending) {
    return <PageLoading message="We're getting your space ready..." />;
  }

  if (couple.isError) {
    return (
      <main className="flex min-h-svh items-center">
        <ErrorState
          title="We couldn't load your space"
          onRetry={() => void couple.refetch()}
        />
      </main>
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
