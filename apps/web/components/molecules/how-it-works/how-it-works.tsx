import { cn } from "@/lib/utils";
import {
  LockKeyholeIcon,
  MessageCircleQuestionIcon,
  SparklesIcon,
} from "lucide-react";
export type HowItWorksStepsProps = {
  compact?: boolean;
  className?: string;
};

const STEPS = [
  {
    title: "Answer",
    text: "Privately, and in your own time",
    icon: LockKeyholeIcon,
  },
  { title: "Reveal", text: "When you're both ready", icon: SparklesIcon },
  {
    title: "Talk",
    text: "Follow-ups, or do it over dinner",
    icon: MessageCircleQuestionIcon,
  },
] as const;

export function HowItWorksSteps({
  compact = false,
  className,
}: Readonly<HowItWorksStepsProps>) {
  return (
    <ol
      className={cn("grid grid-cols-3", compact ? "gap-2" : "gap-3", className)}
    >
      {STEPS.map(({ title, text, icon: Icon }) => (
        <li key={title} className="text-center">
          <span className="mx-auto mb-2 grid size-10 place-items-center rounded bg-secondary text-secondary-foreground">
            <Icon aria-hidden="true" className="size-3" />
          </span>
          <strong className="block text-sm font-semibold">{title}</strong>
          <span className="text-xs text-muted-foreground">{text}</span>
        </li>
      ))}
    </ol>
  );
}
