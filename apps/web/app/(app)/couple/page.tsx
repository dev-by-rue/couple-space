"use client";

import { useCoupleMeQuery } from "@/hooks/use-couple";
import { CreateCouplePanel } from "@/components/organisms/create-couple-panel";
import { CoupleMembersList } from "@/components/organisms/couple-members-list";
import { InvitePartnerForm } from "@/components/organisms/invite-partner-form";
import { WelcomeBanner } from "@/components/molecules/welcome-banner";
import { StartConversation } from "@/components/molecules/start-conversation";
import { ConversationCard } from "@/components/molecules/conversation-card/conversation-card";
import type { SessionListItem } from "@/hooks/use-sessions";

// TEMP visual check — replace with useSessions data (hub list, plan step 3).
const EXAMPLE_SESSIONS: SessionListItem[] = [
  {
    id: "example-answering",
    promptTitle: "Everyday moments",
    promptText: "What small moment with me has stayed with you this week?",
    phase: "answering",
    updatedAt: "2026-10-10T09:00:00.000Z",
  },
  {
    id: "example-ready",
    promptTitle: "Looking ahead",
    promptText:
      "Where do you picture us spending a slow Sunday a year from now?",
    phase: "ready_to_reveal",
    updatedAt: "2026-10-09T18:30:00.000Z",
  },
  {
    id: "example-waiting",
    promptTitle: "Feeling cared for",
    promptText:
      "Think about a time recently when you felt really looked after by me. What was happening, what did I do or say, and why do you think it landed the way it did? This one is deliberately long to check that the text clamps to two lines.",
    phase: "waiting_for_partner",
    updatedAt: "2026-10-08T21:15:00.000Z",
  },
  {
    id: "example-revealed",
    promptTitle: "Small rituals",
    promptText: "Which little habit of ours would you never want to lose?",
    phase: "revealed",
    updatedAt: "2026-10-05T20:00:00.000Z",
  },
];

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
      <WelcomeBanner />
      <StartConversation />
      <section className="flex flex-col gap-3">
        {EXAMPLE_SESSIONS.map((session) => (
          <ConversationCard key={session.id} session={session} />
        ))}
      </section>
      {couple.data.status === "active" ? (
        <p className="text-sm">Couple active. Private space is ready.</p>
      ) : (
        <InvitePartnerForm coupleId={couple.data.coupleId} />
      )}
    </main>
  );
}
