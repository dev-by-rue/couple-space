# P1-8 · Curated follow-ups: prototype reuse

[← Phase 1](../phase-1-mvp-1.md) · Size **L** · Gate A · Decisions: [Q1](../../03-product-decisions.md#q1), [Q22](../../03-product-decisions.md#q22) · Schema: [ERD MVP-1](../../erd/mvp-1.md)

> **Status: reuse notes only.** This page collects the prototype UI to carry over, adapted to `apps/web`.
> The full guide (schema, API, domain changes) gets written when you start Phase 1, because it depends on
> the exact `GET /sessions/:id` shape you settle on. The props below assume the proposed shape.

**Goal:** after both partners reveal the main prompt, show optional follow-ups. Each one is answered blind and
**auto-shows** once both have submitted (no Reveal tap), plus a "take it offline" card.

---

## Proposed API shape (to confirm when writing the full guide)

`GET /sessions/:id` gains, only when both have revealed the main prompt (FR-19):

```ts
followUps: Array<{
  promptId: string;            // follow-up prompt (kind = 'follow_up')
  text: string;
  sessionId: string | null;    // child session, null until someone starts it
  phase: "answering" | "waiting_for_partner" | "revealed" | null; // no ready_to_reveal (Q22)
  responses: SessionDetailDto["responses"];  // same redaction rules
}>;
```

## From the prototype → `apps/web`

### `FollowUpCard`

Prototype (`between-us-source/src/components/couple-space.tsx`): reads `useCouplePrototype()` and submits
through mock state. Its three branches (answer / waiting / both shown) already match Q22, because the
prototype never had a reveal step for follow-ups.

```tsx
// prototype, trimmed
{all ? (
  <div className="mt-5 grid gap-3 sm:grid-cols-2">{/* AnswerCard per member */}</div>
) : own?.submitted ? (
  <p className="mt-5 rounded-md bg-waiting-soft p-4 text-sm leading-relaxed text-waiting-foreground">
    Your response is saved. Waiting for {partnerName}; both responses will appear together.
  </p>
) : (
  <div className="mt-5">
    <Textarea value={answer} … placeholder="Your private response" />
    <Button className="mt-3 h-11" disabled={!answer.trim()} onClick={…}>Submit response</Button>
  </div>
)}
```

Adapted: presentational and prop-driven, reusing `AnswerCard` from P0-3. The "Answer this" button
creates the child session lazily. Create `apps/web/components/organisms/follow-up-card/follow-up-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ANSWER_MAX_LENGTH } from "@couple-space/domain";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnswerCard } from "@/components/molecules/answer-card/answer-card";

type FollowUpResponse = {
  userId: string;
  displayName: string;
  text: string | null;
};

type FollowUpCardProps = {
  /** The follow-up question. */
  question: string;
  /** Viewer phase for this follow-up; `null` until someone starts it. */
  phase: "answering" | "waiting_for_partner" | "revealed" | null;
  /** Both members' responses, redacted by the API. */
  responses: FollowUpResponse[];
  /** The viewer's user id. */
  viewerId: string;
  /** The partner's display name. */
  partnerName: string;
  /** True while starting or submitting. */
  isBusy: boolean;
  /** Called with the trimmed answer. The page starts the child session first if needed. */
  onSubmit: (text: string) => void;
};

/**
 * One optional follow-up under the revealed answers.
 *
 * @remarks
 * Follow-ups have no Reveal step (Q22): once both have submitted, the API
 * returns both texts and the card shows them.
 */
export function FollowUpCard({
  question,
  phase,
  responses,
  viewerId,
  partnerName,
  isBusy,
  onSubmit,
}: Readonly<FollowUpCardProps>) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const trimmed = text.trim();

  return (
    <article className="flex flex-col gap-4 rounded-lg bg-card p-5 text-card-foreground ring-1 ring-foreground/10">
      <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
        Follow-up
      </p>
      <h3 className="text-xl leading-snug">{question}</h3>

      {phase === "revealed" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {responses.map((r) =>
            r.text === null ? null : (
              <AnswerCard
                key={r.userId}
                authorName={r.displayName}
                text={r.text}
                isOwn={r.userId === viewerId}
              />
            ),
          )}
        </div>
      ) : phase === "waiting_for_partner" ? (
        <p
          aria-live="polite"
          className="rounded-lg bg-waiting-soft p-4 text-sm leading-relaxed text-waiting-foreground"
        >
          Your answer is saved. Both answers appear as soon as {partnerName} has
          answered too.
        </p>
      ) : open || phase === "answering" ? (
        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Your private answer"
            aria-label={`Your answer to: ${question}`}
            className="min-h-28 resize-none rounded-lg bg-background p-4 text-sm md:text-sm"
          />
          <Button
            className="self-start"
            disabled={!trimmed || trimmed.length > ANSWER_MAX_LENGTH || isBusy}
            onClick={() => onSubmit(trimmed)}
          >
            {isBusy ? "Sending…" : "Submit answer"}
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
          Answer this
        </Button>
      )}
    </article>
  );
}
```

**What changed from the prototype:** no mock context; no "both responses will appear together" (it's
"as soon as {partner} has answered"); answers only render when the API returned text; the textarea is
hidden behind "Answer this" so the list stays calm and optional (FR-20); and there's a length limit.

> No confirm dialog on follow-ups. They're lighter-weight than the main prompt. Decide when writing the
> full guide if you want one for consistency.

### "Take it offline" card (new, FR-22)

There's no prototype equivalent. Suggested `apps/web/components/molecules/take-it-offline/take-it-offline.tsx`:

```tsx
import { CoffeeIcon } from "lucide-react";

export function TakeItOffline() {
  return (
    <section className="flex items-start gap-4 rounded-lg bg-accent-soft p-5">
      <CoffeeIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-foreground" />
      <div>
        <h3 className="font-semibold">Keep talking in person</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The best follow-up might be over dinner or a walk. There&apos;s no need
          to answer anything else here.
        </p>
      </div>
    </section>
  );
}
```

## Where it goes

Under `SessionRevealPanel` on the conversation page, **only in phase `revealed` and only when
`followUps` is present** (both revealed):

```tsx
<section className="flex flex-col gap-4">
  <h2 className="text-2xl">Keep exploring (optional)</h2>
  {data.followUps.map((f) => <FollowUpCard key={f.promptId} … />)}
  <TakeItOffline />
</section>
```

Skip the prototype's "Ask {partner}" section and `DirectedQuestionCard`: partner-added questions are
[P2-7](../phase-2-couple-created.md) and work like follow-ups ([Q21](../../03-product-decisions.md#q21)).
