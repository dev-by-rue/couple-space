# P1-6 · Session completion

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Gate A · Decision: [Q1](../../03-product-decisions.md#q1) · After: [H-16](H-16-web-unit-tests.md) · Next: [P1-32](P1-32-answered-prompts.md)

**Builds on P1-8** (child sessions, `parentSessionId`, `areFollowUpsUnlocked`) **and H-16** (web tests).

**Goal:** each main session gets a couple-level state, derived and never stored:
`in_progress` → `in_discussion` → `completed`. The hub shows active sessions first (including "In
discussion"), then a **"We talked about"** section.

| State | Rule (Q1) |
| --- | --- |
| `in_progress` | The main prompt isn't revealed by both yet |
| `in_discussion` | Both revealed, and at least one **started** follow-up isn't submitted by both (and isn't archived) |
| `completed` | Both revealed, and no follow-up is still open |

**Done when:**

- `sessionCompletionState` is a pure domain function with tests for every row above.
- `GET /sessions` items carry `status`, with API tests.
- Answering a follow-up, or starting one, moves the parent up the hub (`updatedAt`).
- The hub splits active from "We talked about"; an `in_discussion` card says "In discussion" and a
  completed one "Talked about". Web tests for the split and the labels.
- Starting a follow-up on a completed session moves it back to active (that follows from the rule; no
  extra code).

### Notes

- **Nothing is archived in MVP-1.** Q4 now needs both partners to agree, which is on the roadmap. The
  child input keeps its `archived` flag so the rule matches Q1 and the future feature plugs straight in;
  until then the service always passes `false`.
- **Follow-ups nobody has started don't count.** Q1 says "every child session they started", so a
  revealed session with untouched follow-ups is `completed`. The same goes for follow-ups added to the
  catalogue later (Q27): they don't reopen a finished session.
- **A started follow-up one partner never answers keeps the session `in_discussion`.** Accepted for now
  (Q1 amendment): a reminder comes in the next phase (Q28), closing a stuck one later.
- **The children query doesn't filter by prompt kind.** MVP-2's partner-added questions (P2-7) are child
  sessions too, so they count with no change here. Keep it that way.
- **"Open" doesn't change.** `isSessionOpen` (P0-7) stays "not revealed by both". An `in_discussion`
  session is already answered by both, so Q25 never offers its prompt again (enforced in P1-32).
- **The viewer phase stays.** `phase` is still "what *you* need to do"; `status` is "where *the couple*
  is". The card uses both.
- **`GET /sessions` returns every session.** Five queries in total whatever the size, so no N+1, but the
  list has no limit. That's fine for Gate A; paging belongs with the hub tabs (roadmap) or P2-5.

### Flags

Settled 2026-10-26, recorded here so the code matches:

1. **Section heading:** "We talked about". The pill on those cards says "Talked about".
2. **Sort order:** unchanged. `in_discussion` sessions have the phase `revealed`, so they sort after
   sessions that need the viewer, newest first. You plan to rework the hub with `Array.filter` and tabs
   (open discussions, unrevealed, …) later; this guide doesn't pre-empt that.
3. **No "follow-up waiting for you" hint on the card yet.** Partner feedback; it needs per-viewer
   follow-up state in `GET /sessions` and goes with the hub tabs on the roadmap.
4. **Pill colours** are a suggestion: `in_discussion` uses `bg-accent` (not `bg-accent-soft`, which
   "Your turn" already uses) and `completed` uses `bg-muted`.

Checked on a scratch copy of `main` @ `11e738c` with H-16 applied: domain 82, API 73 and web 18 tests
pass; `check-types` and `lint` clean; formatted with the repo's `.prettierrc`.

---

## Step 1 · Domain

### `packages/domain/src/sessions/session-completion.ts` (new)
```ts
import { areFollowUpsUnlocked } from "./follow-ups-unlocked.js";

/** Where the couple is with a main session (Q1). Derived, never stored. */
export type SessionCompletionState =
  | "in_progress"
  | "in_discussion"
  | "completed";

export type SessionCompletionInput = {
  memberIds: string[];
  /** Who has revealed the main prompt. */
  revealedUserIds: string[];
  /**
   * Started follow-ups (child sessions) only, of any prompt kind, so MVP-2's
   * partner-added questions count without a change here.
   */
  children: Array<{
    /** Who has submitted an answer to this follow-up. */
    submittedUserIds: string[];
    /** Always false until mutual archive exists (Q4, roadmap). */
    archived: boolean;
  }>;
};

/**
 * Works out the couple-level state of a main session.
 *
 * @remarks
 * Q1: `in_progress` until both have revealed the main prompt; then
 * `in_discussion` while any started, unarchived follow-up isn't submitted by
 * both; otherwise `completed`. Follow-ups nobody has started don't count, so
 * starting a new one moves a completed session back to `in_discussion`.
 *
 * @param input - The couple's members, the main prompt's reveals and the
 *   started follow-ups
 * @returns The session's completion state
 */
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
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: [],
        children: [],
      }),
    ).toBe("in_progress");
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: ["u1"],
        children: [],
      }),
    ).toBe("in_progress");
  });

  it("is in_progress for a couple with no members (never completed by accident)", () => {
    expect(
      sessionCompletionState({
        memberIds: [],
        revealedUserIds: [],
        children: [],
      }),
    ).toBe("in_progress");
  });

  it("is completed when both revealed and no follow-up was started", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [],
      }),
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

  it("is in_discussion for a follow-up started but not answered by either", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [{ submittedUserIds: [], archived: false }],
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
        children: [{ submittedUserIds: ["u1"], archived: true }],
      }),
    ).toBe("completed");
  });

  it("goes back to in_discussion when a new follow-up starts on a completed session", () => {
    const children = [{ submittedUserIds: ["u1", "u2"], archived: false }];
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children,
      }),
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

### `packages/domain/src/index.ts` (change)
**Before**
```ts
export * from "./sessions/follow-ups-unlocked.js";
```
**After**
```ts
export * from "./sessions/follow-ups-unlocked.js";
export * from "./sessions/session-completion.js";
```

---

## Step 2 · API

### `apps/api/src/conversations/conversations.service.ts` (change)

**Domain import, before**
```ts
import {
  areFollowUpsUnlocked,
  isSessionOpen,
  sessionViewerPhase,
  type PromptDepth,
} from "@couple-space/domain";
```
**After**
```ts
import {
  areFollowUpsUnlocked,
  isSessionOpen,
  sessionCompletionState,
  sessionViewerPhase,
  type PromptDepth,
} from "@couple-space/domain";
```

**`listSessions`, after the reveals query, before**
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

**Inside `rows.map`, before**
```ts
          revealedUserIds,
        });
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
          revealedUserIds,
        });
        const status = sessionCompletionState({
          memberIds,
          revealedUserIds,
          children: children
            .filter((c) => c.parentSessionId === row.id)
            .map((c) => ({
              submittedUserIds: childResponses
                .filter((r) => r.sessionId === c.id && r.submittedAt != null)
                .map((r) => r.userId),
              // Nothing is archived in MVP-1 (Q4: mutual archive is on the roadmap).
              archived: false,
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

**`submitResponse`: touch the parent too.** Without this, a session that moves back to
`in_discussion` keeps its old place in the list. **Before**
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

**`startFollowUp`: bump the parent only when this call created the child.** The early
`if (existing) return existing` and the lost-race path don't bump: the partner's call already did.
**Before**
```ts
    if (created) return created;
    // Lost the race: the partner's insert won.
```
**After**
```ts
    if (created) {
      // The parent is back in discussion, so move it up the hub.
      await this.db
        .update(conversationSessions)
        .set({ updatedAt: new Date() })
        .where(eq(conversationSessions.id, parentSessionId));
      return created;
    }
    // Lost the race: the partner's insert won.
```

### `apps/api/src/conversations/conversations.service.test.ts` (change)

**`startFollowUp` `setup`: the fake `db` needs `update` now. Before**
```ts
    const db = {
      select: vi.fn(),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
```
**After**
```ts
    const db = {
      select: vi.fn(),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      // P1-6: a new child bumps the parent's updatedAt.
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      })),
    };
```
**"returns the existing child …", before**
```ts
    ).resolves.toEqual({ id: "child-0" });
    expect(db.transaction).not.toHaveBeenCalled();
  });
```
**After**
```ts
    ).resolves.toEqual({ id: "child-0" });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
```
**"creates the child …", before**
```ts
    ).resolves.toEqual({ id: "child-1" });
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });
});
```
**After** (the closing `});` ends the `startFollowUp` block; the new block follows it)
```ts
    ).resolves.toEqual({ id: "child-1" });
    expect(tx.insert).toHaveBeenCalledTimes(2);
    // The parent moves up the hub (P1-6).
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});

describe("ConversationsService.listSessions status", () => {
  const user = { id: "u1", email: "a@example.com", emailVerified: true };
  const now = new Date();

  /**
   * Mocks the selects `listSessions` makes, in order.
   *
   * @remarks
   * `requireMembership` does three selects (membership, couple, members),
   * then `listSessions` reads sessions, responses, reveals, children and,
   * only when there are children, their responses.
   *
   * @param children - Child sessions of `s1`
   * @param childResponses - Responses on those children
   * @returns A fake `Db` with `select` mocked
   */
  function setup(
    children: Array<{ id: string; parentSessionId: string }>,
    childResponses: Array<{
      sessionId: string;
      userId: string;
      submittedAt: Date | null;
    }>,
  ) {
    const db = { select: vi.fn() };
    db.select
      .mockReturnValueOnce(
        queryResult([{ coupleId: "c1", userId: "u1", status: "active" }]),
      )
      .mockReturnValueOnce(queryResult([{ id: "c1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ userId: "u1" }, { userId: "u2" }]))
      .mockReturnValueOnce(
        queryResult([
          { id: "s1", updatedAt: now, promptTitle: "T", promptText: "Q" },
        ]),
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
      .mockReturnValueOnce(queryResult(children))
      .mockReturnValueOnce(queryResult(childResponses));
    return db;
  }

  async function listSessions(db: unknown) {
    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: db },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();
    return module.get(ConversationsService).listSessions(user);
  }

  it("marks a revealed session with no follow-ups as completed", async () => {
    const db = setup([], []);
    const { sessions } = await listSessions(db);

    expect(sessions[0]).toMatchObject({
      phase: "revealed",
      status: "completed",
    });
    // No children, so their responses aren't queried.
    expect(db.select).toHaveBeenCalledTimes(7);
  });

  it("marks a revealed session with an unfinished follow-up as in_discussion", async () => {
    const db = setup(
      [{ id: "child1", parentSessionId: "s1" }],
      [
        { sessionId: "child1", userId: "u1", submittedAt: now },
        { sessionId: "child1", userId: "u2", submittedAt: null },
      ],
    );
    const { sessions } = await listSessions(db);

    expect(sessions[0]).toMatchObject({
      phase: "revealed",
      status: "in_discussion",
    });
  });

  it("marks it completed once both have submitted the follow-up", async () => {
    const db = setup(
      [{ id: "child1", parentSessionId: "s1" }],
      [
        { sessionId: "child1", userId: "u1", submittedAt: now },
        { sessionId: "child1", userId: "u2", submittedAt: now },
      ],
    );
    const { sessions } = await listSessions(db);

    expect(sessions[0]).toMatchObject({ status: "completed" });
  });
});```

---

## Step 3 · Web

Needs [H-16](H-16-web-unit-tests.md) for the tests.

### `apps/web/hooks/use-sessions.ts` (change)
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
  phase: SessionViewerPhase;
  updatedAt: string;
};
```
**After** (in `SessionListItem`)
```ts
  phase: SessionViewerPhase;
  /** Where the couple is (Q1); `phase` is what the viewer needs to do. */
  status: SessionCompletionState;
  updatedAt: string;
};
```
`useSessionsQuery` keeps `select: sortSessionsByPriority`. The split happens in the list, below.

### `apps/web/lib/session-sort.ts` (change): add at the end
```ts
/**
 * Splits hub sessions into active ones and the "We talked about" list.
 *
 * @remarks
 * Active is `in_progress` and `in_discussion`; talked about is `completed`
 * (Q1). Keeps the incoming order, so call it on already-sorted data.
 *
 * @param sessions - Sessions from {@link sortSessionsByPriority}
 * @returns Two new arrays, in the same order as the input
 */
export function splitActiveAndTalkedAbout(sessions: SessionListItem[]): {
  active: SessionListItem[];
  talkedAbout: SessionListItem[];
} {
  return {
    active: sessions.filter((s) => s.status !== "completed"),
    talkedAbout: sessions.filter((s) => s.status === "completed"),
  };
}
```
`revealed` is already last in `PRIORITY_ORDER`, so `in_discussion` sessions sit below the ones that need
the viewer, newest first. Completed sessions are all `revealed`, so they come out newest first too.

### `apps/web/lib/session-sort.test.ts` (change)
The `session()` helper from H-16 gets a `status`, and the split gets its own tests. Replace the whole file:
```ts
import { describe, expect, it } from "vitest";
import type { SessionListItem } from "@/hooks/use-sessions";
import {
  sortSessionsByPriority,
  splitActiveAndTalkedAbout,
} from "./session-sort";

function session(
  id: string,
  phase: SessionListItem["phase"],
  updatedAt: string,
  status: SessionListItem["status"] = "in_progress",
): SessionListItem {
  return { id, promptTitle: id, promptText: id, phase, status, updatedAt };
}

describe("sortSessionsByPriority", () => {
  it("puts the sessions that need the viewer first", () => {
    const sorted = sortSessionsByPriority([
      session("revealed", "revealed", "2026-10-26T10:00:00.000Z"),
      session("waiting", "waiting_for_partner", "2026-10-26T10:00:00.000Z"),
      session("ready", "ready_to_reveal", "2026-10-26T10:00:00.000Z"),
      session("answering", "answering", "2026-10-26T10:00:00.000Z"),
    ]);

    expect(sorted.map((s) => s.id)).toEqual([
      "answering",
      "ready",
      "waiting",
      "revealed",
    ]);
  });

  it("breaks ties newest first", () => {
    const sorted = sortSessionsByPriority([
      session("old", "answering", "2026-10-01T10:00:00.000Z"),
      session("new", "answering", "2026-10-26T10:00:00.000Z"),
    ]);

    expect(sorted.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("doesn't mutate the input (React Query's cache)", () => {
    const input = [
      session("revealed", "revealed", "2026-10-26T10:00:00.000Z"),
      session("answering", "answering", "2026-10-26T10:00:00.000Z"),
    ];
    sortSessionsByPriority(input);

    expect(input.map((s) => s.id)).toEqual(["revealed", "answering"]);
  });
});

describe("splitActiveAndTalkedAbout", () => {
  const at = "2026-10-26T10:00:00.000Z";

  it("keeps in progress and in discussion active, completed in talked about", () => {
    const { active, talkedAbout } = splitActiveAndTalkedAbout([
      session("answering", "answering", at),
      session("discussing", "revealed", at, "in_discussion"),
      session("done", "revealed", at, "completed"),
    ]);

    expect(active.map((s) => s.id)).toEqual(["answering", "discussing"]);
    expect(talkedAbout.map((s) => s.id)).toEqual(["done"]);
  });

  it("keeps the incoming order in both lists", () => {
    const { talkedAbout } = splitActiveAndTalkedAbout([
      session("newer", "revealed", at, "completed"),
      session("older", "revealed", at, "completed"),
    ]);

    expect(talkedAbout.map((s) => s.id)).toEqual(["newer", "older"]);
  });
});
```

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
/**
 * The hub pill's wording for a session.
 *
 * @remarks
 * Before both have revealed, the pill says what the viewer needs to do
 * (`phase`). After that, it says where the couple is (`status`, Q1).
 *
 * @param phase - The viewer's phase
 * @param status - The couple-level state, when known
 * @returns The label to show
 */
export function sessionStatusLabel(
  phase: SessionViewerPhase,
  status?: SessionCompletionState,
): string {
  if (status === "in_discussion") return "In discussion";
  if (status === "completed") return "Talked about";
  return LABELS[phase];
}
```
`sessionCardActionLabel` doesn't change. For both new states the phase is `revealed`, so the action is
"View answers".

### `apps/web/lib/session-status-label.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import {
  sessionCardActionLabel,
  sessionStatusLabel,
} from "./session-status-label";

describe("sessionStatusLabel", () => {
  it("uses the viewer's phase before both have revealed", () => {
    expect(sessionStatusLabel("answering", "in_progress")).toBe("Your turn");
    expect(sessionStatusLabel("ready_to_reveal")).toBe("Ready to reveal");
  });

  it("uses the couple's state once both have revealed", () => {
    expect(sessionStatusLabel("revealed", "in_discussion")).toBe(
      "In discussion",
    );
    expect(sessionStatusLabel("revealed", "completed")).toBe("Talked about");
  });
});

describe("sessionCardActionLabel", () => {
  it("is View answers for any revealed session, in discussion or not", () => {
    expect(sessionCardActionLabel("revealed")).toBe("View answers");
  });
});
```

### `apps/web/components/molecules/conversation-status-pill/conversation-status-pill.tsx` (change)
**Before**
```tsx
import type { SessionViewerPhase } from "@couple-space/domain";
```
**After**
```tsx
import type {
  SessionCompletionState,
  SessionViewerPhase,
} from "@couple-space/domain";
```
**Before**
```tsx
        revealed: "bg-secondary text-secondary-foreground",
      },
```
**After**
```tsx
        revealed: "bg-secondary text-secondary-foreground",
        in_discussion: "bg-accent text-accent-foreground",
        completed: "bg-muted text-muted-foreground",
      },
```
**Before**
```tsx
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
type ConversationStatusPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** The viewer's phase; drives the pill until both have revealed. */
  phase: SessionViewerPhase;
  /** The couple-level state (Q1); drives the pill once both have revealed. */
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
`status` is optional so the pill still works anywhere a session has no couple-level state (e.g. a
follow-up card, if you reuse it there).

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
import { splitActiveAndTalkedAbout } from "@/lib/session-sort";
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
  const { active, talkedAbout } = splitActiveAndTalkedAbout(sessions.data);

  return (
    <div className="flex flex-col gap-8">
      {active.length > 0 ? (
        <section
          aria-label="Your conversations"
          className="flex flex-col gap-2"
        >
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

      {talkedAbout.length > 0 ? (
        <section
          aria-labelledby="talked-about-heading"
          className="flex flex-col gap-2"
        >
          <h2 id="talked-about-heading" className="text-lg font-semibold">
            We talked about
          </h2>
          {talkedAbout.map((session) => (
            <ConversationCard key={session.id} session={session} />
          ))}
        </section>
      ) : null}
    </div>
  );
```
If "We talked about" gets long, wrap it in the uncontrolled `Collapsible` from `components/ui/collapsible`,
or fold it into the hub tabs when you build them.

---

## Verification
1. `pnpm check-types && pnpm lint && pnpm test`.
2. Main prompt not revealed by both → active, with the viewer-phase pill as today.
3. Both reveal, no follow-ups started → moves to "We talked about" with a "Talked about" pill.
4. Open it and start a follow-up → back in the active list with "In discussion" (below sessions that need
   you), and near the top of that group.
5. One of you answers it → still "In discussion". Both answer → back in "We talked about".
6. A session with follow-ups nobody started stays in "We talked about".
