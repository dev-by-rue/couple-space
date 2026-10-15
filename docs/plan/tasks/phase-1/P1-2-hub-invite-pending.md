# P1-2 · Hub invite-pending parity: prototype reuse

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Gate B · Ticket T1 in [`04-tickets.md`](../../../extraction/04-tickets.md)

> **Status: reuse notes only.** This page collects the prototype code to carry over, adapted to `apps/web`.
> The full step-by-step guide gets written when you start Phase 1, against the code as it is then.

**Goal (from T1):** while the invite is pending, `/couple` shows a calm waiting panel with how-it-works
education, a disabled Start with the reason, and real resend/revoke actions. No prototype stubs.

---

## API gap to close first

The prototype's `InviteStatusCard` shows the invitee's email and offers "Resend" and "Copy link". Today:

- `GET /couples/me` returns members only, **not the pending invitation**, so the hub can't show who was invited or the link.
- There's no resend endpoint. Resending = revoke (`POST /invitations/:token/revoke`) plus create a new one (`POST /couples/:id/invitations`), which also issues a fresh link.

**Proposal:** add `pendingInvitation: { email, expiresAt, token } | null` to `GET /couples/me` (only for
members of that couple). Then "Copy link" and "Send a new link" work without new endpoints.

## From the prototype → `apps/web`

### `Steps` → `HowItWorksSteps`

Prototype (`between-us-source/src/components/couple-space.tsx`):

```tsx
export function Steps({ compact = false }: { compact?: boolean }) {
  const steps = [
    { title: "Answer", text: "Share privately", icon: LockKeyhole },
    { title: "Reveal", text: "Open together", icon: Sparkles },
    { title: "Talk", text: "Stay curious", icon: MessageCircleQuestion },
  ];
  …
}
```

Adapted. The "Open together" copy is wrong for per-user reveal (extraction map). Create
`apps/web/components/molecules/how-it-works-steps/how-it-works-steps.tsx`:

```tsx
import {
  LockKeyholeIcon,
  MessageCircleQuestionIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Answer", text: "Privately, in your own time", icon: LockKeyholeIcon },
  { title: "Reveal", text: "When you're both ready", icon: SparklesIcon },
  { title: "Talk", text: "Follow-ups, or over dinner", icon: MessageCircleQuestionIcon },
] as const;

type HowItWorksStepsProps = {
  /** Tighter spacing for use inside cards. */
  compact?: boolean;
  /** Extra classes merged onto the list. */
  className?: string;
};

export function HowItWorksSteps({
  compact = false,
  className,
}: Readonly<HowItWorksStepsProps>) {
  return (
    <ol
      className={cn("grid grid-cols-3", compact ? "gap-2" : "gap-3", className)}
    >
      {STEPS.map(({ title, text, icon: Icon }) => (
        <li key={title} className="text-center">
          <span className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <strong className="block text-sm font-semibold">{title}</strong>
          <span className="text-xs text-muted-foreground">{text}</span>
        </li>
      ))}
    </ol>
  );
}
```

### `InviteStatusCard` → `InvitePendingCard`

Prototype: same file, `InviteStatusCard`. It uses a `toast` and a hard-coded `https://example.com/invite/couple-1`.
**Don't port those.** Keep the look, and use the real invitation from the API gap above.

```tsx
"use client";

import { useState } from "react";
import { Clock3Icon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type InvitePendingCardProps = {
  /** Email the invite was sent to. */
  inviteeEmail: string;
  /** Full invite URL to copy. */
  inviteUrl: string;
  /** Revokes the current invite and creates a fresh one. */
  onSendNewLink: () => void;
  /** True while a new link is being created. */
  isSending: boolean;
};

export function InvitePendingCard({
  inviteeEmail,
  inviteUrl,
  onSendNewLink,
  isSending,
}: Readonly<InvitePendingCardProps>) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <section className="rounded-lg bg-card p-6 text-card-foreground ring-1 ring-foreground/10">
      <span className="grid size-11 place-items-center rounded-full bg-waiting-soft text-waiting-foreground">
        <Clock3Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-5 text-2xl">Your space is ready.</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Waiting for{" "}
        <span className="font-medium text-foreground">{inviteeEmail}</span> to
        join.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" onClick={copyLink}>
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
```

### Disabled Start with a reason

The prototype hub (`routes/index.tsx`, invite-pending branch) shows Start disabled. In `apps/web`, give
`StartConversation` a `disabledReason?: string` prop. When it's set, render a disabled
`<Button>` plus `<p className="text-sm text-muted-foreground">{disabledReason}</p>` instead of the `Link`
(for example, "You can start once your partner has joined."). `ui/tooltip` exists if you'd rather show it on hover,
but plain text is more accessible on mobile.

## Where it goes

`app/(app)/couple/page.tsx`, non-active branch: `InvitePendingCard` (or `InvitePartnerForm` when there's no
invite yet) → `HowItWorksSteps` → `StartConversation disabledReason=…`.
