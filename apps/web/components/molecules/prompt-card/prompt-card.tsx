import { ThemePrompt } from "@/hooks/use-themes";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";

type PromptCardProps = {
  prompt: ThemePrompt;
  onSelect: (promptId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PromptCard({
  prompt,
  onSelect,
  disabled,
  className,
}: Readonly<PromptCardProps>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(prompt.id)}
      disabled={disabled}
      className={cn(
        "group flex h-full flex-col justify-between gap-6 rounded-lg bg-card p-5 text-left text-card-foreground ring-1 ring-foreground/10 transition-all outline-none",
        "hover:ring-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span className="line-clamp-4 text-base leading-relaxed">
        {prompt.text}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
        Start this conversation
        <ArrowRightIcon
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}
