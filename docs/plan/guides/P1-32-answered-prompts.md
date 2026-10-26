# P1-32 · Answered prompts don't come back

[← Phase 1](../board.md) · Size **S–M** · Gate A · Decision: [Q25](../../product/decisions.md#q25) (amended 2026-10-26) · After: [P1-6](P1-6-session-completion.md) · Next: [P1-19](../board.md)

**Builds on P1-30's first slice** (filters in the URL), **P1-6** and **H-16** (web tests).

**Goal:** once a couple has answered a prompt (both submitted in a main session), it's never started
again. Without this, a finished prompt is still on `/start`, tapping it starts a second session, and the
same question shows up twice on the hub. This is the slice of Q25 needed for Gate A; skip for now,
Random and "Explored" on the theme list stay in P1-29 / P1-30.

**Done when:**

- `answeredSessionId` is a pure domain function with tests.
- `POST /sessions` on an answered prompt returns `409 { reason: "prompt_already_answered" }`. An **open**
  session on it is still reused first (P0-7), so both-submitted-but-not-revealed keeps working.
- `GET /themes` gives each prompt `answeredSessionId` (`null` until answered), with API tests.
- `/start/[slug]` hides answered prompts by default. A **"Show talked about"** chip (in the URL as
  `?talked=1`) shows them with a "Talked about" badge; tapping one **opens the old conversation**.
- A theme where everything is answered shows "You've explored everything here. New questions arrive
  regularly." with a link to show what you talked about.
- Web tests for the filter changes.

### Notes

- **"Answered" isn't "completed".** Answered = both submitted (Q25), whether or not they've revealed or
  finished follow-ups. A prompt can be answered while its session is still `in_progress` (ready to
  reveal) or `in_discussion`.
- **Only main sessions count.** Follow-ups never make a prompt answered (Q25).
- **Order in `createSession`:** reuse an open session → refuse an answered prompt → refuse a retired one.
  The answered check needs one extra query, and only when the couple already has a session on the prompt.
- **`GET /themes` without a couple.** `/start` doesn't require a couple, and `listThemes` must not 404, so
  the lookup is a small soft helper (`answeredSessionsByPrompt`) rather than `requireMembership`, which
  throws. That's a deliberate second membership query, not a new pattern; say if you'd rather refactor
  `requireMembership` into a "find" and a "require" pair.
- **Several answered sessions on one prompt** can exist from before this task. The newest one opens.
- **The answered card is a `<Link>`, not a button.** It navigates rather than acts, so it's a link for
  keyboard and screen-reader users. That's why `PromptCard` now has two branches sharing one body.
- **Not in this slice:** the "N questions" count on `/start` theme cards still counts every prompt, and
  themes aren't greyed out as "Explored". Both are P1-30 proper (Q24).
- **The 409 is a safety net.** The web never hits it in normal use, because answered prompts aren't
  buttons. A stale tab gets the existing "Couldn't start that conversation" message.

Checked on a scratch copy of `main` @ `11e738c` with H-16 and P1-6 applied: domain 87, API 77 and web 21
tests pass; `check-types` and `lint` clean; formatted with the repo's `.prettierrc`.

---

## Step 1 · Domain

### `packages/domain/src/prompts/prompt-answered.ts` (new)
```ts
export type AnsweredSessionInput = {
  memberIds: string[];
  /**
   * The couple's main sessions on one prompt, in the order to prefer (newest
   * first). Follow-ups never count (Q25).
   */
  sessions: Array<{
    id: string;
    /** Who has submitted an answer to this session's main prompt. */
    submittedUserIds: string[];
  }>;
};

/**
 * Finds the session in which the couple answered a prompt, if they have.
 *
 * @remarks
 * Q25: a prompt is answered once **every** member has submitted in one of
 * the couple's main sessions on it, whether or not they've revealed. An
 * answered prompt is never offered or started again; the web opens this
 * session instead.
 *
 * @param input - The couple's members and their main sessions on the prompt
 * @returns The first answered session's id, or `null` if none is answered
 */
export function answeredSessionId(input: AnsweredSessionInput): string | null {
  if (input.memberIds.length === 0) return null;
  const answered = input.sessions.find((session) =>
    input.memberIds.every((id) => session.submittedUserIds.includes(id)),
  );
  return answered?.id ?? null;
}
```

### `packages/domain/src/prompts/prompt-answered.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { answeredSessionId } from "./prompt-answered.js";

const members = ["u1", "u2"];

describe("answeredSessionId", () => {
  it("is null when the couple has no session on the prompt", () => {
    expect(answeredSessionId({ memberIds: members, sessions: [] })).toBeNull();
  });

  it("is null while only one partner has submitted", () => {
    expect(
      answeredSessionId({
        memberIds: members,
        sessions: [{ id: "s1", submittedUserIds: ["u1"] }],
      }),
    ).toBeNull();
  });

  it("is the session once both have submitted, revealed or not", () => {
    expect(
      answeredSessionId({
        memberIds: members,
        sessions: [{ id: "s1", submittedUserIds: ["u2", "u1"] }],
      }),
    ).toBe("s1");
  });

  it("prefers the first answered session in the order given", () => {
    expect(
      answeredSessionId({
        memberIds: members,
        sessions: [
          { id: "open", submittedUserIds: ["u1"] },
          { id: "newer", submittedUserIds: ["u1", "u2"] },
          { id: "older", submittedUserIds: ["u1", "u2"] },
        ],
      }),
    ).toBe("newer");
  });

  it("is never answered for a couple with no members", () => {
    expect(
      answeredSessionId({
        memberIds: [],
        sessions: [{ id: "s1", submittedUserIds: [] }],
      }),
    ).toBeNull();
  });
});
```

### `packages/domain/src/index.ts` (change)
**Before**
```ts
export * from "./prompts/prompt-depth.js";
```
**After**
```ts
export * from "./prompts/prompt-depth.js";
export * from "./prompts/prompt-answered.js";
```

---

## Step 2 · API

### `apps/api/src/conversations/conversations.service.ts` (change)

**Imports, before** (after P1-6)
```ts
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  areFollowUpsUnlocked,
```
**After**
```ts
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";
import {
  answeredSessionId,
  areFollowUpsUnlocked,
```

**`listThemes`, before**
```ts
  async listThemes(_user: AuthUser) {
```
**After**
```ts
  async listThemes(user: AuthUser) {
```
**Before**
```ts
      .orderBy(asc(promptTags.sortOrder));

    return {
```
**After**
```ts
      .orderBy(asc(promptTags.sortOrder));

    const answered = await this.answeredSessionsByPrompt(user);

    return {
```
**Before**
```ts
            tags: tagsByPrompt.get(p.id) ?? [],
          })),
```
**After**
```ts
            tags: tagsByPrompt.get(p.id) ?? [],
            // Q25: set once the couple has answered it; the web opens this session.
            answeredSessionId: answered.get(p.id) ?? null,
          })),
```

**`createSession`, before**
```ts
      if (open) return { id: open.id };
    }
```
**After**
```ts
      if (open) return { id: open.id };

      // Q25: an answered prompt is never started again.
      const submitted = await this.db
        .select({
          sessionId: sessionResponses.sessionId,
          userId: sessionResponses.userId,
        })
        .from(sessionResponses)
        .where(
          and(
            inArray(
              sessionResponses.sessionId,
              samePrompt.map((session) => session.id),
            ),
            isNotNull(sessionResponses.submittedAt),
          ),
        );
      const answered = answeredSessionId({
        memberIds: ctx.memberIds,
        sessions: samePrompt.map((session) => ({
          id: session.id,
          submittedUserIds: submitted
            .filter((r) => r.sessionId === session.id)
            .map((r) => r.userId),
        })),
      });
      if (answered) {
        throw new ConflictException({ reason: "prompt_already_answered" });
      }
    }
```

**New private helper, add just above `requireMembership`**
```ts
  /**
   * The couple's answered prompts, each with the session to open.
   *
   * @remarks
   * Q25. Soft on membership: `/start` is reachable before a couple exists,
   * so a user without an active couple gets an empty map instead of a 404.
   * Only main sessions count; follow-ups never do.
   *
   * @param user - The signed-in user
   * @returns Prompt id → newest answered session id
   */
  private async answeredSessionsByPrompt(
    user: AuthUser,
  ): Promise<Map<string, string>> {
    const answered = new Map<string, string>();

    const [membership] = await this.db
      .select({ coupleId: coupleMemberships.coupleId })
      .from(coupleMemberships)
      .where(
        and(
          eq(coupleMemberships.userId, user.id),
          eq(coupleMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (!membership) return answered;

    const members = await this.db
      .select({ userId: coupleMemberships.userId })
      .from(coupleMemberships)
      .where(
        and(
          eq(coupleMemberships.coupleId, membership.coupleId),
          eq(coupleMemberships.status, "active"),
        ),
      );

    const sessions = await this.db
      .select({
        id: conversationSessions.id,
        promptId: conversationSessions.promptId,
      })
      .from(conversationSessions)
      .where(
        and(
          eq(conversationSessions.coupleId, membership.coupleId),
          isNull(conversationSessions.parentSessionId),
        ),
      )
      .orderBy(desc(conversationSessions.createdAt));
    if (sessions.length === 0) return answered;

    const submitted = await this.db
      .select({
        sessionId: sessionResponses.sessionId,
        userId: sessionResponses.userId,
      })
      .from(sessionResponses)
      .where(
        and(
          inArray(
            sessionResponses.sessionId,
            sessions.map((s) => s.id),
          ),
          isNotNull(sessionResponses.submittedAt),
        ),
      );

    const memberIds = members.map((m) => m.userId);
    for (const promptId of new Set(sessions.map((s) => s.promptId))) {
      const id = answeredSessionId({
        memberIds,
        sessions: sessions
          .filter((s) => s.promptId === promptId)
          .map((s) => ({
            id: s.id,
            submittedUserIds: submitted
              .filter((r) => r.sessionId === s.id)
              .map((r) => r.userId),
          })),
      });
      if (id) answered.set(promptId, id);
    }
    return answered;
  }
```

### `apps/api/src/conversations/conversations.service.test.ts` (change)

**`listThemes` › "returns each prompt's depth …": one more select (no couple yet). Before**
```ts
      .mockReturnValueOnce(
        queryResult([
          { slug: "playful", label: "Playful" },
          { slug: "thoughtful", label: "Thoughtful" },
        ]),
      );

    const result = await (await serviceWith(db)).listThemes(user);
```
**After**
```ts
      .mockReturnValueOnce(
        queryResult([
          { slug: "playful", label: "Playful" },
          { slug: "thoughtful", label: "Thoughtful" },
        ]),
      )
      // P1-32: no couple yet, so nothing is answered.
      .mockReturnValueOnce(queryResult([]));

    const result = await (await serviceWith(db)).listThemes(user);
```
**"skips the links query when there are no prompts": replace the whole test, and add the new tests
after it** (the last `});` closes the `listThemes` block; the `createSession` block follows it)
```ts
  it("skips the links query when there are no prompts", async () => {
    const db = { select: vi.fn() };
    db.select
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([]))
      // P1-32: no couple yet.
      .mockReturnValueOnce(queryResult([]));

    const result = await (await serviceWith(db)).listThemes(user);

    expect(db.select).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ tags: [], themes: [] });
  });

  describe("answered prompts (P1-32)", () => {
    const theme = {
      id: "t1",
      slug: "s",
      title: "T",
      description: "d",
      symbol: "feather",
    };
    const prompt = (id: string) => ({
      id,
      themeId: "t1",
      title: id,
      description: "d",
      text: id,
      depth: "light",
    });

    /**
     * Mocks `listThemes` for a couple with sessions.
     *
     * @remarks
     * Catalogue selects first (themes, prompts, links, tags), then
     * `answeredSessionsByPrompt` (membership, members, sessions, submitted).
     *
     * @param sessions - The couple's main sessions, newest first
     * @param submitted - Submitted responses on those sessions
     * @returns A fake `Db` with `select` mocked
     */
    function setup(
      sessions: Array<{ id: string; promptId: string }>,
      submitted: Array<{ sessionId: string; userId: string }>,
    ) {
      const db = { select: vi.fn() };
      db.select
        .mockReturnValueOnce(queryResult([theme]))
        .mockReturnValueOnce(queryResult([prompt("p1"), prompt("p2")]))
        .mockReturnValueOnce(queryResult([]))
        .mockReturnValueOnce(queryResult([]))
        .mockReturnValueOnce(queryResult([{ coupleId: "c1" }]))
        .mockReturnValueOnce(queryResult([{ userId: "u1" }, { userId: "u2" }]))
        .mockReturnValueOnce(queryResult(sessions))
        .mockReturnValueOnce(queryResult(submitted));
      return db;
    }

    it("marks a prompt both partners submitted with the session to open", async () => {
      const db = setup(
        [
          { id: "s2", promptId: "p2" },
          { id: "s1", promptId: "p1" },
        ],
        [
          { sessionId: "s1", userId: "u1" },
          { sessionId: "s1", userId: "u2" },
          { sessionId: "s2", userId: "u1" },
        ],
      );

      const result = await (await serviceWith(db)).listThemes(user);

      expect(result.themes[0]!.prompts).toEqual([
        expect.objectContaining({ id: "p1", answeredSessionId: "s1" }),
        // Only one partner has submitted: still offered.
        expect.objectContaining({ id: "p2", answeredSessionId: null }),
      ]);
    });

    it("skips the responses query when the couple has no sessions", async () => {
      const db = setup([], []);

      const result = await (await serviceWith(db)).listThemes(user);

      expect(db.select).toHaveBeenCalledTimes(7);
      expect(result.themes[0]!.prompts[0]).toMatchObject({
        answeredSessionId: null,
      });
    });
  });
});

describe("ConversationsService.createSession on an answered prompt (P1-32)", () => {
  const user = { id: "u1", email: "a@example.com", emailVerified: true };
  const curated = { id: "p1", kind: "curated", retiredAt: null };

  /**
   * Mocks `createSession` up to the answered check.
   *
   * @remarks
   * `requireMembership` (3 selects), the prompt, sessions on the same
   * prompt, their reveals, then their submitted responses.
   *
   * @param reveals - Who has revealed `s1`
   * @param submitted - Who has submitted in `s1`
   * @returns A fake `Db` with `select` mocked
   */
  function setup(reveals: string[], submitted: string[]) {
    const db = { select: vi.fn(), transaction: vi.fn() };
    db.select
      .mockReturnValueOnce(
        queryResult([{ coupleId: "c1", userId: "u1", status: "active" }]),
      )
      .mockReturnValueOnce(queryResult([{ id: "c1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ userId: "u1" }, { userId: "u2" }]))
      .mockReturnValueOnce(queryResult([curated]))
      .mockReturnValueOnce(queryResult([{ id: "s1" }]))
      .mockReturnValueOnce(
        queryResult(reveals.map((userId) => ({ sessionId: "s1", userId }))),
      )
      .mockReturnValueOnce(
        queryResult(submitted.map((userId) => ({ sessionId: "s1", userId }))),
      );
    return db;
  }

  async function serviceWith(db: unknown) {
    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: db },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();
    return module.get(ConversationsService);
  }

  it("refuses a prompt both partners answered and revealed", async () => {
    const db = setup(["u1", "u2"], ["u1", "u2"]);

    await expect(
      (await serviceWith(db)).createSession(user, { promptId: "p1" }),
    ).rejects.toMatchObject({
      response: { reason: "prompt_already_answered" },
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("still reuses the open session when both answered but haven't revealed", async () => {
    const db = setup([], ["u1", "u2"]);

    await expect(
      (await serviceWith(db)).createSession(user, { promptId: "p1" }),
    ).resolves.toEqual({ id: "s1" });
    expect(db.select).toHaveBeenCalledTimes(6);
  });
});```

---

## Step 3 · Web

### `apps/web/hooks/use-themes.ts` (change)
**Before**
```ts
  /** Tag slugs; labels are in {@link ThemesResponse} `tags`. */
  tags: string[];
};
```
**After**
```ts
  /** Tag slugs; labels are in {@link ThemesResponse} `tags`. */
  tags: string[];
  /** Set once the couple has answered it (Q25): open this, never start a new one. */
  answeredSessionId: string | null;
};
```

### `apps/web/lib/prompt-filters.ts` (change)
**`PromptFilters`, before**
```ts
  /** Selected tag slugs. A prompt matches if it has any of them. */
  tags: string[];
```
**After**
```ts
  /** Selected tag slugs. A prompt matches if it has any of them. */
  tags: string[];
  /** Also show prompts the couple has answered (Q25 hides them by default). */
  talkedAbout: boolean;
```
**`readPromptFilters`, before**
```ts
    tags: params.getAll("tag").filter((tag) => knownTags.includes(tag)),
```
**After**
```ts
    tags: params.getAll("tag").filter((tag) => knownTags.includes(tag)),
    talkedAbout: params.get("talked") === "1",
```
**`filterPrompts`, before**
```ts
/**
 * Keeps the prompts that match the filters.
 *
 * @param prompts - A theme's prompts
 * @param filters - From {@link readPromptFilters}
 * @returns A new array, in the original order
 */
export function filterPrompts<T extends { depth: PromptDepth; tags: string[] }>(
  prompts: T[],
  filters: Pick<PromptFilters, "depth" | "tags">,
): T[] {
  return prompts.filter(
    (prompt) =>
      (!filters.depth || prompt.depth === filters.depth) &&
```
**After**
```ts
/**
 * Keeps the prompts that match the filters.
 *
 * @remarks
 * Answered prompts are left out unless `talkedAbout` is on (Q25, P1-32).
 *
 * @param prompts - A theme's prompts
 * @param filters - From {@link readPromptFilters}
 * @returns A new array, in the original order
 */
export function filterPrompts<
  T extends {
    depth: PromptDepth;
    tags: string[];
    answeredSessionId: string | null;
  },
>(
  prompts: T[],
  filters: Pick<PromptFilters, "depth" | "tags" | "talkedAbout">,
): T[] {
  return prompts.filter(
    (prompt) =>
      (filters.talkedAbout || prompt.answeredSessionId === null) &&
      (!filters.depth || prompt.depth === filters.depth) &&
```
**`promptFiltersHref`, before**
```ts
  for (const tag of filters.tags) params.append("tag", tag);
```
**After**
```ts
  for (const tag of filters.tags) params.append("tag", tag);
  if (filters.talkedAbout) params.set("talked", "1");
```
**Add at the end**
```ts
/**
 * Shows or hides the prompts the couple has answered.
 *
 * @remarks Changing a filter resets "show", so the list starts from the top.
 *
 * @param filters - The current filters
 * @returns The next filters
 */
export function toggleTalkedAbout(filters: PromptFilters): PromptFilters {
  return {
    ...filters,
    talkedAbout: !filters.talkedAbout,
    show: PROMPT_PAGE_SIZE,
  };
}
```

### `apps/web/lib/prompt-filters.test.ts` (replace the whole file from H-16)
```ts
import { describe, expect, it } from "vitest";
import {
  filterPrompts,
  PROMPT_PAGE_SIZE,
  promptFiltersHref,
  readPromptFilters,
  toggleDepth,
  toggleTag,
  toggleTalkedAbout,
  type PromptFilters,
} from "./prompt-filters";

const none: PromptFilters = {
  depth: null,
  tags: [],
  talkedAbout: false,
  show: PROMPT_PAGE_SIZE,
};

describe("readPromptFilters", () => {
  it("reads depth, known tags, talked about and show", () => {
    const params = new URLSearchParams(
      "depth=deep&tag=playful&tag=nope&talked=1&show=12",
    );

    expect(readPromptFilters(params, ["playful", "romantic"])).toEqual({
      depth: "deep",
      tags: ["playful"],
      talkedAbout: true,
      show: 12,
    });
  });

  it("ignores an unknown depth, a bad show and any other talked value", () => {
    const params = new URLSearchParams("depth=very&show=abc&talked=yes");

    expect(readPromptFilters(params, [])).toEqual(none);
  });

  it("never shows fewer than one page", () => {
    expect(readPromptFilters(new URLSearchParams("show=2"), []).show).toBe(
      PROMPT_PAGE_SIZE,
    );
  });
});

describe("filterPrompts", () => {
  const prompts = [
    {
      id: "a",
      depth: "light" as const,
      tags: ["playful"],
      answeredSessionId: null,
    },
    {
      id: "b",
      depth: "deep" as const,
      tags: ["romantic"],
      answeredSessionId: null,
    },
    { id: "c", depth: "deep" as const, tags: [], answeredSessionId: null },
    {
      id: "done",
      depth: "light" as const,
      tags: ["playful"],
      answeredSessionId: "s1",
    },
  ];

  it("hides answered prompts with no filters (Q25)", () => {
    expect(filterPrompts(prompts, none).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("shows answered prompts too when talked about is on", () => {
    expect(
      filterPrompts(prompts, { ...none, talkedAbout: true }).map((p) => p.id),
    ).toEqual(["a", "b", "c", "done"]);
  });

  it("matches one depth", () => {
    expect(
      filterPrompts(prompts, { ...none, depth: "deep" }).map((p) => p.id),
    ).toEqual(["b", "c"]);
  });

  it("matches any selected tag", () => {
    expect(
      filterPrompts(prompts, { ...none, tags: ["playful", "romantic"] }).map(
        (p) => p.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("combines talked about with the other filters", () => {
    expect(
      filterPrompts(prompts, {
        depth: "light",
        tags: ["playful"],
        talkedAbout: true,
      }).map((p) => p.id),
    ).toEqual(["a", "done"]);
  });
});

describe("promptFiltersHref", () => {
  it("is just the pathname with no filters", () => {
    expect(promptFiltersHref("/start/x", none)).toBe("/start/x");
  });

  it("encodes depth, tags, talked about and show", () => {
    expect(
      promptFiltersHref("/start/x", {
        depth: "light",
        tags: ["a", "b"],
        talkedAbout: true,
        show: 12,
      }),
    ).toBe("/start/x?depth=light&tag=a&tag=b&talked=1&show=12");
  });
});

describe("toggleDepth, toggleTag and toggleTalkedAbout", () => {
  it("selects, then clears, a depth and resets show", () => {
    const on = toggleDepth({ ...none, show: 18 }, "medium");
    expect(on).toEqual({ ...none, depth: "medium" });
    expect(toggleDepth(on, "medium").depth).toBeNull();
  });

  it("adds, then removes, a tag and resets show", () => {
    const on = toggleTag({ ...none, show: 18 }, "playful");
    expect(on).toEqual({ ...none, tags: ["playful"] });
    expect(toggleTag(on, "playful").tags).toEqual([]);
  });

  it("turns talked about on, then off, and resets show", () => {
    const on = toggleTalkedAbout({ ...none, show: 18 });
    expect(on).toEqual({ ...none, talkedAbout: true });
    expect(toggleTalkedAbout(on).talkedAbout).toBe(false);
  });
});
```

### `apps/web/components/molecules/prompt-filters/prompt-filters.tsx` (change)
**Before**
```tsx
  toggleDepth,
  toggleTag,
  type PromptFilters as Filters,
```
**After**
```tsx
  toggleDepth,
  toggleTag,
  toggleTalkedAbout,
  type PromptFilters as Filters,
```
**Before**
```tsx
 * Depth and tag chips for a theme's questions.
```
**After**
```tsx
 * Depth, tag and "Show talked about" chips for a theme's questions.
```
**Before**
```tsx
  const anySelected = filters.depth !== null || filters.tags.length > 0;
```
**After**
```tsx
  const anySelected =
    filters.depth !== null || filters.tags.length > 0 || filters.talkedAbout;
```
**Before**
```tsx
          label={tag.label}
        />
      ))}
      {anySelected ? (
        <Link
          href={promptFiltersHref(pathname, {
            depth: null,
            tags: [],
            show: PROMPT_PAGE_SIZE,
          })}
```
**After**
```tsx
          label={tag.label}
        />
      ))}
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
      <FilterChip
        href={promptFiltersHref(pathname, toggleTalkedAbout(filters))}
        selected={filters.talkedAbout}
        label="Show talked about"
      />
      {anySelected ? (
        <Link
          href={promptFiltersHref(pathname, {
            depth: null,
            tags: [],
            talkedAbout: false,
            show: PROMPT_PAGE_SIZE,
          })}
```

### `apps/web/components/molecules/prompt-card/prompt-card.tsx` (replace whole file)
```tsx
import Link from "next/link";
import { PROMPT_DEPTH_LABELS } from "@couple-space/domain";
import type { ThemePrompt } from "@/hooks/use-themes";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";

type PromptCardProps = {
  prompt: ThemePrompt;
  onSelect: (promptId: string) => void;
  disabled?: boolean;
  className?: string;
};

const cardClassName = cn(
  "group flex h-full flex-col justify-between gap-6 rounded-lg bg-card p-5 text-left text-card-foreground ring-1 ring-foreground/10 transition-all outline-none",
  "hover:ring-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
);

/**
 * One question on a theme page.
 *
 * @remarks
 * An unanswered prompt is a button that starts the conversation. One the
 * couple has answered (Q25, P1-32) is a link to that conversation instead,
 * so it can never be started twice.
 */
export function PromptCard({
  prompt,
  onSelect,
  disabled,
  className,
}: Readonly<PromptCardProps>) {
  if (prompt.answeredSessionId) {
    return (
      <Link
        href={`/conversation/${prompt.answeredSessionId}`}
        className={cn(cardClassName, className)}
      >
        <PromptCardBody
          prompt={prompt}
          action="See what you said"
          talkedAbout
        />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(prompt.id)}
      disabled={disabled}
      className={cn(
        cardClassName,
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <PromptCardBody prompt={prompt} action="Start this conversation" />
    </button>
  );
}

type PromptCardBodyProps = {
  prompt: ThemePrompt;
  /** The call to action on the right. */
  action: string;
  /** Adds the "Talked about" badge. */
  talkedAbout?: boolean;
};

function PromptCardBody({
  prompt,
  action,
  talkedAbout,
}: Readonly<PromptCardBodyProps>) {
  return (
    <>
      <span className="line-clamp-4 text-base leading-relaxed">
        {prompt.text}
      </span>
      <span className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-foreground">
            {PROMPT_DEPTH_LABELS[prompt.depth]}
          </span>
          {talkedAbout ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Talked about
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
          {action}
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </>
  );
}
```

### `apps/web/app/(app)/start/[slug]/page.tsx` (change)
**Before**
```tsx
  promptFiltersHref,
  readPromptFilters,
} from "@/lib/prompt-filters";
```
**After**
```tsx
  promptFiltersHref,
  readPromptFilters,
  toggleTalkedAbout,
} from "@/lib/prompt-filters";
```
**Before**
```tsx
  const remaining = matching.length - shown.length;
```
**After**
```tsx
  const remaining = matching.length - shown.length;
  // Q25 empty state: everything here is answered and answered ones are hidden.
  const explored =
    !filters.talkedAbout &&
    theme.prompts.length > 0 &&
    theme.prompts.every((prompt) => prompt.answeredSessionId !== null);
```
**Before**
```tsx
      {matching.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-8 text-center">
```
**After**
```tsx
      {explored ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-8 text-center">
          <p>
            You&apos;ve explored everything here. New questions arrive
            regularly.
          </p>
          <Link
            href={promptFiltersHref(pathname, toggleTalkedAbout(filters))}
            scroll={false}
            className="text-sm underline underline-offset-4"
          >
            See what you talked about
          </Link>
        </div>
      ) : matching.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-8 text-center">
```
The rest of the page doesn't change: `PromptCard` decides between starting and opening.

---

## Verification
1. `pnpm check-types && pnpm lint && pnpm test`.
2. Both answer a prompt (no need to reveal) → back on its theme page, it's gone; "Showing X of Y" drops by one.
3. Tap **Show talked about** → it's back with a "Talked about" badge and "See what you said"; the URL has
   `?talked=1`. Tap it → the old conversation opens; no new session on the hub.
4. Only one of you has answered → it's still listed, and tapping it opens the same open session (P0-7).
5. `curl -X POST /sessions -d '{"promptId":"<answered>"}'` after both revealed → `409 prompt_already_answered`.
6. A logged-in user without a couple can still open `/start` (no 404).
