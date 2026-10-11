import { Fragment } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type ConversationLoaderProps = {
  /** How many placeholder conversations to show. Defaults to 3. */
  count?: number;
};

/**
 * Pulsing placeholders shown while the conversation list loads.
 *
 * @remarks
 * Rendered as an `<output>` (implicit `status` role) so screen readers
 * announce "Loading conversations" once; the individual bars are hidden.
 */
export function ConversationLoader({
  count = 3,
}: Readonly<ConversationLoaderProps>) {
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
