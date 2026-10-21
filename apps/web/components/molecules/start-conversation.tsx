import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StartConversationProps = {
  disabledReason?: string;
};

export function StartConversation({
  disabledReason,
}: Readonly<StartConversationProps>) {
  return (
    <section>
      <h2 className="text-2xl">A little time for the two of you</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Choose a question, answer privately, and reveal when you&apos;re both
        ready.
      </p>
      {disabledReason ? (
        <>
          <Button
            size="lg"
            disabled
            aria-describedby="start-disabled-reason"
            className="mt-4 w-full rounded-md text-md"
          >
            Start a conversation
          </Button>
          <p
            id="start-disabled-reason"
            className="mt-2 text-sm text-muted-foreground"
          >
            {disabledReason}
          </p>
        </>
      ) : (
        <Link
          href="/start"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-4 w-full rounded-md text-md",
          )}
        >
          Start a conversation
        </Link>
      )}
    </section>
  );
}
