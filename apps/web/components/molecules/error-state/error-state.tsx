import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  message = "Check your connection and try again.",
  onRetry,
}: Readonly<ErrorStateProps>) {
  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 p-6 text-center"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </section>
  );
}
