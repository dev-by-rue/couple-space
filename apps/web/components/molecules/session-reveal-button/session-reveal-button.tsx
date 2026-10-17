import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SessionRevealButtonProps = {
  partnerName: string;
  isRevealing: boolean;
  errorMessage?: string;
  onReveal: () => void;
};

/**
 * The per-user Reveal step, shown once both partners have submitted.
 *
 * @remarks
 * Revealing will only affect the veiwer.
 */
export function SessionRevealButton({
  partnerName,
  isRevealing,
  errorMessage,
  onReveal,
}: Readonly<SessionRevealButtonProps>) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col items-center gap-4 rounded-lg bg-accent-soft p-7 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-card text-accent-foreground shadow-soft">
        <SparklesIcon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-2xl">You&apos;ve both answered</h2>
      <p className="max-w-md leading-relaxed text-muted-foreground">
        Reveal when you&apos;re ready. This opens the answers for you —{" "}
        {partnerName} reveals in their own time.
      </p>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Button
        size="lg"
        className="px-8 text-sm"
        disabled={isRevealing}
        onClick={onReveal}
      >
        {isRevealing ? "Revealing…" : "Reveal answers"}
      </Button>
    </section>
  );
}
