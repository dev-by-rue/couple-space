import { CoffeeIcon } from "lucide-react";

/** A gentle nudge to continue the conversation away from the app. */
export function TakeItOffline() {
  return (
    <section className="flex items-start gap-4 rounded-lg bg-accent-soft p-5">
      <CoffeeIcon
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-accent-foreground"
      />
      <div>
        <h3 className="font-semibold">Keep talking in person</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The best follow-up might be over dinner or a walk. There&apos;s no
          need to answer anything else here.
        </p>
      </div>
    </section>
  );
}
