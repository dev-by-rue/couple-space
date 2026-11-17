import Link from "next/link";
import { PROMPT_DEPTH_LABELS } from "@couple-space/domain";
import type { ThemePrompt } from "@/hooks/use-themes";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";

type PromptCardProps = {
  prompt: ThemePrompt;
  onSelect: (promptId: string) => void;
  disabled?: boolean;
  className?: string;
};

const cardClassName = cn(
  "group flex h-full flex-col justify-between gap-6 rounded-lg bg-card p-5 text-left text-card-foreground ring-1 ring-foreground/10 transition-all outline-none",
  "hover:ring-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
);

/**
 * One question on a theme page.
 *
 * @remarks
 * An unanswered prompt is a button that starts the conversation. One the
 * couple has answered is a link to that conversation instead,
 * so it can never be started twice.
 */
export function PromptCard({
  prompt,
  onSelect,
  disabled,
  className,
}: Readonly<PromptCardProps>) {
  if (prompt.answeredSessionId) {
    return (
      <Link
        href={`/conversation/${prompt.answeredSessionId}`}
        className={cn(cardClassName, className)}
      >
        <PromptCardBody
          prompt={prompt}
          action="See what you said"
          talkedAbout
        />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(prompt.id)}
      disabled={disabled}
      className={cn(
        cardClassName,
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <PromptCardBody prompt={prompt} action="Start this conversation" />
    </button>
  );
}

type PromptCardBodyProps = {
  prompt: ThemePrompt;
  /** The call to action on the right. */
  action: string;
  /** Adds the "Talked about" badge. */
  talkedAbout?: boolean;
};

function PromptCardBody({
  prompt,
  action,
  talkedAbout,
}: Readonly<PromptCardBodyProps>) {
  return (
    <>
      <span className="line-clamp-4 text-base leading-relaxed">
        {prompt.text}
      </span>
      <span className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-foreground">
            {PROMPT_DEPTH_LABELS[prompt.depth]}
          </span>
          {talkedAbout ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Talked about
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
          {action}
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </>
  );
}
