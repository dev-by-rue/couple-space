"use client";

import { ConversationCard } from "@/components/molecules/conversation-card/conversation-card";
import { ConversationLoader } from "@/components/molecules/conversation-loader/conversation-loader";
import { useSessionsQuery } from "@/hooks/use-sessions";

export function ConversationList() {
  const sessions = useSessionsQuery();
  if (sessions.isPending) return <ConversationLoader count={3} />;
  if (sessions.isError) return <p>ERROR</p>;
  if (sessions.data.length === 0) return <p>EMPTY</p>;

  return (
    <section aria-label="Your conversations" className="flex flex-col gap-2">
      {sessions.data.map((session) => (
        <ConversationCard key={session.id} session={session} />
      ))}
    </section>
  );
}
