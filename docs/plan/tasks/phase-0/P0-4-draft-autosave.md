# P0-4 · Draft autosave (optional)

[← Phase 0](../phase-0-core-loop.md) · Size **M** · Depends on: [P0-2](P0-2-answering-state.md) · Decision: [Q5](../../03-product-decisions.md#q5)
· *Optional for Phase 0. Can move to Phase 1 without blocking anything.*

**Goal:** an unfinished answer survives a reload, a closed tab or switching devices.

**Done when:**
- Typing saves the draft about 1 second after you stop, with a small "Saved" hint.
- Reloading the page restores your draft.
- Your partner never receives your draft: not on screen, not in the network response.
- Saving a draft doesn't reorder the hub or bump the session's `updatedAt` (that would reveal activity).

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Draft storage | `session_responses.body` + `submitted_at = null` | Row created per member when the session starts, so no schema change is needed |
| Visibility rule | `packages/domain/src/session-answer-visibility.ts` | ⚠️ Currently hides **your own** unsubmitted text from you, so drafts can't be restored until Step 1 |
| Answer form | `SessionAnswerForm` from P0-2 | Gets two optional props |

There's no prototype equivalent.

---

## Steps

### Step 1 · Domain: you can always see your own text

`packages/domain/src/session-answer-visibility.ts`: check authorship first:

```ts
export function canViewerSeeAnswerText(input: AnswerVisibilityInput): boolean {
  // Your own text (draft or submitted) is always yours to see.
  if (input.answerAuthorId === input.viewerId) return true;
  if (!input.authorSubmitted) return false;
  return input.bothSubmitted && input.viewerHasRevealed;
}
```

In `session-answer-visibility.test.ts`, replace the test `"hides unsubmitted author text"` with these two:

```ts
  it("lets the author see their own unsubmitted draft", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u1",
        authorSubmitted: false,
        bothSubmitted: false,
        viewerHasRevealed: false,
      }),
    ).toBe(true);
  });

  it("never shows a partner's unsubmitted draft", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u2",
        authorSubmitted: false,
        bothSubmitted: false,
        viewerHasRevealed: true,
      }),
    ).toBe(false);
  });
```

### Step 2 · API: save-draft endpoint

Create `apps/api/src/conversations/dto/save-draft.schema.ts`. Empty is allowed (clearing the box), and there's no trim, so spacing is kept:

```ts
import { z } from "zod";
import { ANSWER_MAX_LENGTH } from "@couple-space/domain";

export const saveDraftSchema = z.object({
  text: z.string().max(ANSWER_MAX_LENGTH),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
```

In `conversations.service.ts`, add the method:

```ts
  async saveDraft(
    user: AuthUser,
    sessionId: string,
    input: SaveDraftInput,
  ): Promise<void> {
    await this.requireSessionMember(user, sessionId);

    const [existing] = await this.db
      .select()
      .from(sessionResponses)
      .where(
        and(
          eq(sessionResponses.sessionId, sessionId),
          eq(sessionResponses.userId, user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException({ reason: "response_row_missing" });
    }
    if (existing.submittedAt != null) {
      throw new ConflictException({ reason: "already_submitted" });
    }

    // Deliberately doesn't touch conversation_sessions.updated_at: a draft
    // must not move the hub card or signal activity to the partner.
    await this.db
      .update(sessionResponses)
      .set({ body: input.text, updatedAt: new Date() })
      .where(eq(sessionResponses.id, existing.id));
  }
```

Add `import type { SaveDraftInput } from "./dto/save-draft.schema.js";` at the top.

In `conversations.controller.ts`, add `HttpCode` and `Put` to the `@nestjs/common` import, plus the schema import, then:

```ts
  @Put("sessions/:id/responses/draft")
  @HttpCode(204)
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = saveDraftSchema.parse(body);
    return this.conversations.saveDraft(user, id, input);
  }
```

### Step 3 · Web hook

In `apps/web/hooks/use-sessions.ts`:

```ts
/**
 * Saves the viewer's unsubmitted answer.
 *
 * @remarks
 * Doesn't invalidate anything: the draft is already in the form, and
 * refetching mid-typing would fight the textarea.
 *
 * @param options - Extra React Query mutation options
 * @returns The mutation for `PUT /sessions/:id/responses/draft`
 */
export function useSaveDraftMutation(
  options?: UseMutationOptions<void, Error, { sessionId: string; text: string }>,
) {
  return useMutation({
    ...options,
    mutationFn: ({ sessionId, text }) =>
      apiFetch<void>(`/sessions/${sessionId}/responses/draft`, {
        method: "PUT",
        body: JSON.stringify({ text }),
      }),
  });
}
```

### Step 4 · Form: start from the draft and autosave

Changes to `components/organisms/session-answer-form/session-answer-form.tsx`.

New props (add to `SessionAnswerFormProps`):

```tsx
  /** The saved draft to start from. */
  initialText?: string;
  /** Called with the current text after the viewer pauses typing. */
  onSaveDraft?: (text: string) => void;
  /** Status of the last draft save, for the "Saved" hint. */
  draftStatus?: "idle" | "pending" | "success" | "error";
```

Imports become `import { useEffect, useId, useRef, useState } from "react";`.

State and the debounce effect (replace the `useState("")` line):

```tsx
  const [text, setText] = useState(initialText);
  const lastSaved = useRef(initialText);

  useEffect(() => {
    if (!onSaveDraft || text === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = text;
      onSaveDraft(text);
    }, 1000);
    return () => clearTimeout(timer);
  }, [text, onSaveDraft]);
```

…and default `initialText = ""` in the destructured props.

In the hint row, replace the first `<span>`:

```tsx
        <span>
          {draftStatus === "pending"
            ? "Saving draft…"
            : draftStatus === "success"
              ? "Draft saved · only you can see it"
              : draftStatus === "error"
                ? "Draft not saved"
                : "You can't change your answer after submitting."}
        </span>
```

### Step 5 · Page wiring

In `app/(app)/conversation/[id]/page.tsx`: import `useCallback` and `useSaveDraftMutation`, and add with the other hooks (before any early return):

```tsx
  const saveDraft = useSaveDraftMutation();
  const saveDraftMutate = saveDraft.mutate;
  const handleSaveDraft = useCallback(
    (text: string) => saveDraftMutate({ sessionId: id, text }),
    [saveDraftMutate, id],
  );
```

Add to the `<SessionAnswerForm … />` props:

```tsx
          initialText={own?.text ?? ""}
          onSaveDraft={handleSaveDraft}
          draftStatus={saveDraft.status}
```

(`own` comes from P0-3. Move that line above the JSX if it isn't already.)

---

## Check

1. Type half an answer, wait 1 second ("Draft saved"), reload: the text is back.
2. Partner's browser, network tab → `GET /sessions/:id`: your response has `submitted: false` and `text: null`.
3. Hub order doesn't change while you type.
4. Submit, then try a `PUT …/draft` with curl: 409 `already_submitted`.
5. `pnpm --filter @couple-space/domain test` and `pnpm --filter @couple-space/api test` pass (apart from [H-15](../housekeeping.md#code)). The mapper test "hides partner text before partner submit" still passes, because it checks the *partner's* text.

## Pitfalls

- `handleSaveDraft` must be stable (`useCallback`). Otherwise the effect re-runs on every render and the debounce never fires while polling re-renders the page.
- The form only reads `initialText` once (`useState`). That's intended: background refetches mustn't overwrite what you're typing.
