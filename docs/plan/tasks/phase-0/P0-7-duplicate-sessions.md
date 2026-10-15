# P0-7 · Stop duplicate sessions

[← Phase 0](../phase-0-core-loop.md) · Size **S** · Depends on: nothing (works best after P0-1) · Decisions: [Q1](../../03-product-decisions.md#q1), [Q2](../../03-product-decisions.md#q2)

**Goal:** double-clicking a prompt, or picking a prompt you're already mid-way through, never creates a second session.

**Done when:**
- Prompt cards on `/start/[slug]` are disabled while a session is being created, and an error shows if it fails.
- `POST /sessions` for a prompt that already has an **open** session returns that session's id instead of creating a new one.
- Once both partners have revealed, picking the same prompt again starts a fresh session.

**Rule (🟢 client decision):** for now, "open" means *not every member has revealed it*. When
[P1-6](../phase-1-mvp-1.md#conversation-engine-completion) adds follow-ups and archiving, the same domain
function is extended, so the API code doesn't change.

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| `PromptCard` | `components/molecules/prompt-card/prompt-card.tsx` | Already has a `disabled` prop with disabled styles; the page just doesn't pass it |
| Create mutation | `useCreateSessionMutation` in `hooks/use-sessions.ts` | Returns `{ id }`; the page routes to it |
| `createSession` | `apps/api/src/conversations/conversations.service.ts` | Inserts a session plus one empty response per member |

There's no prototype equivalent.

---

## Steps

### Step 1 · Web: disable cards while creating

`apps/web/app/(app)/start/[slug]/page.tsx`: pass `disabled` and show an error.

```tsx
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {theme.prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            disabled={createSession.isPending}
            onSelect={(promptId) => createSession.mutate({ promptId })}
          />
        ))}
      </div>
      {createSession.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t start that conversation. Please try again.
        </p>
      ) : null}
```

While you're here, remove the `!` on `themes.data?.themes.find(...)!`. The `if (!theme)` check below it
already handles the missing case (also listed in P1-3).

### Step 2 · Domain: what counts as "open"

Create `packages/domain/src/session-open.ts`:

```ts
export type SessionOpenInput = {
  memberIds: string[];
  revealedUserIds: string[];
};

/**
 * Whether a session is still in progress for the couple.
 *
 * @remarks
 * Phase 0 rule: open until every member has revealed. P1-6 extends this with
 * follow-ups ("In discussion") and archiving (Q1, Q4).
 */
export function isSessionOpen(input: SessionOpenInput): boolean {
  return !input.memberIds.every((id) => input.revealedUserIds.includes(id));
}
```

Export it from `packages/domain/src/index.ts`:

```ts
export * from "./session-open.js";
```

Create `packages/domain/src/session-open.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSessionOpen } from "./session-open.js";

describe("isSessionOpen", () => {
  const memberIds = ["u1", "u2"];

  it("is open when nobody has revealed", () => {
    expect(isSessionOpen({ memberIds, revealedUserIds: [] })).toBe(true);
  });

  it("is open when only one member has revealed", () => {
    expect(isSessionOpen({ memberIds, revealedUserIds: ["u1"] })).toBe(true);
  });

  it("is closed when every member has revealed", () => {
    expect(isSessionOpen({ memberIds, revealedUserIds: ["u2", "u1"] })).toBe(
      false,
    );
  });
});
```

### Step 3 · API: return the open session instead of creating one

`apps/api/src/conversations/conversations.service.ts`: import the function:

```ts
import { isSessionOpen, sessionViewerPhase } from "@couple-space/domain";
```

In `createSession`, after the `prompt_not_found` check and before `this.db.transaction(...)`:

```ts
    const samePrompt = await this.db
      .select({ id: conversationSessions.id })
      .from(conversationSessions)
      .where(
        and(
          eq(conversationSessions.coupleId, ctx.coupleId),
          eq(conversationSessions.promptId, prompt.id),
        ),
      );

    if (samePrompt.length > 0) {
      const reveals = await this.db
        .select({
          sessionId: sessionReveals.sessionId,
          userId: sessionReveals.userId,
        })
        .from(sessionReveals)
        .where(
          inArray(
            sessionReveals.sessionId,
            samePrompt.map((s) => s.id),
          ),
        );

      const open = samePrompt.find((s) =>
        isSessionOpen({
          memberIds: ctx.memberIds,
          revealedUserIds: reveals
            .filter((r) => r.sessionId === s.id)
            .map((r) => r.userId),
        }),
      );

      if (open) {
        return { id: open.id };
      }
    }
```

The response shape stays `{ id }`, so the web needs no change: it routes to whichever id comes back.

---

## Check

1. `pnpm --filter @couple-space/domain test`: the 3 new tests pass. `pnpm --filter @couple-space/api test` passes except the one auth test that already fails ([H-15](../housekeeping.md#code)). The existing "couple not active" test fails before the new query, so its mocks don't change.
2. Pick a prompt, go back, pick the same prompt: you land on the **same** session (same id in the URL), and the hub shows one card.
3. Finish that session (both reveal), then pick the prompt again: a **new** session.
4. Throttle the network, then click a prompt twice quickly: the cards grey out and only one request is sent.

## Pitfalls

- Two simultaneous requests from different browsers could still both create a session, because "open" is
  derived and can't be a unique index. Step 1 covers the realistic case (one person double-clicking).
  Revisit only if it happens in practice.
