# P0-5 · Ready-to-reveal and revealed states

[← Phase 0](../phase-0-core-loop.md) · Size **M** · Depends on: [P0-3](P0-3-waiting-state.md) (`AnswerCard`) · Next: [P0-6](P0-6-keep-fresh.md)

**Goal:** once both have answered, each partner gets their own **Reveal** button. Tapping it shows both
answers to that partner only.

**Done when:**
- `ready_to_reveal`: one Reveal button, no answer text on screen or in the network response.
- Tapping Reveal shows both answers (yours first), with a gentle fade-in that's skipped under `prefers-reduced-motion`.
- Your partner still sees only their Reveal button until they tap it.
- A failed reveal shows an error and the button can be tried again.

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Reveal mutation | `hooks/use-sessions.ts` → `useRevealSessionMutation()` | Takes the session id. On success it refreshes the hub list and puts the revealed DTO into the cache |
| Reveal API | `POST /sessions/:id/reveal` | Idempotent: tapping twice is harmless. 403 `not_ready_to_reveal` if the partner hasn't submitted |
| `AnswerCard` | from [P0-3](P0-3-waiting-state.md) | |
| Animation utilities | `tw-animate-css` (imported in `globals.css`) | `animate-in fade-in-0 slide-in-from-bottom-2`, as used by `Dialog` |
| Accent tokens | `bg-accent-soft`, `text-accent-foreground` | Same as the `answering` status pill |

## From the prototype

`RevealPanel` in `between-us-source/src/components/couple-space.tsx`. **There's no Reveal button in the
prototype**: it auto-reveals. The extraction map lists `session-reveal-button` as **new**.

```tsx
// prototype: auto-reveals to both, "Revealed together"
export function RevealPanel({ session }: { session: Session }) {
  const { couple } = useCouplePrototype();
  return (
    <section aria-live="polite" className="reveal-once">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent-foreground">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-accent-foreground">Revealed together</p>
          <h2 className="font-display text-2xl">Both answers are here</h2>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {couple.members.map((member) => (
          <AnswerCard key={member.id} member={member}
            text={session.responses.find((response) => response.memberId === member.id)?.text ?? ""} />
        ))}
      </div>
    </section>
  );
}
```

**What changes and why:**
- "Revealed together" → "Both answers". Reveal is per user (scope + FR-16); "together" is explicitly banned copy.
- `?? ""` would render an empty card if the API ever redacted a text. The web version skips any response
  with `text === null`, so a redaction bug can't render an empty card.
- `reveal-once` (a prototype CSS class) → `motion-safe:` utilities from `tw-animate-css`, so reduced motion is respected (NFR-01).
- Your answer is ordered first.

---

## Steps

### Step 1 · `SessionRevealButton` molecule (new)

Create `apps/web/components/molecules/session-reveal-button/session-reveal-button.tsx`:

```tsx
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type SessionRevealButtonProps = {
  /** The partner's display name. */
  partnerName: string;
  /** True while the reveal request is in flight. */
  isRevealing: boolean;
  /** Shown above the button when the last reveal failed. */
  errorMessage?: string;
  /** Called when the viewer chooses to reveal. */
  onReveal: () => void;
};

/**
 * The per-user Reveal step, shown once both partners have submitted.
 *
 * @remarks
 * Revealing only affects the viewer (FR-16). Never label this "Reveal together".
 */
export function SessionRevealButton({
  partnerName,
  isRevealing,
  errorMessage,
  onReveal,
}: Readonly<SessionRevealButtonProps>) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col items-center gap-4 rounded-lg bg-accent-soft p-7 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-card text-accent-foreground shadow-soft">
        <SparklesIcon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-2xl">You&apos;ve both answered</h2>
      <p className="max-w-md leading-relaxed text-muted-foreground">
        Reveal when you&apos;re ready. This opens the answers for you —{" "}
        {partnerName} reveals in their own time.
      </p>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Button
        size="lg"
        className="px-8 text-sm"
        disabled={isRevealing}
        onClick={onReveal}
      >
        {isRevealing ? "Revealing…" : "Reveal answers"}
      </Button>
    </section>
  );
}
```

### Step 2 · `SessionRevealPanel` organism

Create `apps/web/components/organisms/session-reveal-panel/session-reveal-panel.tsx`:

```tsx
import type { SessionDetailDto } from "@/hooks/use-sessions";
import { AnswerCard } from "@/components/molecules/answer-card/answer-card";

type SessionRevealPanelProps = {
  /** Responses from `GET /sessions/:id` after the viewer revealed. */
  responses: SessionDetailDto["responses"];
  /** The viewer's user id, so their answer is shown first. */
  viewerId: string;
};

/**
 * Both answers, shown after the viewer has revealed.
 *
 * @remarks
 * Responses with `text === null` are skipped rather than shown empty. That
 * only happens if the API redacted something, which is the safe failure.
 */
export function SessionRevealPanel({
  responses,
  viewerId,
}: Readonly<SessionRevealPanelProps>) {
  const ordered = [...responses].sort(
    (a, b) => Number(b.userId === viewerId) - Number(a.userId === viewerId),
  );

  return (
    <section
      aria-labelledby="revealed-heading"
      className="flex flex-col gap-5 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
    >
      <h2 id="revealed-heading" className="text-2xl">
        Both answers
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ordered.map((response) =>
          response.text === null ? null : (
            <AnswerCard
              key={response.userId}
              authorName={response.displayName}
              text={response.text}
              isOwn={response.userId === viewerId}
            />
          ),
        )}
      </div>
    </section>
  );
}
```

### Step 3 · Wire both into the page

In `app/(app)/conversation/[id]/page.tsx`:

```tsx
import {
  sessionQueryKey,
  useRevealSessionMutation,
  useSessionQuery,
  useSubmitResponseMutation,
} from "@/hooks/use-sessions";
import { SessionRevealButton } from "@/components/molecules/session-reveal-button/session-reveal-button";
import { SessionRevealPanel } from "@/components/organisms/session-reveal-panel/session-reveal-panel";
```

With the other hooks at the top of the component:

```tsx
  const reveal = useRevealSessionMutation();
```

Replace the last two placeholders:

```tsx
      {data.phase === "ready_to_reveal" && (
        <SessionRevealButton
          partnerName={partnerName}
          isRevealing={reveal.isPending}
          errorMessage={
            reveal.isError
              ? "Couldn't reveal just now. Please try again."
              : undefined
          }
          onReveal={() => reveal.mutate(id)}
        />
      )}
      {data.phase === "revealed" && (
        <SessionRevealPanel responses={data.responses} viewerId={me.data.id} />
      )}
```

---

## Check

Use two browsers (normal + private window), following the reveal table in the walking-skeleton plan:

| Step | A sees | B sees |
| --- | --- | --- |
| A starts + submits | Own answer, waiting | "Your turn", none of A's answer |
| B submits | Reveal button, no text | Reveal button, no text |
| A reveals | Both answers | Still only the Reveal button |
| B reveals | Both answers | Both answers |

Also:
1. In the network tab at the "B submits" step, both `text` values except your own are `null`.
2. macOS: System Settings → Accessibility → Display → Reduce motion → the answers appear without sliding.
3. The hub card for that session says "View answers" once you've revealed and "Reveal" for your partner.

## Pitfalls

- B's screen won't change from "waiting" to "Reveal" on its own until [P0-6](P0-6-keep-fresh.md).
