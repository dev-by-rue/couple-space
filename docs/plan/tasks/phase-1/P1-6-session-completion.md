# P1-6 · Session completion

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Gate A · Decision: [Q1](../../03-product-decisions.md#q1) · After: [P1-8](P1-8-follow-ups.md) · Next: [P1-7](P1-7-skip-archive.md)

**Builds on P1-8:** child sessions, `parentSessionId`, and `areFollowUpsUnlocked`.

**Goal:** each main session gets a couple-level state, derived and never stored:
`in_progress` → `in_discussion` → `completed`. The hub shows active sessions first (including "In
discussion"), then a "Past conversations" section.

| State | Rule (Q1) |
| --- | --- |
| `in_progress` | The main prompt isn't revealed by both yet |
| `in_discussion` | Both revealed, and at least one **started** follow-up isn't submitted by both (and isn't archived) |
| `completed` | Both revealed, and no follow-up is still open |

**Done when:**

- `sessionCompletionState` is a pure domain function with tests for every row above.
- `GET /sessions` items carry `status`.
- The hub splits active from past; an `in_discussion` card says "In discussion".
- Starting a follow-up on a completed session moves it back to active (that follows from the rule; no
  extra code).

### Notes

- **Archive comes in P1-7.** The child input has an `archived` flag now so the rule matches Q1 exactly;
  until P1-7 the service always passes `false`.
- **Follow-ups nobody has started don't count.** Q1 says "every child session they started", so a
  revealed session with untouched follow-ups is `completed`. Those follow-ups are still there if they
  open it.
- **The viewer phase stays.** `phase` is still "what *you* need to do"; `status` is "where *the couple*
  is". The card uses both.

---

## Step 1 · Domain

### `packages/domain/src/sessions/session-completion.ts` (new)
```ts
import { areFollowUpsUnlocked } from "./follow-ups-unlocked.js";

export type SessionCompletionState = "in_progress" | "in_discussion" | "completed";

export type SessionCompletionInput = {
  memberIds: string[];
  /** Who has revealed the main prompt. */
  revealedUserIds: string[];
  /** Started follow-ups (child sessions) only. */
  children: Array<{ submittedUserIds: string[]; archived: boolean }>;
};

/** Q1: a couple-level state derived from the main session and its children. */
export function sessionCompletionState(
  input: SessionCompletionInput,
): SessionCompletionState {
  if (
    !areFollowUpsUnlocked({
      memberIds: input.memberIds,
      revealedUserIds: input.revealedUserIds,
    })
  ) {
    return "in_progress";
  }

  const anyOpen = input.children.some(
    (child) =>
      !child.archived &&
      !input.memberIds.every((id) => child.submittedUserIds.includes(id)),
  );
  return anyOpen ? "in_discussion" : "completed";
}
```

### `packages/domain/src/sessions/session-completion.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { sessionCompletionState } from "./session-completion.js";

const members = ["u1", "u2"];

describe("sessionCompletionState", () => {
  it("is in_progress until both have revealed the main prompt", () => {
    expect(
      sessionCompletionState({ memberIds: members, revealedUserIds: ["u1"], children: [] }),
    ).toBe("in_progress");
  });

  it("is completed when both revealed and no follow-up was started", () => {
    expect(
      sessionCompletionState({ memberIds: members, revealedUserIds: members, children: [] }),
    ).toBe("completed");
  });

  it("is in_discussion while a started follow-up isn't submitted by both", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [{ submittedUserIds: ["u1"], archived: false }],
      }),
    ).toBe("in_discussion");
  });

  it("is completed when every started follow-up is submitted by both", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [
          { submittedUserIds: ["u1", "u2"], archived: false },
          { submittedUserIds: ["u2", "u1"], archived: false },
        ],
      }),
    ).toBe("completed");
  });

  it("ignores an archived follow-up that was never finished", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [{ submittedUserIds: [], archived: true }],
      }),
    ).toBe("completed");
  });

  it("goes back to in_discussion when a new follow-up starts on a completed session", () => {
    const children = [{ submittedUserIds: ["u1", "u2"], archived: false }];
    expect(
      sessionCompletionState({ memberIds: members, revealedUserIds: members, children }),
    ).toBe("completed");
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [...children, { submittedUserIds: [], archived: false }],
      }),
    ).toBe("in_discussion");
  });
});
```

### `packages/domain/src/index.ts` (change) — add
```ts
export * from "./sessions/session-completion.js";
```

---

## Step 2 · API: `status` on `GET /sessions`

### `apps/api/src/conversations/conversations.service.ts` (change)
Add `sessionCompletionState` to the domain import.

**Before** (`listSessions`, after the reveals query)
```ts
    const reveals = await this.db
      .select()
      .from(sessionReveals)
      .where(inArray(sessionReveals.sessionId, sessionIds));

    const memberIds = ctx.memberIds;
```
**After**
```ts
    const reveals = await this.db
      .select()
      .from(sessionReveals)
      .where(inArray(sessionReveals.sessionId, sessionIds));

    // Started follow-ups and who has submitted each (Q1).
    const children = await this.db
      .select({
        id: conversationSessions.id,
        parentSessionId: conversationSessions.parentSessionId,
      })
      .from(conversationSessions)
      .where(inArray(conversationSessions.parentSessionId, sessionIds));
    const childResponses =
      children.length === 0
        ? []
        : await this.db
            .select({
              sessionId: sessionResponses.sessionId,
              userId: sessionResponses.userId,
              submittedAt: sessionResponses.submittedAt,
            })
            .from(sessionResponses)
            .where(
              inArray(
                sessionResponses.sessionId,
                children.map((c) => c.id),
              ),
            );

    const memberIds = ctx.memberIds;
```
**Before** (inside `rows.map`)
```ts
        return {
          id: row.id,
          promptTitle: row.promptTitle,
          promptText: row.promptText,
          phase,
          updatedAt: row.updatedAt.toISOString(),
        };
```
**After**
```ts
        const status = sessionCompletionState({
          memberIds,
          revealedUserIds,
          children: children
            .filter((c) => c.parentSessionId === row.id)
            .map((c) => ({
              submittedUserIds: childResponses
                .filter((r) => r.sessionId === c.id && r.submittedAt != null)
                .map((r) => r.userId),
              archived: false, // P1-7 replaces this with archivedAt != null
            })),
        });
        return {
          id: row.id,
          promptTitle: row.promptTitle,
          promptText: row.promptText,
          phase,
          status,
          updatedAt: row.updatedAt.toISOString(),
        };
```
Four queries for the whole hub, whatever its size; no N+1.

**Bump the parent's `updatedAt` when a follow-up is answered.** Without this, a session that moves
back to `in_discussion` keeps its old position in the list. In `submitResponse`, **before**
```ts
    await this.db
      .update(conversationSessions)
      .set({ updatedAt: now })
      .where(eq(conversationSessions.id, sessionId));
```
**After**
```ts
    // Touch the parent too, so the hub re-sorts when a follow-up moves.
    const touched = ctx.session.parentSessionId
      ? [sessionId, ctx.session.parentSessionId]
      : [sessionId];
    await this.db
      .update(conversationSessions)
      .set({ updatedAt: now })
      .where(inArray(conversationSessions.id, touched));
```
Do the same in `startFollowUp`, after the transaction creates the child (`update … where id = parentSessionId`).

### Test — `apps/api/src/conversations/conversations.service.test.ts`
The rule itself is covered in the domain. Add one wiring case using `queryResult` (from `test/factories.ts`).
`requireMembership` does three selects, then `listSessions` does sessions, responses, reveals,
children and childResponses:
```ts
describe("ConversationsService.listSessions status", () => {
  it("marks a revealed session with an unfinished follow-up as in_discussion", async () => {
    const now = new Date();
    const db = { select: vi.fn() };
    db.select
      .mockReturnValueOnce(queryResult([{ coupleId: "c1", userId: "u1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ id: "c1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ userId: "u1" }, { userId: "u2" }]))
      .mockReturnValueOnce(
        queryResult([{ id: "s1", updatedAt: now, promptTitle: "T", promptText: "Q" }]),
      )
      .mockReturnValueOnce(
        queryResult([
          { sessionId: "s1", userId: "u1", submittedAt: now },
          { sessionId: "s1", userId: "u2", submittedAt: now },
        ]),
      )
      .mockReturnValueOnce(
        queryResult([
          { sessionId: "s1", userId: "u1" },
          { sessionId: "s1", userId: "u2" },
        ]),
      )
      .mockReturnValueOnce(queryResult([{ id: "c1", parentSessionId: "s1" }]))
      .mockReturnValueOnce(queryResult([{ sessionId: "c1", userId: "u1", submittedAt: now }]));

    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: db },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();

    const { sessions } = await module
      .get(ConversationsService)
      .listSessions({ id: "u1", email: "a@example.com", emailVerified: true });

    expect(sessions[0]).toMatchObject({ phase: "revealed", status: "in_discussion" });
  });
});
```

---

## Step 3 · Web

### `apps/web/hooks/use-sessions.ts` (change)
**Before**
```ts
import type { SessionViewerPhase } from "@couple-space/domain";
...
export type SessionListItem = {
  id: string;
  promptTitle: string;
  promptText: string;
  phase: SessionViewerPhase;
  updatedAt: string;
};
```
**After**
```ts
import type {
  SessionCompletionState,
  SessionViewerPhase,
} from "@couple-space/domain";
...
export type SessionListItem = {
  id: string;
  promptTitle: string;
  promptText: string;
  phase: SessionViewerPhase;
  /** Couple-level state (Q1). */
  status: SessionCompletionState;
  updatedAt: string;
};
```
`useSessionsQuery` keeps `select: sortSessionsByPriority`. The split happens in the list, below.

### `apps/web/lib/session-sort.ts` (change) — add at the end
```ts
/**
 * Splits hub sessions into active (in progress or in discussion) and past
 * (completed). Keeps the incoming order, so call it on already-sorted data.
 */
export function splitActiveAndPast(sessions: SessionListItem[]): {
  active: SessionListItem[];
  past: SessionListItem[];
} {
  return {
    active: sessions.filter((s) => s.status !== "completed"),
    past: sessions.filter((s) => s.status === "completed"),
  };
}
```
`revealed` is already last in `PRIORITY_ORDER`, so `in_discussion` sessions sit below the ones that need
the viewer, newest first. Past sessions are all `revealed`, so they come out newest first too.

### `apps/web/lib/session-status-label.ts` (change)
**Before**
```ts
import type { SessionViewerPhase } from "@couple-space/domain";
```
**After**
```ts
import type {
  SessionCompletionState,
  SessionViewerPhase,
} from "@couple-space/domain";
```
**Before**
```ts
export function sessionStatusLabel(phase: SessionViewerPhase): string {
  return LABELS[phase];
}
```
**After**
```ts
export function sessionStatusLabel(
  phase: SessionViewerPhase,
  status?: SessionCompletionState,
): string {
  // Couple-level wording once the main prompt is revealed by both.
  if (status === "in_discussion") return "In discussion";
  if (status === "completed") return "Completed";
  return LABELS[phase];
}
```
`sessionCardActionLabel` doesn't change. For both new states the phase is `revealed`, so the action is
"View answers".

### `apps/web/components/molecules/conversation-status-pill/conversation-status-pill.tsx` (change)
**Before**
```tsx
import type { SessionViewerPhase } from "@couple-space/domain";
...
        revealed: "bg-secondary text-secondary-foreground",
      },
...
type ConversationStatusPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** The viewer's phase; drives both the label and the colour. */
  phase: SessionViewerPhase;
};

export function ConversationStatusPill({
  className,
  phase,
  ...props
}: Readonly<ConversationStatusPillProps>) {
  const label = sessionStatusLabel(phase);
  return (
    <span
      className={cn(
        conversationStatusPillVariants({ variant: phase }),
        className,
      )}
```
**After**
```tsx
import type {
  SessionCompletionState,
  SessionViewerPhase,
} from "@couple-space/domain";
...
        revealed: "bg-secondary text-secondary-foreground",
        in_discussion: "bg-accent-soft text-accent-foreground",
        completed: "bg-muted text-muted-foreground",
      },
...
type ConversationStatusPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** The viewer's phase. */
  phase: SessionViewerPhase;
  /** The couple-level state; once both revealed it decides label and colour. */
  status?: SessionCompletionState;
};

export function ConversationStatusPill({
  className,
  phase,
  status,
  ...props
}: Readonly<ConversationStatusPillProps>) {
  const label = sessionStatusLabel(phase, status);
  const variant = status && status !== "in_progress" ? status : phase;
  return (
    <span
      className={cn(conversationStatusPillVariants({ variant }), className)}
```
Pick the colours with your theme tokens; the ones above are a suggestion.

### `apps/web/components/molecules/conversation-card/conversation-card.tsx` (change)
**Before**
```tsx
        <ConversationStatusPill phase={session.phase} className="shrink-0" />
```
**After**
```tsx
        <ConversationStatusPill
          phase={session.phase}
          status={session.status}
          className="shrink-0"
        />
```

### `apps/web/components/organisms/conversation-list/conversation-list.tsx` (change)
**Before**
```tsx
import { useSessionsQuery } from "@/hooks/use-sessions";
```
**After**
```tsx
import { useSessionsQuery } from "@/hooks/use-sessions";
import { splitActiveAndPast } from "@/lib/session-sort";
```
**Before**
```tsx
  return (
    <section aria-label="Your conversations" className="flex flex-col gap-2">
      {sessions.data.map((session) => (
        <ConversationCard key={session.id} session={session} />
      ))}
    </section>
  );
```
**After**
```tsx
  const { active, past } = splitActiveAndPast(sessions.data);

  return (
    <div className="flex flex-col gap-8">
      {active.length > 0 ? (
        <section aria-label="Your conversations" className="flex flex-col gap-2">
          {active.map((session) => (
            <ConversationCard key={session.id} session={session} />
          ))}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing in progress. Start a new conversation above whenever
          you&apos;re ready.
        </p>
      )}

      {past.length > 0 ? (
        <section aria-labelledby="past-heading" className="flex flex-col gap-2">
          <h2 id="past-heading" className="text-lg font-semibold">
            Past conversations
          </h2>
          {past.map((session) => (
            <ConversationCard key={session.id} session={session} />
          ))}
        </section>
      ) : null}
    </div>
  );
```
If the past list gets long, wrap it in the uncontrolled `Collapsible` from `components/ui/collapsible`.
P1-20 can decide that.

---

## Verification
1. `pnpm check-types && pnpm test`.
2. Main prompt not revealed by both → active, with the viewer-phase pill as today.
3. Both reveal, no follow-ups started → moves to "Past conversations" with a "Completed" pill.
4. Open it and start a follow-up → back in the active list with "In discussion" (below sessions that need you).
5. Both submit that follow-up → back to Past.
