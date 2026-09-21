"use client";

import type { CoupleMe } from "@/hooks/use-couple";
import { useMeQuery } from "@/hooks/use-me";
import { CoupleMemberItem } from "@/components/molecules/couple-member-item";
import { CoupleMark } from "@/components/organisms/couple-mark";

type CoupleMembersListProps = {
  members: CoupleMe["members"];
};

export function CoupleMembersList({ members }: CoupleMembersListProps) {
  const me = useMeQuery();
  const viewerId = me.data?.id;

  const viewer = viewerId
    ? members.find((m) => m.userId === viewerId)
    : undefined;
  const partner = viewerId
    ? members.find((m) => m.userId !== viewerId)
    : undefined;

  const ordered = [viewer, partner].filter(
    (m): m is CoupleMe["members"][number] => m != null,
  );
  const list = ordered.length > 0 ? ordered : members;

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good evening</p>
          <h1 className="mt-1 font-display text-4xl leading-tight">You &amp; {partner?.displayName}</h1>
        </div>
        <CoupleMark members={members} />
      </header>
      
    </section>
  );
}
