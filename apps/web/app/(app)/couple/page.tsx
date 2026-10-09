"use client";

import { useCoupleMeQuery } from "@/hooks/use-couple";
import { CreateCouplePanel } from "@/components/organisms/create-couple-panel";
import { CoupleMembersList } from "@/components/organisms/couple-members-list";
import { InvitePartnerForm } from "@/components/organisms/invite-partner-form";
import { WelcomeBanner } from "@/components/molecules/welcome-banner";
import { StartConversation } from "@/components/molecules/start-conversation";
import { ConversationStatusPill } from "@/components/molecules/conversation-status-pill/conversation-status-pill";

export default function CouplePage() {
  const couple = useCoupleMeQuery();

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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-6">
      <CoupleMembersList members={couple.data.members} />
      <div className="m-2 flex gap-1">
        <ConversationStatusPill phase="revealed" />
        <ConversationStatusPill phase="waiting_for_partner" />
        <ConversationStatusPill phase="ready_to_reveal" />
        <ConversationStatusPill phase="answering" />
      </div>
      <WelcomeBanner />
      <StartConversation />
      {couple.data.status === "active" ? (
        <p className="text-sm">Couple active. Private space is ready.</p>
      ) : (
        <InvitePartnerForm coupleId={couple.data.coupleId} />
      )}
    </main>
  );
}
