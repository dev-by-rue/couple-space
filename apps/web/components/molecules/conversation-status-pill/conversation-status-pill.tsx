import { sessionStatusLabel } from "@/lib/session-status-label";
import { cn } from "@/lib/utils";
import type { SessionViewerPhase } from "@couple-space/domain";
import { cva } from "class-variance-authority";

const conversationStatusPillVariants = cva(
  "inline-flex min-h-7 items-center rounded-full text-center justify-center px-3 text-sm font-semibold",
  {
    variants: {
      variant: {
        answering: "bg-accent-soft text-accent-foreground",
        waiting_for_partner: "bg-waiting-soft text-waiting-foreground",
        ready_to_reveal: "bg-primary text-primary-foreground",
        revealed: "bg-secondary text-secondary-foreground",
      },
    },
  },
);

type ConversationStatusPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** The viewer's phase; drives both the label and the colour. */
  phase: SessionViewerPhase;
};

export function ConversationStatusPill({
  className,
  phase,
  ...props
}: Readonly<ConversationStatusPillProps>) {
  const label = sessionStatusLabel(phase);
  return (
    <span
      className={cn(
        conversationStatusPillVariants({ variant: phase }),
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}
