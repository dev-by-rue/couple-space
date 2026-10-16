import { Clock3Icon } from "lucide-react";
import { AnswerCard } from "../answer-card/answer-card";

export type SessionWaitingProps = {
  partnerName: string;
  viewerName: string;
  ownAnswer: string | null;
};

export function SessionWaiting({
  partnerName,
  viewerName,
  ownAnswer,
}: Readonly<SessionWaitingProps>) {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-live="polite"
        className="rounded-lg border border-waiting-border bg-waiting-soft p-7 text-center"
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-card text-waiting-foreground shadow-soft">
          <Clock3Icon aria-hidden="true" className="size-4" />
        </span>
        <h2 className="mt-5 text-2xl">Waiting on {partnerName}</h2>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted-foreground">
          Your answer is saved and can&apos;t be changed. {partnerName}{" "}
          can&apos;t see it. Once {partnerName} has answered, you&apos;ll both
          get a Reveal button — open the answers whenever you&apos;re ready.
        </p>
      </section>

      {ownAnswer ? (
        <AnswerCard authorName={viewerName} text={ownAnswer} isOwn />
      ) : null}
    </div>
  );
}
