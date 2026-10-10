import Link from "next/link";
import type { SessionListItem } from "@/hooks/use-sessions";
import { sessionCardActionLabel } from "@/lib/session-status-label";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ConversationStatusPill } from "@/components/molecules/conversation-status-pill/conversation-status-pill";

export interface ConversationCardProps {
  session: SessionListItem;
  className?: string;
}

/**
 * Whole card is the link. The CTA is a styled <span>, not a <button>,
 * so there is no interactive element nested inside the link.
 */
export function ConversationCard({
  session,
  className,
}: Readonly<ConversationCardProps>) {
  const actionLabel = sessionCardActionLabel(session.phase);

  return (
    <Link
      href={`/conversation/${session.id}`}
      aria-label={`${session.promptTitle}: ${actionLabel}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{session.promptTitle}</h3>
        <ConversationStatusPill phase={session.phase} className="shrink-0" />
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">
        {session.promptText}
      </p>

      <span
        aria-hidden="true"
        className={cn(
          buttonVariants({
            variant:
              session.phase === "ready_to_reveal" ? "default" : "outline",
          }),
          "self-start",
        )}
      >
        {actionLabel}
      </span>
    </Link>
  );
}
