"use client";

import { ConversationCard } from "@/components/molecules/conversation-card/conversation-card";
import { ConversationLoader } from "@/components/molecules/conversation-loader/conversation-loader";
import { ErrorState } from "@/components/molecules/error-state/error-state";
import { useSessionsQuery } from "@/hooks/use-sessions";

export function ConversationList() {
  const sessions = useSessionsQuery();
  if (sessions.isPending) return <ConversationLoader count={3} />;
  if (sessions.isError)
    return (
      <ErrorState
        title="We couldn't load your conversations"
        onRetry={() => void sessions.refetch()}
      />
    );
  if (sessions.data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No conversations yet. Start one above, and it&apos;ll show up here.
      </p>
    );

  return (
    <section aria-label="Your conversations" className="flex flex-col gap-2">
      {sessions.data.map((session) => (
        <ConversationCard key={session.id} session={session} />
      ))}
    </section>
  );
}
