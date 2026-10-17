import { cn } from "@/lib/utils";

export type AnswerCardProps = {
  authorName: string;
  text: string;
  isOwn?: boolean;
  className?: string;
};
export function AnswerCard({
  authorName,
  text,
  isOwn,
  className,
}: Readonly<AnswerCardProps>) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-lg bg-card p-5 text-card-foreground ring-1 ring-foreground/10",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full text-sm font-semibold",
            isOwn
              ? "bg-accent-soft text-accent-foreground"
              : "bg-waiting-soft text-waiting-foreground",
          )}
        >
          {authorName.slice(0, 1).toUpperCase()}
        </span>
        <h3 className="font-semibold">{isOwn ? "You" : authorName}</h3>
        <p className="text-base leading-8 whitespace-pre-wrap">{text}</p>
      </header>
    </article>
  );
}
