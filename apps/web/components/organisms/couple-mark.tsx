"use client";

import type { CoupleMe } from "@/hooks/use-couple";
import { useMeQuery } from "@/hooks/use-me";

type CoupleMarkProps = {
  members: CoupleMe["members"];
};

export function CoupleMark({ members }: CoupleMarkProps) {
  const me = useMeQuery();
  const viewerId = me.data?.id;

  const viewer = viewerId
    ? members.find((m) => m.userId === viewerId)
    : undefined;
  const partner = viewerId
    ? members.find((m) => m.userId !== viewerId)
    : undefined;

  return (
    <div
      className="flex -space-x-2"
      aria-label={[viewer?.displayName, partner?.displayName]
        .filter(Boolean)
        .join(" and ")}
    >
      <span className="grid size-11 place-items-center rounded-full border-2 border-background bg-primary text-sm font-semibold text-primary-foreground">
        {viewer?.displayName?.slice(0, 1)}
      </span>
      <span className="grid size-11 place-items-center rounded-full border-2 border-background bg-secondary text-sm font-semibold text-secondary-foreground">
        {partner?.displayName?.slice(0, 1) ?? "?"}
      </span>
    </div>
  );
}
