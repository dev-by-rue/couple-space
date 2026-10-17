import type { SessionDetailDto } from "@/hooks/use-sessions";
import { AnswerCard } from "@/components/molecules/answer-card/answer-card";

export type SessionRevealPanelProps = {
  responses: SessionDetailDto["responses"];
  viewerId: string;
};

export function SessionRevealPanel({
  responses,
  viewerId,
}: Readonly<SessionRevealPanelProps>) {
  const ordered = [...responses].sort(
    (a, b) => Number(b.userId === viewerId) - Number(a.userId === viewerId),
  );

  return (
    <section
      aria-labelledby="revealed-heading"
      className="flex flex-col gap-5 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
    >
      <h2 id="revealed-heading" className="text-2xl">
        Both answers
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ordered.map((response) =>
          response.text === null ? null : (
            <AnswerCard
              key={response.userId}
              authorName={response.displayName}
              text={response.text}
              isOwn={response.userId === viewerId}
            />
          ),
        )}
      </div>
    </section>
  );
}
