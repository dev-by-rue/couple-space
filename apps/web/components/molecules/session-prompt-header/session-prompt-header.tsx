import type { SessionDetailDto } from "@/hooks/use-sessions";

type SessionPromptHeaderProps = {
  prompt: SessionDetailDto["prompt"];
};

export function SessionPromptHeader({
  prompt,
}: Readonly<SessionPromptHeaderProps>) {
  return (
    <header className="border-b border-accent pb-8">
      <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase bg-accent-soft px-3 py-1 rounded-full inline">
        {prompt.title}
      </p>
      <h1 className="mt-3 text-3xl leading-snug sm:text-4xl font-display">
        {prompt.text}
      </h1>
      {prompt.description && (
        <p className="mt-4 text-sm text-muted-foreground">
          {prompt.description}
        </p>
      )}
    </header>
  );
}
