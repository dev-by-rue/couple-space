# P0-3 · Waiting state

[← Phase 0](../phase-0-core-loop.md) · Size **S** · Depends on: [P0-2](P0-2-answering-state.md) · Next: [P0-5](P0-5-reveal.md)

**Goal:** after you submit, you see a calm "waiting on {partner}" screen and your own answer, and nothing of theirs.

**Done when:**
- In phase `waiting_for_partner` the page shows the waiting panel with your partner's name and copy that explains per-user reveal.
- Your own submitted answer shows underneath.
- Screen readers announce the waiting message (`aria-live="polite"`, NFR-01).

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Waiting tokens | `app/globals.css` | `bg-waiting-soft`, `text-waiting-foreground`, `border-waiting-border`, `shadow-soft`, in every palette |
| Your answer text | `SessionDetailDto.responses[]` | Your own `text` is filled once you've submitted; your partner's is `null` |
| Copy | [Walking-skeleton plan](../../../superpowers/plans/2026-09-21-conversation-walking-skeleton.md), "Consolidated plan" item 5 | Agreed waiting copy, used below |

## From the prototype

`WaitingState` and `AnswerCard` in `between-us-source/src/components/couple-space.tsx`:

```tsx
// prototype
export function WaitingState({ partner }: { partner: Member }) {
  return (
    <section aria-live="polite" className="rounded-card border border-waiting-border bg-waiting-soft p-7 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-card text-waiting-foreground shadow-soft">
        <Clock3 className="size-5" />
      </span>
      <h2 className="mt-5 font-display text-2xl">Waiting for {memberName(partner)}.</h2>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
        Your answer is safely submitted. Take your time—we'll reveal both answers together.
      </p>
      <p className="mt-5 text-sm text-waiting-foreground">We'll let you know when it's time to reveal.</p>
    </section>
  );
}

export function AnswerCard({ member, text }: { member: Member; text: string }) {
  return (
    <article className="rounded-card border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-foreground">
          {memberName(member).slice(0, 1)}
        </span>
        <h3 className="font-semibold">{memberName(member)}</h3>
      </div>
      <p className="mt-5 text-[1.05rem] leading-8">{text}</p>
    </article>
  );
}
```

**What changes and why:**
- Copy: "we'll reveal both answers together" and "We'll let you know" are wrong for this product. Reveal is
  per user, and there are no notifications yet. The agreed walking-skeleton copy replaces them.
- `AnswerCard` takes `authorName` + `text` instead of a prototype `Member`. It adds `isOwn` (a different avatar
  colour and a "You" label) and `whitespace-pre-wrap`, so line breaks in answers survive. The prototype drops them.
- `AnswerCard` is built here because P0-5 reuses it for the revealed answers.

---

## Steps

### Step 1 · `AnswerCard` molecule

Create `apps/web/components/molecules/answer-card/answer-card.tsx`:

```tsx
import { cn } from "@/lib/utils";

type AnswerCardProps = {
  /** Display name of whoever wrote the answer. */
  authorName: string;
  /** The answer text, already unredacted by the API. */
  text: string;
  /** True for the viewer's own answer. Changes the label and avatar colour. */
  isOwn?: boolean;
  /** Extra classes merged onto the card. */
  className?: string;
};

export function AnswerCard({
  authorName,
  text,
  isOwn = false,
  className,
}: Readonly<AnswerCardProps>) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-lg bg-card p-5 text-card-foreground ring-1 ring-foreground/10",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-9 place-items-center rounded-full text-sm font-semibold",
            isOwn
              ? "bg-accent-soft text-accent-foreground"
              : "bg-waiting-soft text-waiting-foreground",
          )}
        >
          {authorName.slice(0, 1).toUpperCase()}
        </span>
        <h3 className="font-semibold">{isOwn ? "You" : authorName}</h3>
      </header>
      <p className="text-base leading-8 whitespace-pre-wrap">{text}</p>
    </article>
  );
}
```

### Step 2 · `SessionWaiting` molecule

Create `apps/web/components/molecules/session-waiting/session-waiting.tsx`:

```tsx
import { Clock3Icon } from "lucide-react";
import { AnswerCard } from "@/components/molecules/answer-card/answer-card";

type SessionWaitingProps = {
  /** The partner's display name. */
  partnerName: string;
  /** The viewer's display name, for their answer card. */
  viewerName: string;
  /** The viewer's submitted answer, or null if the API didn't return it. */
  ownAnswer: string | null;
};

/**
 * Shown after the viewer submits and before their partner has.
 *
 * @remarks
 * Must never show anything of the partner's answer. The API already redacts
 * it, and this component doesn't take it as a prop.
 */
export function SessionWaiting({
  partnerName,
  viewerName,
  ownAnswer,
}: Readonly<SessionWaitingProps>) {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-live="polite"
        className="rounded-lg border border-waiting-border bg-waiting-soft p-7 text-center"
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-card text-waiting-foreground shadow-soft">
          <Clock3Icon aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-5 text-2xl">Waiting on {partnerName}</h2>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
          Your answer is saved and can&apos;t be changed. {partnerName}{" "}
          can&apos;t see it. Once {partnerName} has answered, you&apos;ll both
          get a Reveal button — open the answers whenever you&apos;re ready.
        </p>
      </section>

      {ownAnswer ? (
        <AnswerCard authorName={viewerName} text={ownAnswer} isOwn />
      ) : null}
    </div>
  );
}
```

### Step 3 · Wire it into the page

In `app/(app)/conversation/[id]/page.tsx`:

```tsx
import { SessionWaiting } from "@/components/molecules/session-waiting/session-waiting";
```

Next to the `partner` lines from P0-2, add:

```tsx
  const own = data.responses.find((r) => r.userId === me.data.id);
```

Replace the `waiting_for_partner` placeholder:

```tsx
      {data.phase === "waiting_for_partner" && (
        <SessionWaiting
          partnerName={partnerName}
          viewerName={me.data.displayName}
          ownAnswer={own?.text ?? null}
        />
      )}
```

---

## Check

1. Submit an answer: the waiting panel shows your partner's name, and your answer is underneath with a "You" label.
2. Write an answer with line breaks: they're kept in the card.
3. Partner's browser: their page still says it's their turn, and the network response has your `text: null`.
4. VoiceOver/NVDA: the waiting message is announced after submitting.
5. Light/dark and each Theme Lab palette: the waiting panel uses the waiting colours, with no hard-coded hex.

## Pitfalls

- The page won't move on by itself when your partner answers until [P0-6](P0-6-keep-fresh.md) (refetch on focus and polling).
