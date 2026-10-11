import { Fragment } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ConversationLoader({
  count = 3,
}: Readonly<{ count?: number }>) {
  const placeholderIds = Array.from(
    { length: count },
    (_, i) => `conversation-placeholder-${i}`,
  );

  return (
    <output
      aria-label="Loading conversations"
      className="flex flex-col gap-2 ring-1"
    >
      {placeholderIds.map((id) => (
        <Fragment key={id}>
          <Skeleton
            aria-hidden="true"
            className="h-4 w-56 rounded-md bg-primary/70"
          />
          <Skeleton
            aria-hidden="true"
            className="w-full h-4 rounded-md bg-primary/70"
          />
          <Skeleton
            aria-hidden="true"
            className="w-full h-4 rounded-md bg-primary/70"
          />
          <Skeleton
            aria-hidden="true"
            className="w-full h-4 rounded-md bg-primary/70"
          />
        </Fragment>
      ))}
    </output>
  );
}
