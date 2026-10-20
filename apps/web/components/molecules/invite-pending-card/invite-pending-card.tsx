"use client";

import { Button } from "@/components/ui/button";
import { Clock3Icon, CopyIcon } from "lucide-react";
import { useState } from "react";

export type InvitePendingCardProps = {
  inviteeEmail: string;
  inviteUrl: string;
  isSending: boolean;
  onSendNewLink: () => void;
};

export function InvitePendingCard({
  inviteeEmail,
  inviteUrl,
  isSending,
  onSendNewLink,
}: Readonly<InvitePendingCardProps>) {
  const [copied, setCopied] = useState<boolean>(false);

  async function copySendLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <section className="rounded-lg bg-card p-6 text-card-foreground ring-1 ring-foreground/10">
      <span className="grid size-11 place-items-center rounded-full bg-waiting-soft text-waiting-foreground">
        <Clock3Icon aria-hidden="true" className="size-4" />
      </span>
      <h2 className="mt-4 text-2xl">Your space is ready.</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Waiting for{" "}
        <span className="font-medium text-foreground">{inviteeEmail}</span> to
        join.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" onClick={copySendLink}>
          <CopyIcon aria-hidden="true" />
          {copied ? "Link copied" : "Copy invite link"}
        </Button>
        <Button variant="outline" disabled={isSending} onClick={onSendNewLink}>
          {isSending ? "Creating…" : "Send a new link"}
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Invite link copied" : ""}
      </p>
    </section>
  );
}
