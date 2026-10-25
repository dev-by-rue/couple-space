# P1-8 · Curated follow-ups (T5)

[← Phase 1](../phase-1-mvp-1.md) · Size **L** · Gate A · Decisions: [Q1](../../03-product-decisions.md#q1), [Q22](../../03-product-decisions.md#q22) · Schema: [ERD MVP-1](../../erd/mvp-1.md) · After: [P1-10](P1-10-real-email-verification.md) · Step 2 needs: [P1-28](P1-28-catalogue-at-scale.md) · Next: [P1-6](P1-6-session-completion.md) · Progress: [checklist](P1-8-checklist.md)

**Goal:** once both partners have revealed the main prompt, show 2–3 optional follow-up questions. Each
one is a **child session**: answered blind, and both answers **auto-show** as soon as the second partner
submits (no Reveal tap, Q22). There's also a "take it offline" card.

**Done when:**

- Schema: `prompts.parent_prompt_id`, `kind = 'follow_up'`; `conversation_sessions.parent_session_id`, with
  one child per (parent, follow-up prompt).
- Seed: follow-ups on the P1-28 catalogue shape (2 per existing question; a question may have none, Q27).
- Domain: `canViewerSeeAnswerText` and `sessionViewerPhase` take `isFollowUp`; `areFollowUpsUnlocked`.
- `GET /sessions/:id` returns `followUps` only when **both** have revealed (FR-19). `POST /sessions/:id/follow-ups { promptId }`
  creates (or returns) the child. `GET /sessions` excludes children. `POST /sessions/:childId/reveal` is rejected.
- Web: a follow-up list and the offline card under the revealed answers (FR-20, FR-22).
- Domain, mapper and service tests pass.

### Decisions and deviations to flag

- **Follow-up copy is a draft** (Step 2). Edit it freely until Gate A. Follow-up ids come from the
  parent's key plus position, so after Gate A they're append-only within a question (E-13).
- **No push for follow-up answers.** `submitResponse` currently sends "new conversation" when the first
  answer arrives. That text is wrong for a follow-up, so this guide skips the push for child sessions.
  [P1-31](P1-31-notification-events.md) Part B replaces this with follow-up notifications.
- **No confirm dialog** on follow-up submit. The main prompt has one; follow-ups are lighter. Say if you
  want it for consistency.
- **No drafts** for follow-ups (the endpoint would work, but the card doesn't autosave). This keeps the
  card simple.
- **`FollowUpList` owns its mutations** (one pair of hooks per item, so "Sending…" shows only on the card
  you submitted). That matches `ConversationList`, which also calls its own hooks. `FollowUpCard`
  stays presentational.
- **The old reuse notes used `useState`** for the textarea and the open state. This version uses RHF +
  `submitAnswerSchema` and the uncontrolled Base UI `Collapsible`, so there's no `useState` at all.

---

## Step 1 · Database

### `packages/database/src/schema/prompts.ts` (change)

**Before**

```ts
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { promptThemes } from "./prompt-themes.js";

export const prompts = pgTable("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  themeId: uuid("theme_id")
    .notNull()
    .references(() => promptThemes.id),
```

**After**

```ts
import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { promptThemes } from "./prompt-themes.js";

export const prompts = pgTable("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  themeId: uuid("theme_id")
    .notNull()
    .references(() => promptThemes.id),
  /** Set for kind = 'follow_up': the curated prompt this follows. One level only (E-12). */
  parentPromptId: uuid("parent_prompt_id").references(
    (): AnyPgColumn => prompts.id,
  ),
```

### `packages/database/src/schema/conversation-sessions.ts` (change)

**Before**

```ts
import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { couples } from "./couples.js";
import { prompts } from "./prompts.js";

export const conversationSessions = pgTable("conversation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .notNull()
    .references(() => couples.id),
  promptId: uuid("prompt_id")
    .notNull()
    .references(() => prompts.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

**After**

```ts
import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { couples } from "./couples.js";
import { prompts } from "./prompts.js";

export const conversationSessions = pgTable(
  "conversation_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coupleId: uuid("couple_id")
      .notNull()
      .references(() => couples.id),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id),
    /** Null for a main session; set for a follow-up (child) session. */
    parentSessionId: uuid("parent_session_id").references(
      (): AnyPgColumn => conversationSessions.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One child per follow-up. NULLs never collide, so main sessions are unaffected.
    uniqueIndex("conversation_sessions_parent_prompt_unique").on(
      t.parentSessionId,
      t.promptId,
    ),
  ],
);
```

### Migration

`pnpm --filter @couple-space/database generate`. Expect two `ADD COLUMN … uuid` (nullable), two FKs and
one unique index. Nullable columns with no default are safe on tables with rows. Nothing to hand-edit;
just check there's no `NOT NULL`. `clear-sessions.ts` deletes sessions without regard to order. With the
self-FK, children must go first:

### `packages/database/seed/clear-sessions.ts` (change)

**Before**

```ts
await tx.delete(sessionReveals);
await tx.delete(sessionResponses);
return tx
  .delete(conversationSessions)
  .returning({ id: conversationSessions.id });
```

**After**

```ts
await tx.delete(sessionReveals);
await tx.delete(sessionResponses);
// Children reference their parent session, so delete them first.
await tx
  .delete(conversationSessions)
  .where(isNotNull(conversationSessions.parentSessionId));
return tx
  .delete(conversationSessions)
  .returning({ id: conversationSessions.id });
```

Add `import { isNotNull } from "drizzle-orm";`.

---

## Step 2 · Seed

**Do [P1-28](P1-28-catalogue-at-scale.md) first.** It replaces `catalogue.data.ts` with key-based ids
and one file per theme. This step adds follow-ups to that shape. A follow-up's key is its parent's key
plus its position (`small-moment-this-week/1`), so follow-ups are **append-only within a question**:
add new ones at the end, retire rather than reorder. A question can have none (Q27).

### `packages/database/seed/catalogue/types.ts` (change)

**Before**

```ts
  depth: Depth;
  tags: TagSlug[];
  retired?: true;
};
```

**After**

```ts
  depth: Depth;
  tags: TagSlug[];
  /**
   * Optional follow-ups (P1-8). Ids come from position, so append only:
   * never reorder or remove one. Retiring the question retires them too.
   */
  followUps?: string[];
  retired?: true;
};
```

### `packages/database/seed/catalogue/ids.ts` (change) — add

```ts
/**
 * Id for a follow-up.
 *
 * @remarks Position-based within its question, so follow-ups are append-only.
 * @param key - The parent question's key.
 * @param position - 1-based position in `followUps`.
 * @returns The follow-up's UUID.
 */
export const followUpId = (key: string, position: number) =>
  uuidv5(`prompt:${key}/${position}`, NAMESPACE);
```

### `packages/database/seed/catalogue/index.ts` (change)

**Before**

```ts
import { promptId, tagId, themeId } from "./ids.js";
```

**After**

```ts
import { followUpId, promptId, tagId, themeId } from "./ids.js";
```

**Before**

```ts
export const promptRows: PromptRow[] = catalogue.flatMap((theme) =>
  theme.questions.map((question, index) => ({
    id: promptId(question.key),
    key: question.key,
    themeId: themeId(theme.slug),
    title: question.title,
    description: "A quiet question to answer in your own words.",
    text: question.text,
    kind: "curated",
    depth: question.depth,
    sortOrder: index,
    retiredAt: question.retired ? new Date() : null,
  })),
);
```

**After**

```ts
export const promptRows: PromptRow[] = catalogue.flatMap((theme) =>
  theme.questions.flatMap((question, index) => {
    const retiredAt = question.retired ? new Date() : null;

    const curated: PromptRow = {
      id: promptId(question.key),
      key: question.key,
      themeId: themeId(theme.slug),
      parentPromptId: null,
      title: question.title,
      description: "A quiet question to answer in your own words.",
      text: question.text,
      kind: "curated",
      depth: question.depth,
      sortOrder: index,
      retiredAt,
    };

    const followUps: PromptRow[] = (question.followUps ?? []).map(
      (text, k) => ({
        id: followUpId(question.key, k + 1),
        key: `${question.key}/${k + 1}`,
        themeId: themeId(theme.slug),
        parentPromptId: curated.id,
        title: `${question.title} · follow-up ${k + 1}`,
        description: "A follow-up to talk through together.",
        text,
        kind: "follow_up",
        depth: question.depth,
        sortOrder: k,
        retiredAt,
      }),
    );

    return [curated, ...followUps];
  }),
);
```

Follow-ups take the parent's depth and have no tags of their own. `listThemes` already filters on
`kind = 'curated'`, so they never show on `/start`.

### `packages/database/seed/catalogue.seed.ts` (change)

**Before**

```ts
        key: sql`excluded.key`,
        themeId: sql`excluded.theme_id`,
```

**After**

```ts
        key: sql`excluded.key`,
        themeId: sql`excluded.theme_id`,
        parentPromptId: sql`excluded.parent_prompt_id`,
```

Skip this if the line is already there from the earlier version of this step. Curated rows come
before their follow-ups in `promptRows`. Postgres checks FKs per statement, so order doesn't strictly
matter, but it's tidy.

### `packages/database/seed/catalogue/catalogue.test.ts` (change) — add inside `describe("catalogue")`

```ts
it("points every follow-up at a curated prompt", () => {
  const curatedIds = promptRows
    .filter((p) => p.kind === "curated")
    .map((p) => p.id);
  for (const followUp of promptRows.filter((p) => p.kind === "follow_up")) {
    expect(curatedIds).toContain(followUp.parentPromptId);
  }
});

it("has no empty follow-ups", () => {
  for (const theme of catalogue) {
    for (const question of theme.questions) {
      for (const text of question.followUps ?? []) {
        expect(text.trim()).not.toBe("");
      }
    }
  }
});
```

The unique-id and unique-key tests from P1-28 already cover follow-ups, since they're in `promptRows`.

### Follow-up copy (draft)

Add `followUps` to each question in its theme file, for example:

```ts
    {
      key: "small-moment-this-week",
      title: "A moment that stayed",
      text: "What small moment with me has stayed with you this week?",
      depth: "light",
      tags: ["thoughtful"],
      followUps: [
        "What made that moment stand out from the rest of the week?",
        "How could we make room for more moments like that?",
      ],
    },
```

Draft copy for the rest, by key. Edit freely until Gate A.

| Key                             | Follow-up 1                                                   | Follow-up 2                                                     |
| ------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| `small-moment-this-week`        | What made that moment stand out from the rest of the week?    | How could we make room for more moments like that?              |
| `most-at-ease-everyday`         | What gets in the way of feeling like that more often?         | Is there something I do that helps you get there?               |
| `ritual-more-time-for`          | What would it take to make it happen this week?               | Where did that ritual come from for you?                        |
| `doing-well-lately`             | What do you think has helped us do that?                      | How would you like us to keep it going?                         |
| `gentler-with-each-other`       | What would gentler look like in a real moment?                | Is there something you'd like me to try first?                  |
| `different-between-us-recently` | Does the change feel good, or does it worry you a little?     | What do you think is behind it?                                 |
| `good-year-together`            | What's one small thing that would already move us towards it? | What would you want us to let go of this year?                  |
| `unspoken-hope`                 | What made it hard to say until now?                           | How could I support that hope?                                  |
| `more-spacious-life`            | What's taking up the space right now?                         | What would you do with that extra room?                         |
| `wish-i-understood`             | When do you notice that gap the most?                         | What would help me understand it better?                        |
| `bringing-you-energy`           | What has been draining it?                                    | How can I protect the things that give you energy?              |
| `growing-into`                  | What first made you notice it?                                | How would you like me to encourage it?                          |
| `calmer-home`                   | Which part of the week feels least calm at home?              | What's one change we could try for a fortnight?                 |
| `feeling-secure-together`       | When have you felt most secure with me?                       | Is there anything that makes you feel less secure right now?    |
| `balanced-responsibility`       | What would a fairer split look like to you?                   | Is there something you'd happily take on in exchange?           |
| `felt-cared-for`                | What made it land the way it did?                             | Is there a way you'd like to be cared for that I haven't tried? |
| `grateful-for-today`            | Has that always been there, or has it grown?                  | How could we tell each other more often?                        |
| `quality-noticed-anew`          | When did you notice it?                                       | How does it show up between us?                                 |

The log line now counts follow-ups too: `seeded 6 themes, 54 prompts, 6 tags`.

---

## Step 3 · Domain

### `packages/domain/src/sessions/session-answer-visibility.ts` (change)

**Before**

```ts
export type AnswerVisibilityInput = {
  viewerId: string;
  answerAuthorId: string;
  authorSubmitted: boolean;
  bothSubmitted: boolean;
  viewerHasRevealed: boolean;
};

/** Own submitted answers are visible to the author; partner text needs both submit + viewer reveal. */
export function canViewerSeeAnswerText(input: AnswerVisibilityInput): boolean {
  if (input.answerAuthorId === input.viewerId) return true;
  if (!input.authorSubmitted) return false;
  return input.bothSubmitted && input.viewerHasRevealed;
}
```

**After**

```ts
export type AnswerVisibilityInput = {
  viewerId: string;
  answerAuthorId: string;
  authorSubmitted: boolean;
  bothSubmitted: boolean;
  viewerHasRevealed: boolean;
  /** Child session (Q22): no reveal step; both submitted is enough. */
  isFollowUp?: boolean;
};

/**
 * Own answers are always visible to the author. Partner text needs both
 * submitted, plus the viewer's reveal on a main session.
 */
export function canViewerSeeAnswerText(input: AnswerVisibilityInput): boolean {
  if (input.answerAuthorId === input.viewerId) return true;
  if (!input.authorSubmitted) return false;
  if (input.isFollowUp) return input.bothSubmitted;
  return input.bothSubmitted && input.viewerHasRevealed;
}
```

### `packages/domain/src/sessions/session-viewer-phase.ts` (change)

**Before**

```ts
  revealedUserIds: string[];
};
```

**After**

```ts
  revealedUserIds: string[];
  /** Child session (Q22): goes straight from waiting_for_partner to revealed. */
  isFollowUp?: boolean;
};
```

**Before**

```ts
if (!bothSubmitted) return "waiting_for_partner";
if (!viewerRevealed) return "ready_to_reveal";
```

**After**

```ts
if (!bothSubmitted) return "waiting_for_partner";
if (input.isFollowUp) return "revealed";
if (!viewerRevealed) return "ready_to_reveal";
```

### `packages/domain/src/sessions/follow-ups-unlocked.ts` (new)

```ts
export type FollowUpsUnlockedInput = {
  memberIds: string[];
  revealedUserIds: string[];
};

/** FR-19: follow-ups appear only once every member has revealed the main prompt. */
export function areFollowUpsUnlocked(input: FollowUpsUnlockedInput): boolean {
  return (
    input.memberIds.length > 0 &&
    input.memberIds.every((id) => input.revealedUserIds.includes(id))
  );
}
```

This is `!isSessionOpen(...)` today. It's a separate name because P1-6 changes what "open" means
(follow-ups in progress), and the unlock rule must not change with it.

### `packages/domain/src/index.ts` (change) — add

```ts
export * from "./sessions/follow-ups-unlocked.js";
```

### `packages/domain/src/sessions/session-answer-visibility.test.ts` (change) — add

```ts
describe("canViewerSeeAnswerText for follow-ups", () => {
  const base = {
    viewerId: "u1",
    answerAuthorId: "u2",
    viewerHasRevealed: false,
    isFollowUp: true,
  };

  it("hides partner text until both have submitted", () => {
    expect(
      canViewerSeeAnswerText({
        ...base,
        authorSubmitted: true,
        bothSubmitted: false,
      }),
    ).toBe(false);
  });

  it("shows partner text as soon as both have submitted, with no reveal", () => {
    expect(
      canViewerSeeAnswerText({
        ...base,
        authorSubmitted: true,
        bothSubmitted: true,
      }),
    ).toBe(true);
  });

  it("main sessions still need the viewer's reveal", () => {
    expect(
      canViewerSeeAnswerText({
        ...base,
        isFollowUp: false,
        authorSubmitted: true,
        bothSubmitted: true,
      }),
    ).toBe(false);
  });
});
```

(Use whatever import line the file already has for `canViewerSeeAnswerText`.)

### `packages/domain/src/sessions/session-viewer-phase.test.ts` (change) — add

```ts
describe("sessionViewerPhase for follow-ups", () => {
  const base = {
    viewerId: "u1",
    memberIds: ["u1", "u2"],
    revealedUserIds: [],
    isFollowUp: true,
  };

  it("waits for the partner after the viewer submits", () => {
    expect(
      sessionViewerPhase({
        ...base,
        responses: [
          { userId: "u1", submitted: true },
          { userId: "u2", submitted: false },
        ],
      }),
    ).toBe("waiting_for_partner");
  });

  it("goes straight to revealed when both submit, never ready_to_reveal", () => {
    expect(
      sessionViewerPhase({
        ...base,
        responses: [
          { userId: "u1", submitted: true },
          { userId: "u2", submitted: true },
        ],
      }),
    ).toBe("revealed");
  });
});
```

### `packages/domain/src/sessions/follow-ups-unlocked.test.ts` (new)

```ts
import { describe, expect, it } from "vitest";
import { areFollowUpsUnlocked } from "./follow-ups-unlocked.js";

describe("areFollowUpsUnlocked", () => {
  it("is locked until both members have revealed", () => {
    expect(
      areFollowUpsUnlocked({ memberIds: ["u1", "u2"], revealedUserIds: [] }),
    ).toBe(false);
    expect(
      areFollowUpsUnlocked({
        memberIds: ["u1", "u2"],
        revealedUserIds: ["u1"],
      }),
    ).toBe(false);
  });

  it("unlocks when both have revealed", () => {
    expect(
      areFollowUpsUnlocked({
        memberIds: ["u1", "u2"],
        revealedUserIds: ["u2", "u1"],
      }),
    ).toBe(true);
  });

  it("stays locked with no members", () => {
    expect(areFollowUpsUnlocked({ memberIds: [], revealedUserIds: [] })).toBe(
      false,
    );
  });
});
```

---

## Step 4 · API

### `apps/api/src/conversations/dto/start-follow-up.schema.ts` (new, same as `create-session.schema.ts`)

```ts
import { z } from "zod";

export const startFollowUpSchema = z.object({
  promptId: z.string().uuid(),
});

export type StartFollowUpInput = z.infer<typeof startFollowUpSchema>;
```

### `apps/api/src/conversations/session-detail.mapper.ts` (replace whole file)

```ts
import {
  areFollowUpsUnlocked,
  canViewerSeeAnswerText,
  sessionViewerPhase,
  type SessionViewerPhase,
} from "@couple-space/domain";

type ResponseDto = {
  userId: string;
  displayName: string;
  submitted: boolean;
  text: string | null;
};

export type FollowUpDto = {
  promptId: string;
  text: string;
  /** Null until either partner starts it. */
  sessionId: string | null;
  /** Null until started. Never `ready_to_reveal` (Q22). */
  phase: SessionViewerPhase | null;
  responses: ResponseDto[];
};

export type SessionDetailDto = {
  id: string;
  parentSessionId: string | null;
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: "curated" | "follow_up";
  };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: ResponseDto[];
  /** Present only on a main session once both have revealed (FR-19). */
  followUps?: FollowUpDto[];
};

type ResponseSource = Array<{
  userId: string;
  displayName: string;
  body: string;
  submittedAt: Date | null;
}>;

export type SessionDetailSource = {
  sessionId: string;
  parentSessionId: string | null;
  viewerId: string;
  memberIds: string[];
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: string;
  };
  responses: ResponseSource;
  revealedUserIds: string[];
  /** Loaded by the service only when the main prompt is unlocked. */
  followUps?: Array<{
    prompt: { id: string; text: string };
    session: { id: string; responses: ResponseSource } | null;
  }>;
};

/** Phase + redacted responses for one viewer. Shared by main and child sessions. */
function viewerView(input: {
  viewerId: string;
  memberIds: string[];
  responses: ResponseSource;
  revealedUserIds: string[];
  isFollowUp: boolean;
}) {
  const flags = input.responses.map((r) => ({
    userId: r.userId,
    submitted: r.submittedAt != null,
  }));
  const bothSubmitted = input.memberIds.every((id) =>
    flags.some((r) => r.userId === id && r.submitted),
  );
  const viewerHasRevealed = input.revealedUserIds.includes(input.viewerId);
  const phase = sessionViewerPhase({
    viewerId: input.viewerId,
    memberIds: input.memberIds,
    responses: flags,
    revealedUserIds: input.revealedUserIds,
    isFollowUp: input.isFollowUp,
  });
  const partner = input.responses.find((r) => r.userId !== input.viewerId);

  return {
    phase,
    partnerSubmitted: partner?.submittedAt != null,
    responses: input.responses.map((r): ResponseDto => {
      const submitted = r.submittedAt != null;
      const visible = canViewerSeeAnswerText({
        viewerId: input.viewerId,
        answerAuthorId: r.userId,
        authorSubmitted: submitted,
        bothSubmitted,
        viewerHasRevealed,
        isFollowUp: input.isFollowUp,
      });
      return {
        userId: r.userId,
        displayName: r.displayName,
        submitted,
        text: visible ? r.body : null,
      };
    }),
  };
}

/** Pure mapper: applies domain redaction for the requesting viewer. */
export function buildSessionDetailDto(
  source: SessionDetailSource,
): SessionDetailDto {
  const isFollowUp = source.parentSessionId != null;
  const view = viewerView({
    viewerId: source.viewerId,
    memberIds: source.memberIds,
    responses: source.responses,
    revealedUserIds: source.revealedUserIds,
    isFollowUp,
  });

  const unlocked =
    !isFollowUp &&
    areFollowUpsUnlocked({
      memberIds: source.memberIds,
      revealedUserIds: source.revealedUserIds,
    });

  return {
    id: source.sessionId,
    parentSessionId: source.parentSessionId,
    prompt: {
      id: source.prompt.id,
      title: source.prompt.title,
      description: source.prompt.description,
      text: source.prompt.text,
      kind: isFollowUp ? "follow_up" : "curated",
    },
    ...view,
    ...(unlocked && source.followUps
      ? {
          followUps: source.followUps.map((f): FollowUpDto => {
            if (!f.session) {
              return {
                promptId: f.prompt.id,
                text: f.prompt.text,
                sessionId: null,
                phase: null,
                responses: [],
              };
            }
            const child = viewerView({
              viewerId: source.viewerId,
              memberIds: source.memberIds,
              responses: f.session.responses,
              revealedUserIds: [],
              isFollowUp: true,
            });
            return {
              promptId: f.prompt.id,
              text: f.prompt.text,
              sessionId: f.session.id,
              phase: child.phase,
              responses: child.responses,
            };
          }),
        }
      : {}),
  };
}
```

The mapper checks the unlock itself, so the DTO can never leak follow-ups, even if the service loaded
them by mistake.

### `apps/api/src/conversations/conversations.service.ts` (changes)

**Imports, before**

```ts
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { isSessionOpen, sessionViewerPhase } from "@couple-space/domain";
```

**After**

```ts
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  areFollowUpsUnlocked,
  isSessionOpen,
  sessionViewerPhase,
} from "@couple-space/domain";
```

Also add `BadRequestException` to the `@nestjs/common` import,
`import type { StartFollowUpInput } from "./dto/start-follow-up.schema.js";`, and
`type SessionDetailSource` to the mapper import.

**`requireSessionMember` returns the session too, before**

```ts
    if (session.coupleId !== ctx.coupleId) {
      throw new ForbiddenException({ reason: "not_session_member" });
    }

    return ctx;
  }
```

**After**

```ts
    if (session.coupleId !== ctx.coupleId) {
      throw new ForbiddenException({ reason: "not_session_member" });
    }

    return { ...ctx, session };
  }
```

Existing callers only read `memberIds`/`coupleId`, so they keep working.

**`listSessions` hides children, before**

```ts
      .where(eq(conversationSessions.coupleId, ctx.coupleId))
      .orderBy(asc(conversationSessions.updatedAt));
```

**After**

```ts
      .where(
        and(
          eq(conversationSessions.coupleId, ctx.coupleId),
          isNull(conversationSessions.parentSessionId),
        ),
      )
      .orderBy(asc(conversationSessions.updatedAt));
```

**`createSession` reuse check, before**

```ts
        and(
          eq(conversationSessions.coupleId, ctx.coupleId),
          eq(conversationSessions.promptId, prompt.id),
        ),
```

**After**

```ts
        and(
          eq(conversationSessions.coupleId, ctx.coupleId),
          eq(conversationSessions.promptId, prompt.id),
          isNull(conversationSessions.parentSessionId),
        ),
```

(Defensive: `prompt.kind` is already `curated` here, so a child can't match today.)

**`submitResponse`: no "new conversation" push for children, before**

```ts
    if (isFirstToSubmit) {
```

**After**

```ts
    // Follow-ups don't push: the "new conversation" text would be wrong (see guide).
    if (isFirstToSubmit && ctx.session.parentSessionId == null) {
```

**`revealSession`: reject children, before**

```ts
    const ctx = await this.requireSessionMember(user, sessionId);

    const responses = await this.db
      .select()
      .from(sessionResponses)
      .where(eq(sessionResponses.sessionId, sessionId));

    const bothSubmitted = ctx.memberIds.every((id) =>
```

**After**

```ts
    const ctx = await this.requireSessionMember(user, sessionId);
    if (ctx.session.parentSessionId != null) {
      // Q22: follow-ups auto-show; there's nothing to reveal.
      throw new BadRequestException({ reason: "follow_up_has_no_reveal" });
    }

    const responses = await this.db
      .select()
      .from(sessionResponses)
      .where(eq(sessionResponses.sessionId, sessionId));

    const bothSubmitted = ctx.memberIds.every((id) =>
```

**New method, add after `revealSession`**

```ts
  /**
   * Starts (or returns) the child session for one follow-up of a main
   * session. Either partner can start it; the second call returns the same id.
   */
  async startFollowUp(
    user: AuthUser,
    parentSessionId: string,
    input: StartFollowUpInput,
  ): Promise<{ id: string }> {
    const ctx = await this.requireSessionMember(user, parentSessionId);
    if (ctx.coupleStatus !== "active") {
      throw new ForbiddenException({ reason: "couple_not_active" });
    }
    if (ctx.session.parentSessionId != null) {
      // E-12: one level only.
      throw new BadRequestException({ reason: "follow_up_of_follow_up" });
    }

    const reveals = await this.db
      .select({ userId: sessionReveals.userId })
      .from(sessionReveals)
      .where(eq(sessionReveals.sessionId, parentSessionId));
    if (
      !areFollowUpsUnlocked({
        memberIds: ctx.memberIds,
        revealedUserIds: reveals.map((r) => r.userId),
      })
    ) {
      throw new ForbiddenException({ reason: "follow_ups_locked" });
    }

    const [prompt] = await this.db
      .select()
      .from(prompts)
      .where(
        and(
          eq(prompts.id, input.promptId),
          eq(prompts.kind, "follow_up"),
          eq(prompts.parentPromptId, ctx.session.promptId),
        ),
      )
      .limit(1);
    if (!prompt) {
      throw new NotFoundException({ reason: "prompt_not_found" });
    }

    const existing = await this.findChild(parentSessionId, prompt.id);
    if (existing) return existing;

    if (prompt.retiredAt) {
      throw new NotFoundException({ reason: "prompt_retired" });
    }

    const created = await this.db.transaction(async (tx) => {
      // The unique index settles a race where both partners tap at once.
      const [row] = await tx
        .insert(conversationSessions)
        .values({
          coupleId: ctx.coupleId,
          promptId: prompt.id,
          parentSessionId,
        })
        .onConflictDoNothing()
        .returning({ id: conversationSessions.id });
      if (!row) return null;

      await tx.insert(sessionResponses).values(
        ctx.memberIds.map((memberId) => ({
          sessionId: row.id,
          userId: memberId,
          body: "",
          submittedAt: null,
        })),
      );
      return row;
    });

    if (created) return created;
    // Lost the race: the partner's insert won.
    const winner = await this.findChild(parentSessionId, prompt.id);
    if (!winner) throw new ConflictException({ reason: "follow_up_conflict" });
    return winner;
  }

  private async findChild(
    parentSessionId: string,
    promptId: string,
  ): Promise<{ id: string } | undefined> {
    const [row] = await this.db
      .select({ id: conversationSessions.id })
      .from(conversationSessions)
      .where(
        and(
          eq(conversationSessions.parentSessionId, parentSessionId),
          eq(conversationSessions.promptId, promptId),
        ),
      )
      .limit(1);
    return row;
  }
```

**`loadDetail`, before**

```ts
    const ctx = await this.requireSessionMember(user, sessionId);

    const [session] = await this.db
      .select({
        id: conversationSessions.id,
        promptId: prompts.id,
```

**After**

```ts
    const ctx = await this.requireSessionMember(user, sessionId);

    const [session] = await this.db
      .select({
        id: conversationSessions.id,
        parentSessionId: conversationSessions.parentSessionId,
        promptId: prompts.id,
```

**Before**

```ts
    const revealRows = await this.db
      .select()
      .from(sessionReveals)
      .where(eq(sessionReveals.sessionId, sessionId));

    return buildSessionDetailDto({
      sessionId: session.id,
      viewerId: user.id,
```

**After**

```ts
    const revealRows = await this.db
      .select()
      .from(sessionReveals)
      .where(eq(sessionReveals.sessionId, sessionId));
    const revealedUserIds = revealRows.map((r) => r.userId);

    const followUps =
      session.parentSessionId == null &&
      areFollowUpsUnlocked({ memberIds: ctx.memberIds, revealedUserIds })
        ? await this.loadFollowUps(session.id, session.promptId)
        : undefined;

    return buildSessionDetailDto({
      sessionId: session.id,
      parentSessionId: session.parentSessionId,
      followUps,
      viewerId: user.id,
```

and change `revealedUserIds: revealRows.map((r) => r.userId),` at the bottom of that call to just
`revealedUserIds,`.

**New private method, add after `loadDetail`**

```ts
  /** Follow-up prompts for a main session, each with its child session if started. */
  private async loadFollowUps(
    parentSessionId: string,
    parentPromptId: string,
  ): Promise<NonNullable<SessionDetailSource["followUps"]>> {
    const children = await this.db
      .select({
        id: conversationSessions.id,
        promptId: conversationSessions.promptId,
      })
      .from(conversationSessions)
      .where(eq(conversationSessions.parentSessionId, parentSessionId));
    const startedPromptIds = children.map((c) => c.promptId);

    // Retired follow-ups stay visible if the couple already started them.
    const followUpPrompts = await this.db
      .select({ id: prompts.id, text: prompts.text })
      .from(prompts)
      .where(
        and(
          eq(prompts.kind, "follow_up"),
          eq(prompts.parentPromptId, parentPromptId),
          startedPromptIds.length > 0
            ? or(isNull(prompts.retiredAt), inArray(prompts.id, startedPromptIds))
            : isNull(prompts.retiredAt),
        ),
      )
      .orderBy(asc(prompts.sortOrder));

    const childResponses =
      children.length === 0
        ? []
        : await this.db
            .select({
              sessionId: sessionResponses.sessionId,
              userId: sessionResponses.userId,
              body: sessionResponses.body,
              submittedAt: sessionResponses.submittedAt,
              displayName: users.displayName,
            })
            .from(sessionResponses)
            .innerJoin(users, eq(users.id, sessionResponses.userId))
            .where(
              inArray(
                sessionResponses.sessionId,
                children.map((c) => c.id),
              ),
            );

    return followUpPrompts.map((prompt) => {
      const child = children.find((c) => c.promptId === prompt.id);
      return {
        prompt,
        session: child
          ? {
              id: child.id,
              responses: childResponses.filter((r) => r.sessionId === child.id),
            }
          : null,
      };
    });
  }
```

`GET /sessions/:childId` also works now (phase without reveal, no `followUps`). The web doesn't use it
yet; it reads children through the parent.

### `apps/api/src/conversations/conversations.controller.ts` (change)

Add `import { startFollowUpSchema } from "./dto/start-follow-up.schema.js";`, then after `revealSession`:

```ts
  @Post("sessions/:id/follow-ups")
  startFollowUp(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = startFollowUpSchema.parse(body);
    return this.conversations.startFollowUp(user, id, input);
  }
```

### Tests

#### `apps/api/src/conversations/conversations.service.test.ts` — mapper cases

Every existing `buildSessionDetailDto({ ...base, ... })` call now needs `parentSessionId`. Add it to
`base`:
**Before**

```ts
  const base = {
    sessionId: "s1",
    memberIds: ["u1", "u2"],
```

**After**

```ts
  const base = {
    sessionId: "s1",
    parentSessionId: null,
    memberIds: ["u1", "u2"],
```

Then add to `describe("buildSessionDetailDto")`:

```ts
const bothSubmitted = [
  { userId: "u1", displayName: "Rueben", body: "Tea", submittedAt: new Date() },
  { userId: "u2", displayName: "Alex", body: "Walk", submittedAt: new Date() },
];
const followUpSource = [
  {
    prompt: { id: "f1", text: "What made it stand out?" },
    session: {
      id: "c1",
      responses: [
        {
          userId: "u1",
          displayName: "Rueben",
          body: "Mine",
          submittedAt: new Date(),
        },
        {
          userId: "u2",
          displayName: "Alex",
          body: "Theirs",
          submittedAt: null,
        },
      ],
    },
  },
  { prompt: { id: "f2", text: "How could we make room?" }, session: null },
];

it("omits followUps until both have revealed (FR-19)", () => {
  const dto = buildSessionDetailDto({
    ...base,
    viewerId: "u1",
    responses: bothSubmitted,
    revealedUserIds: ["u1"],
    followUps: followUpSource,
  });
  expect(dto.followUps).toBeUndefined();
});

it("includes followUps once both have revealed, redacting the unsubmitted partner", () => {
  const dto = buildSessionDetailDto({
    ...base,
    viewerId: "u1",
    responses: bothSubmitted,
    revealedUserIds: ["u1", "u2"],
    followUps: followUpSource,
  });

  expect(dto.followUps).toHaveLength(2);
  const [started, notStarted] = dto.followUps!;
  expect(started!.phase).toBe("waiting_for_partner");
  expect(started!.responses.find((r) => r.userId === "u1")?.text).toBe("Mine");
  expect(started!.responses.find((r) => r.userId === "u2")?.text).toBeNull();
  expect(notStarted).toMatchObject({
    sessionId: null,
    phase: null,
    responses: [],
  });
});

it("auto-shows follow-up answers when both submitted, with no reveal", () => {
  const dto = buildSessionDetailDto({
    ...base,
    viewerId: "u1",
    responses: bothSubmitted,
    revealedUserIds: ["u1", "u2"],
    followUps: [
      {
        prompt: { id: "f1", text: "Q" },
        session: { id: "c1", responses: bothSubmitted },
      },
    ],
  });
  expect(dto.followUps![0]!.phase).toBe("revealed");
  expect(
    dto.followUps![0]!.responses.find((r) => r.userId === "u2")?.text,
  ).toBe("Walk");
});

it("treats a child session as revealed after both submit, with no followUps", () => {
  const dto = buildSessionDetailDto({
    ...base,
    parentSessionId: "parent",
    viewerId: "u1",
    responses: bothSubmitted,
    revealedUserIds: [],
    followUps: followUpSource,
  });
  expect(dto.phase).toBe("revealed");
  expect(dto.prompt.kind).toBe("follow_up");
  expect(dto.followUps).toBeUndefined();
});
```

#### `apps/api/src/conversations/conversations.service.test.ts` — `startFollowUp`

Uses `queryResult` from `test/factories.ts` (an awaitable chain), so each `select` is one
`mockReturnValueOnce`. `requireSessionMember` does four selects: membership, couple, members, session.

```ts
import { queryResult } from "../../test/factories.js";

describe("ConversationsService.startFollowUp", () => {
  const user = { id: "u1", email: "a@example.com", emailVerified: true };
  const parent = {
    id: "s1",
    coupleId: "c1",
    promptId: "p1",
    parentSessionId: null,
  };

  function setup(opts: {
    reveals: string[];
    prompt?: Record<string, unknown>;
    existing?: { id: string };
    session?: Record<string, unknown>;
  }) {
    const insertSession = {
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: "child-1" }]),
        })),
      })),
    };
    const insertResponses = { values: vi.fn(async () => undefined) };
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce(insertSession)
        .mockReturnValueOnce(insertResponses),
    };

    const db = {
      select: vi.fn(),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    db.select
      .mockReturnValueOnce(
        queryResult([{ coupleId: "c1", userId: "u1", status: "active" }]),
      )
      .mockReturnValueOnce(queryResult([{ id: "c1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ userId: "u1" }, { userId: "u2" }]))
      .mockReturnValueOnce(queryResult([opts.session ?? parent]))
      .mockReturnValueOnce(
        queryResult(opts.reveals.map((userId) => ({ userId }))),
      )
      .mockReturnValueOnce(queryResult(opts.prompt ? [opts.prompt] : []))
      .mockReturnValueOnce(queryResult(opts.existing ? [opts.existing] : []));
    return { db, tx };
  }

  async function service(db: unknown) {
    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: db },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();
    return module.get(ConversationsService);
  }

  const followUpPrompt = {
    id: "f1",
    kind: "follow_up",
    parentPromptId: "p1",
    retiredAt: null,
  };

  it("is locked until both partners have revealed", async () => {
    const { db } = setup({ reveals: ["u1"] });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).rejects.toMatchObject({ response: { reason: "follow_ups_locked" } });
  });

  it("rejects a follow-up of a follow-up", async () => {
    const { db } = setup({
      reveals: [],
      session: { ...parent, parentSessionId: "x" },
    });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).rejects.toMatchObject({ response: { reason: "follow_up_of_follow_up" } });
  });

  it("rejects a prompt that doesn't belong to this session's prompt", async () => {
    const { db } = setup({ reveals: ["u1", "u2"] });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "other" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the existing child instead of creating a second one", async () => {
    const { db } = setup({
      reveals: ["u1", "u2"],
      prompt: followUpPrompt,
      existing: { id: "child-0" },
    });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).resolves.toEqual({ id: "child-0" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("creates the child with a response row per member", async () => {
    const { db, tx } = setup({ reveals: ["u1", "u2"], prompt: followUpPrompt });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).resolves.toEqual({ id: "child-1" });
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });
});
```

Also add one case to the existing `submitResponse notifications` describe: with `parentSessionId: "s0"`
on the session row, `notifyNewConversation` is **not** called.

---

## Step 5 · Web

### `apps/web/hooks/use-sessions.ts` (change)

**Before**

```ts
export type SessionDetailDto = {
  id: string;
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: "curated";
  };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: Array<{
    userId: string;
    displayName: string;
    submitted: boolean;
    text: string | null;
  }>;
};
```

**After**

```ts
export type SessionResponse = {
  userId: string;
  displayName: string;
  submitted: boolean;
  text: string | null;
};

/** One follow-up under a revealed main session (Q22: never `ready_to_reveal`). */
export type FollowUp = {
  promptId: string;
  text: string;
  sessionId: string | null;
  phase: SessionViewerPhase | null;
  responses: SessionResponse[];
};

export type SessionDetailDto = {
  id: string;
  parentSessionId: string | null;
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: "curated" | "follow_up";
  };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: SessionResponse[];
  /** Only once both have revealed. */
  followUps?: FollowUp[];
};
```

**Polling, before**

```ts
    refetchInterval: (query) =>
      query.state.data?.phase === "waiting_for_partner"
        ? WAITING_POLL_MS
        : false,
```

**After**

```ts
    // Also poll while a follow-up is waiting on the partner.
    refetchInterval: (query) => {
      const data = query.state.data;
      const waiting =
        data?.phase === "waiting_for_partner" ||
        data?.followUps?.some((f) => f.phase === "waiting_for_partner");
      return waiting ? WAITING_POLL_MS : false;
    },
```

Update the `@remarks` above it to mention follow-ups.

**Add after `useRevealSessionMutation`**

```ts
export function useStartFollowUpMutation(
  options?: UseMutationOptions<
    CreateSessionResponse,
    Error,
    { parentSessionId: string; promptId: string }
  >,
) {
  return useMutation({
    ...options,
    mutationFn: ({ parentSessionId, promptId }) =>
      apiFetch<CreateSessionResponse>(
        `/sessions/${parentSessionId}/follow-ups`,
        { method: "POST", body: JSON.stringify({ promptId }) },
      ),
  });
}
```

Submitting a child reuses `useSubmitResponseMutation`. Its `invalidateQueries({ queryKey: ["sessions"] })`
is a prefix match, so the parent `["sessions", parentId]` refetches and the card updates.

### `apps/web/components/molecules/take-it-offline/take-it-offline.tsx` (new, FR-22)

```tsx
import { CoffeeIcon } from "lucide-react";

export function TakeItOffline() {
  return (
    <section className="flex items-start gap-4 rounded-lg bg-accent-soft p-5">
      <CoffeeIcon
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-accent-foreground"
      />
      <div>
        <h3 className="font-semibold">Keep talking in person</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The best follow-up might be over dinner or a walk. There&apos;s no
          need to answer anything else here.
        </p>
      </div>
    </section>
  );
}
```

### `apps/web/components/organisms/follow-up-card/follow-up-card.tsx` (new, presentational)

```tsx
"use client";

import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  submitAnswerSchema,
  type SessionViewerPhase,
  type SubmitAnswerInput,
} from "@couple-space/domain";
import type { SessionResponse } from "@/hooks/use-sessions";
import { AnswerCard } from "@/components/molecules/answer-card/answer-card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type FollowUpCardProps = {
  question: string;
  /** Null until either partner starts it. */
  phase: SessionViewerPhase | null;
  responses: SessionResponse[];
  viewerId: string;
  partnerName: string;
  isSubmitting: boolean;
  errorMessage?: string;
  /** Called with the validated, trimmed answer. */
  onSubmit: (text: string) => void;
};

/**
 * One optional follow-up under the revealed answers.
 *
 * @remarks
 * No Reveal step (Q22): once both have submitted, the API returns both
 * texts and the card shows them.
 */
export function FollowUpCard({
  question,
  phase,
  responses,
  viewerId,
  partnerName,
  isSubmitting,
  errorMessage,
  onSubmit,
}: Readonly<FollowUpCardProps>) {
  const form = useForm<SubmitAnswerInput>({
    resolver: zodResolver(submitAnswerSchema),
    defaultValues: { text: "" },
  });
  const { errors } = form.formState;
  const fieldId = useId();

  const answerForm = (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={form.handleSubmit(({ text }) => onSubmit(text))}
    >
      <Field data-invalid={!!errors.text || undefined}>
        <FieldLabel htmlFor={fieldId} className="sr-only">
          Your answer to: {question}
        </FieldLabel>
        <Textarea
          id={fieldId}
          placeholder="Your private answer"
          readOnly={isSubmitting}
          aria-invalid={!!errors.text || undefined}
          className="min-h-28 resize-none rounded-lg bg-background p-4 text-sm md:text-sm"
          {...form.register("text")}
        />
        <FieldError>{errors.text?.message}</FieldError>
      </Field>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Submit answer"}
      </Button>
    </form>
  );

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
      ) : phase === "answering" ? (
        // Partner already started it: no need to hide the form.
        answerForm
      ) : (
        <Collapsible>
          <CollapsibleTrigger
            render={<Button variant="outline" className="self-start" />}
          >
            Answer this
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">{answerForm}</CollapsibleContent>
        </Collapsible>
      )}
    </article>
  );
}
```

`useId` gives each card's textarea a unique id for its label. It's not state.

### `apps/web/components/organisms/follow-up-list/follow-up-list.tsx` (new, owns mutations)

```tsx
"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  sessionQueryKey,
  useStartFollowUpMutation,
  useSubmitResponseMutation,
  type FollowUp,
} from "@/hooks/use-sessions";
import { apiErrorReason } from "@/lib/api/api-error";
import { FollowUpCard } from "@/components/organisms/follow-up-card/follow-up-card";
import { TakeItOffline } from "@/components/molecules/take-it-offline/take-it-offline";

type FollowUpListProps = {
  parentSessionId: string;
  followUps: FollowUp[];
  viewerId: string;
  partnerName: string;
};

export function FollowUpList({
  parentSessionId,
  followUps,
  viewerId,
  partnerName,
}: Readonly<FollowUpListProps>) {
  // A question can ship without follow-ups (Q27): show only the offline card.
  if (followUps.length === 0) return <TakeItOffline />;

  return (
    <section
      aria-labelledby="follow-ups-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="follow-ups-heading" className="text-2xl">
        Keep exploring (optional)
      </h2>
      {followUps.map((followUp) => (
        <FollowUpItem
          key={followUp.promptId}
          parentSessionId={parentSessionId}
          followUp={followUp}
          viewerId={viewerId}
          partnerName={partnerName}
        />
      ))}
      <TakeItOffline />
    </section>
  );
}

type FollowUpItemProps = {
  parentSessionId: string;
  followUp: FollowUp;
  viewerId: string;
  partnerName: string;
};

/** One card's mutations, so pending/error state stays on the card you used. */
function FollowUpItem({
  parentSessionId,
  followUp,
  viewerId,
  partnerName,
}: Readonly<FollowUpItemProps>) {
  const client = useQueryClient();
  const start = useStartFollowUpMutation();
  const submit = useSubmitResponseMutation({
    onError: (error) => {
      if (apiErrorReason(error) === "already_submitted") {
        void client.invalidateQueries({
          queryKey: sessionQueryKey(parentSessionId),
        });
      }
    },
  });

  return (
    <FollowUpCard
      question={followUp.text}
      phase={followUp.phase}
      responses={followUp.responses}
      viewerId={viewerId}
      partnerName={partnerName}
      isSubmitting={start.isPending || submit.isPending}
      errorMessage={
        start.isError || submit.isError
          ? "Your answer didn't send. Your text is still here - try again"
          : undefined
      }
      onSubmit={(text) => {
        if (followUp.sessionId) {
          submit.mutate({ sessionId: followUp.sessionId, text });
          return;
        }
        // Start the child lazily, then submit into it.
        start.mutate(
          { parentSessionId, promptId: followUp.promptId },
          { onSuccess: ({ id }) => submit.mutate({ sessionId: id, text }) },
        );
      }}
    />
  );
}
```

The error copy matches `submissionErrorMessage` on the conversation page.

### `apps/web/app/(app)/conversation/[id]/page.tsx` (change)

(Use your real path. The page lives under `(app)/conversation/`.)

**Before**

```tsx
import { SessionRevealPanel } from "@/components/organisms/session-reveal-panel/session-reveal-panel";
```

**After**

```tsx
import { SessionRevealPanel } from "@/components/organisms/session-reveal-panel/session-reveal-panel";
import { FollowUpList } from "@/components/organisms/follow-up-list/follow-up-list";
```

**Before**

```tsx
{
  data.phase === "revealed" && (
    <SessionRevealPanel responses={data.responses} viewerId={me.data.id} />
  );
}
```

**After**

```tsx
{
  data.phase === "revealed" && (
    <SessionRevealPanel responses={data.responses} viewerId={me.data.id} />
  );
}
{
  data.phase === "revealed" && data.followUps ? (
    <FollowUpList
      parentSessionId={data.id}
      followUps={data.followUps}
      viewerId={me.data.id}
      partnerName={partnerName}
    />
  ) : null;
}
```

While only the viewer has revealed, `followUps` is absent, so the list doesn't render. When the partner
reveals, the next refetch (window focus) brings it in. Optional: also poll while
`phase === "revealed" && !followUps`, so it appears without a focus change. That's an extra request
every 20s on every fully-revealed page that has no follow-ups, so I left it out.

---

## Verification

1. `pnpm --filter @couple-space/database generate`, read the SQL, then `migrate` and `seed` → `seeded 6 themes, 54 prompts, 6 tags`.
2. `pnpm check-types && pnpm test`.
3. With the two test-couple browsers:
   - Answer and reveal a main prompt in A only → no follow-ups in A.
   - Reveal in B → follow-ups show in both (A after focus).
   - A answers follow-up 1 → A sees "waiting"; B's card shows the form straight away (`phase: answering`).
   - B answers → both see both answers within 20s, **with no reveal button**.
   - Both tap "Answer this" on follow-up 2 at the same moment → one child row in `conversation_sessions`.
4. `GET /sessions` (hub) still lists only main sessions.
5. `curl -X POST /sessions/<childId>/reveal` → 400 `follow_up_has_no_reveal`.
6. `curl -X POST /sessions/<mainId>/follow-ups` before both revealed → 403 `follow_ups_locked`.
