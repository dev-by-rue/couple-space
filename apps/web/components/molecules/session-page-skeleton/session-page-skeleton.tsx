import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for the conversation page while the session loads.
 *
 * @remarks
 * Rendered as an `<output>` (implicit `status` role), the same pattern as
 * `ConversationLoader`, so screen readers announce it once.
 */
export function SessionPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <output aria-label="Loading conversation" className="flex flex-col gap-8">
        <Skeleton aria-hidden="true" className="h-8 w-48 rounded-md" />
        <div className="flex flex-col gap-3 border-b border-border pb-8">
          <Skeleton aria-hidden="true" className="h-3 w-28 rounded-md" />
          <Skeleton aria-hidden="true" className="h-9 w-full rounded-md" />
          <Skeleton aria-hidden="true" className="h-9 w-2/3 rounded-md" />
        </div>
        <Skeleton aria-hidden="true" className="h-56 w-full rounded-lg" />
      </output>
    </main>
  );
}
