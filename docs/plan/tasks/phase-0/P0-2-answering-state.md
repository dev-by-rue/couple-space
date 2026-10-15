# P0-2 · Answering state

[← Phase 0](../phase-0-core-loop.md) · Size **M** · Depends on: [P0-1](P0-1-route-shell.md) · Next: [P0-3](P0-3-waiting-state.md)
· Decisions: [Q15](../../03-product-decisions.md#q15) (no timestamps), [Q16](../../03-product-decisions.md#q16) (1–5,000 chars)

**Goal:** when it's your turn, you can write an answer privately, confirm it, and submit it.

**Done when:**
- The page shows a privacy note, a textarea with a character count, and a Submit button that stays disabled until there's text.
- Submit opens a confirm dialog. "Keep writing" closes it; "Submit answer" sends it.
- On success the page flips to the waiting state with no reload (the mutation already writes the new DTO into the cache).
- If your partner has already answered, you see "{partner} has answered", with no time shown.
- A failed submit keeps your text and shows a clear error.

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Submit mutation | `hooks/use-sessions.ts` → `useSubmitResponseMutation()` | `{ sessionId, text }`. On success it refreshes the hub list and puts the new session into the cache |
| Textarea atom | `components/ui/textarea.tsx` | Plain `<textarea>`, already shadcn |
| Dialog atom | `components/ui/dialog.tsx` | **Base UI**, not Radix: no `asChild`; use `render={<Button … />}` on `DialogClose` |
| Error helpers | `lib/api-error.ts` (from P0-1) | `apiErrorReason(error)` → `"already_submitted"` |
| Submit rules | `apps/api/.../dto/submit-response.schema.ts` | Currently `.max(10000)`; Step 1 changes it to 5,000 |

## From the prototype

`between-us-source/src/routes/conversation.$id.tsx`: the inline `!own?.submitted ? (<section>…)` block. The
extraction map says to lift it into `organisms/session-answer-form`.

```tsx
// prototype (Radix dialog, mock submit)
<div className="mb-5 flex items-center gap-3 rounded-md bg-secondary p-4 text-sm leading-relaxed text-secondary-foreground">
  <LockKeyhole className="size-5 shrink-0" />
  Only you can see this until you've both answered.
</div>
{partnerResponse?.submitted && (
  <p className="mb-4 text-sm font-medium text-waiting-foreground">
    {memberName(partner)} has answered. Yours will still stay private until you submit.
  </p>
)}
<label htmlFor="answer" className="font-display text-2xl">Your answer</label>
<Textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)}
  placeholder="Take your time..." className="mt-4 min-h-56 resize-none bg-card p-5 text-base leading-8 shadow-soft" />
<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <DialogTrigger asChild>
    <Button className="mt-5 h-12 w-full sm:w-auto" disabled={!answer.trim()}>Submit my answer</Button>
  </DialogTrigger>
  <DialogContent className="max-w-md rounded-card">
    <DialogHeader>
      <DialogTitle className="font-display text-2xl">Ready to submit?</DialogTitle>
      <DialogDescription className="pt-2 leading-relaxed">
        Once submitted, you can't edit it. Your answer stays private until both of you have answered.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="mt-4 gap-2">
      <Button variant="outline" onClick={() => setConfirmOpen(false)}>Keep writing</Button>
      <Button onClick={submit}>Submit answer</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**What changes and why:**
- `DialogTrigger asChild` doesn't exist in Base UI. The dialog is controlled by `open` state, and the
  Submit button just calls `setConfirmOpen(true)`. That also keeps the button's `disabled` simple.
- The component is presentational and takes `onSubmit`, per the walking-skeleton rule "no `apiFetch` inside
  molecules". The page wires it to the mutation.
- It adds a character count and limit ([Q16](../../03-product-decisions.md#q16)), a pending state, an error line
  and `useId` for the label (no hard-coded `id="answer"`).
- Dialog copy says "until you've both answered **and they choose to reveal**", which matches per-user reveal.
- `rounded-md`/`shadow-soft`/`font-display` → your existing tokens.

---

## Steps

### Step 1 · Shared answer limit (domain + API)

Create `packages/domain/src/answer-rules.ts`:

```ts
/** Longest answer a partner can submit (Q16). Enforced by the API and shown in the web form. */
export const ANSWER_MAX_LENGTH = 5000;
```

Add to `packages/domain/src/index.ts`:

```ts
export * from "./answer-rules.js";
```

`apps/api/src/conversations/dto/submit-response.schema.ts`:

```ts
import { z } from "zod";
import { ANSWER_MAX_LENGTH } from "@couple-space/domain";

export const submitResponseSchema = z.object({
  text: z.string().trim().min(1).max(ANSWER_MAX_LENGTH),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
```

> The DB `CHECK` for the same limit is [H-12](../housekeeping.md). The domain package may need a rebuild
> (`pnpm --filter @couple-space/domain build`) before the API and web see the new export, the same as
> when you added `sessionViewerPhase`.

### Step 2 · The form organism

Create `apps/web/components/organisms/session-answer-form/session-answer-form.tsx`:

```tsx
"use client";

import { useId, useState } from "react";
import { LockKeyholeIcon } from "lucide-react";
import { ANSWER_MAX_LENGTH } from "@couple-space/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type SessionAnswerFormProps = {
  /** The partner's display name, used in the status line and dialog. */
  partnerName: string;
  /** True once the partner has submitted. Their text is still hidden. */
  partnerSubmitted: boolean;
  /** True while the submit request is in flight. */
  isSubmitting: boolean;
  /** Shown under the textarea when the last submit failed. */
  errorMessage?: string;
  /** Called with the trimmed answer after the viewer confirms. */
  onSubmit: (text: string) => void;
};

/**
 * The private answer box for the viewer's turn.
 *
 * @remarks
 * Answers are immutable once submitted (FR-13), so submitting always goes
 * through a confirm dialog. The text stays in local state on failure so
 * nothing is lost.
 */
export function SessionAnswerForm({
  partnerName,
  partnerSubmitted,
  isSubmitting,
  errorMessage,
  onSubmit,
}: Readonly<SessionAnswerFormProps>) {
  const textareaId = useId();
  const hintId = `${textareaId}-hint`;
  const [text, setText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const trimmed = text.trim();
  const tooLong = trimmed.length > ANSWER_MAX_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !isSubmitting;

  function handleConfirm() {
    setConfirmOpen(false);
    onSubmit(trimmed);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 text-sm leading-relaxed text-secondary-foreground">
        <LockKeyholeIcon aria-hidden="true" className="size-5 shrink-0" />
        Only you can see this until you&apos;ve both answered.
      </div>

      {partnerSubmitted ? (
        <p className="text-sm font-medium text-waiting-foreground">
          {partnerName} has answered. Yours stays private until you submit.
        </p>
      ) : null}

      <label htmlFor={textareaId} className="text-2xl">
        Your answer
      </label>
      <Textarea
        id={textareaId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Take your time…"
        disabled={isSubmitting}
        aria-describedby={hintId}
        aria-invalid={tooLong || undefined}
        className="min-h-56 resize-none rounded-lg bg-card p-5 text-base leading-8 md:text-base"
      />
      <div
        id={hintId}
        className="flex justify-between gap-4 text-xs text-muted-foreground"
      >
        <span>You can&apos;t change your answer after submitting.</span>
        <span className={tooLong ? "text-destructive" : undefined}>
          {trimmed.length}/{ANSWER_MAX_LENGTH}
        </span>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button
        size="lg"
        className="self-start px-6 text-sm"
        disabled={!canSubmit}
        onClick={() => setConfirmOpen(true)}
      >
        {isSubmitting ? "Submitting…" : "Submit my answer"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Ready to submit?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Once submitted, you can&apos;t edit it. {partnerName} won&apos;t
              see it until you&apos;ve both answered and they choose to reveal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Keep writing
            </DialogClose>
            <Button onClick={handleConfirm}>Submit answer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

### Step 3 · Wire it into the page

In `app/(app)/conversation/[id]/page.tsx`:

1. Add imports:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import {
  sessionQueryKey,
  useSessionQuery,
  useSubmitResponseMutation,
} from "@/hooks/use-sessions";
import { apiErrorReason, apiErrorStatus } from "@/lib/api-error";
import { SessionAnswerForm } from "@/components/organisms/session-answer-form/session-answer-form";
```

2. Add a small helper **above** the component:

```tsx
/** Turns a failed submit into copy for the form. */
function submitErrorMessage(error: Error): string {
  if (apiErrorReason(error) === "already_submitted") {
    return "You've already answered this one. Refreshing…";
  }
  return "Your answer didn't send. Your text is still here — try again.";
}
```

3. Add the hooks **at the top of the component, before any early return**:

```tsx
  const queryClient = useQueryClient();
  const submit = useSubmitResponseMutation({
    onError: (error) => {
      // Answered in another tab/device: reload so the page moves on.
      if (apiErrorReason(error) === "already_submitted") {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey(id) });
      }
    },
  });
```

4. After `const { data } = session;`, work out who is who:

```tsx
  const partner = data.responses.find((r) => r.userId !== me.data.id);
  const partnerName = partner?.displayName ?? "Your partner";
```

5. Replace the `answering` placeholder:

```tsx
      {data.phase === "answering" && (
        <SessionAnswerForm
          partnerName={partnerName}
          partnerSubmitted={data.partnerSubmitted}
          isSubmitting={submit.isPending}
          errorMessage={
            submit.isError ? submitErrorMessage(submit.error) : undefined
          }
          onSubmit={(text) => submit.mutate({ sessionId: id, text })}
        />
      )}
```

---

## Check

1. Start a new conversation. Submit is disabled with an empty box and enabled once you type.
2. Paste more than 5,000 characters: the counter turns red and Submit disables.
3. Submit → "Keep writing" closes the dialog and keeps your text. Submit → "Submit answer" → the page changes to the waiting placeholder.
4. Two browsers: partner B submits first. Partner A reloads and sees "B has answered", but not B's text. Check the network tab: B's `text` is `null`.
5. Dev tools → offline → submit: the error shows and your text is still there.
6. Answer in tab 1, then submit the same session from a stale tab 2: tab 2 shows "already answered" and moves on.
7. API: `pnpm --filter @couple-space/api test` passes except the one auth test that already fails ([H-15](../housekeeping.md#code)). `curl` a 6,000-character answer and you get a 400.

## Pitfalls

- Base UI `Dialog` passes `(open, eventDetails)` to `onOpenChange`. Passing `setConfirmOpen` directly is fine.
- Don't put the `useSubmitResponseMutation` call below an early return. Hooks must run in the same order every render.
