"use client";

import { useCoupleMeQuery } from "@/hooks/use-couple";
import { CreateCouplePanel } from "@/components/organisms/create-couple-panel";
import { CoupleMembersList } from "@/components/organisms/couple-members-list";
import { InvitePartnerForm } from "@/components/organisms/invite-partner-form";
import { X, Heart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function CouplePage() {
  const couple = useCoupleMeQuery();
  const [firstVisit, setFirstVisit] = useState(true);

  if (couple.data) console.log(couple);

  if (couple.isPending) {
    return <main className="p-6 text-sm">Loading couple…</main>;
  }

  if (couple.isError) {
    return (
      <main className="p-6 text-sm text-red-600">{couple.error.message}</main>
    );
  }

  if (!couple.data) {
    return <CreateCouplePanel />;
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-6">
      <CoupleMembersList members={couple.data.members} />
      <div className="mt-10">
        {firstVisit && (
          <section className="relative mb-8 overflow-hidden rounded-lg bg-accent-soft p-6 shadow">
            <Button
              variant="ghost"
              className="absolute right-2 top-2"
              aria-label="Dismiss welcome"
              onClick={() => setFirstVisit(false)}
            >
              <X />
            </Button>
            <Heart className="size-5 text-accent-foreground" />
            <h2 className="mt-4 font-sans text-2xl text-foreground">
              This space belongs to both of you.
            </h2>
            <p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">
              There are no right ways to answer. Take your time, be honest, and
              meet each other with curiosity.
            </p>
          </section>
        )}
      </div>
      {couple.data.status === "active" ? (
        <p className="text-sm">Couple active. Private space is ready.</p>
      ) : (
        <InvitePartnerForm coupleId={couple.data.coupleId} />
      )}
    </main>
  );
}
