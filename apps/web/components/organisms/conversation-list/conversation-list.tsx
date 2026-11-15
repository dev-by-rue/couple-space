"use client";

import { ConversationCard } from "@/components/molecules/conversation-card/conversation-card";
import { ConversationLoader } from "@/components/molecules/conversation-loader/conversation-loader";
import { ErrorState } from "@/components/molecules/error-state/error-state";
import { useSessionsQuery } from "@/hooks/use-sessions";
import { splitActiveAndTalkedAbout } from "@/lib/session-sort";

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

  const { active, talkedAbout } = splitActiveAndTalkedAbout(sessions.data);

  return (
    <div className="flex flex-col gap-8">
      {active.length > 0 ? (
        <section
          aria-label="Your conversations"
          className="flex flex-col gap-2"
        >
          {active.map((session) => (
            <ConversationCard key={session.id} session={session} />
          ))}
        </section>
      ) : (
        <p className="text-sm">
          Nothing in progress. Start a new conversation above whenever
          you&apos;re ready.
        </p>
      )}

      {talkedAbout.length > 0 ? (
        <section
          aria-labelledby="talked-about-heading"
          className="flex flex-col gap-2"
        >
          <h2 id="talked-about-heading" className="text-lg font-semibold">
            We talked about
          </h2>
          {talkedAbout.map((session) => (
            <ConversationCard key={session.id} session={session} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
