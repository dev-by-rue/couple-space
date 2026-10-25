"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  sessionQueryKey,
  useStartFollowUpMutation,
  useSubmitResponseMutation,
  type FollowUp,
} from "@/hooks/use-sessions";
import { apiErrorReason } from "@/lib/api/api-error";
import { FollowUpCard } from "@/components/organisms/follow-up-card/follow-up-card";
import { TakeItOffline } from "@/components/molecules/take-it-offline/take-it-offline";

type FollowUpListProps = {
  /** The revealed main session the follow-ups belong to. */
  parentSessionId: string;
  followUps: FollowUp[];
  /** The viewer's user id. */
  viewerId: string;
  /** The partner's display name. */
  partnerName: string;
};

/**
 * The optional follow-ups under a revealed conversation, then the offline card.
 *
 * @remarks
 * A question can ship without follow-ups; then only the offline card shows.
 */
export function FollowUpList({
  parentSessionId,
  followUps,
  viewerId,
  partnerName,
}: Readonly<FollowUpListProps>) {
  if (followUps.length === 0) return <TakeItOffline />;

  return (
    <section
      aria-labelledby="follow-ups-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="follow-ups-heading" className="text-2xl">
        Keep exploring (optional)
      </h2>
      {followUps.map((followUp) => (
        <FollowUpItem
          key={followUp.promptId}
          parentSessionId={parentSessionId}
          followUp={followUp}
          viewerId={viewerId}
          partnerName={partnerName}
        />
      ))}
      <TakeItOffline />
    </section>
  );
}

type FollowUpItemProps = {
  parentSessionId: string;
  followUp: FollowUp;
  viewerId: string;
  partnerName: string;
};

/** One card's mutations, so pending and error state stay on the card you used. */
function FollowUpItem({
  parentSessionId,
  followUp,
  viewerId,
  partnerName,
}: Readonly<FollowUpItemProps>) {
  const client = useQueryClient();
  const start = useStartFollowUpMutation();
  const submit = useSubmitResponseMutation({
    onError: (error) => {
      if (apiErrorReason(error) === "already_submitted") {
        void client.invalidateQueries({
          queryKey: sessionQueryKey(parentSessionId),
        });
      }
    },
  });

  return (
    <FollowUpCard
      question={followUp.text}
      phase={followUp.phase}
      responses={followUp.responses}
      viewerId={viewerId}
      partnerName={partnerName}
      isSubmitting={start.isPending || submit.isPending}
      errorMessage={
        start.isError || submit.isError
          ? "Your answer didn't send. Your text is still here - try again"
          : undefined
      }
      onSubmit={(text) => {
        if (followUp.sessionId) {
          submit.mutate({ sessionId: followUp.sessionId, text });
          return;
        }
        // Start the child lazily, then submit into it.
        start.mutate(
          { parentSessionId, promptId: followUp.promptId },
          { onSuccess: ({ id }) => submit.mutate({ sessionId: id, text }) },
        );
      }}
    />
  );
}
