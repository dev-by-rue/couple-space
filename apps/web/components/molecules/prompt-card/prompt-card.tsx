import { ThemePrompt } from "@/hooks/use-themes";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";

type PromptCardProps = {
  prompt: ThemePrompt;
  onSelect: (promptId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function PromptCard({ prompt, onSelect, disabled, className }: Readonly<PromptCardProps>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(prompt.id)}
      disabled={disabled}
      className={cn("flex flex-col gap-2 ring-1 ring-foreground/10 rounded-md p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring text-left", className)}
    >
      <span className="font-semibold leading-snug line-clamp-3">{prompt.text}</span>
      <ArrowRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
    </button>
  );
}