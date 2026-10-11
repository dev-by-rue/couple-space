"use client";

import type { CoupleMe } from "@/hooks/use-couple";
import { useMeQuery } from "@/hooks/use-me";
import { CoupleMemberItem } from "@/components/molecules/couple-member-item";
import { CoupleMark } from "@/components/organisms/couple-mark";
import { greetingForHour } from "@/lib/greeting";

type CoupleMembersListProps = {
  members: CoupleMe["members"];
};

export function CoupleMembersList({
  members,
}: Readonly<CoupleMembersListProps>) {
  const me = useMeQuery();
  const viewerId = me.data?.id;

  const viewer = viewerId
    ? members.find((m) => m.userId === viewerId)
    : undefined;
  const partner = viewerId
    ? members.find((m) => m.userId !== viewerId)
    : undefined;

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greetingForHour()}</p>
          <h1 className="mt-1 font-sans text-4xl leading-tight">
            You &amp; {partner?.displayName}
          </h1>
        </div>
        <CoupleMark
          you={viewer?.displayName ?? ""}
          yourPartner={partner?.displayName ?? ""}
        />
      </header>
    </section>
  );
}
