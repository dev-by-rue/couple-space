# P1-33 · Started prompts show their status

[← Board](../board.md) · Size **S** · Gate A · Decision: [Q25](../../product/decisions.md#q25) (amended 2026-11-17)

**Goal:** once **one partner has submitted** an answer to a prompt, its card on `/start/<theme>` shows the
**same status pill as the hub**, worked out for whoever is looking: **"Waiting together"** for the one who
answered, **"Your turn"** for the other. The prompt **stays in the list** and still opens the conversation
when tapped, so the partner still gets the "your partner has already answered" moment. Its action reads
"Continue conversation" instead of "Start this conversation".

**Done when:**

- `inProgressSession` is a pure domain function with tests: the session once someone has submitted, `null`
  for drafts only, `null` once answered.
- `GET /themes` gives each prompt `inProgressPhase` (the viewer's phase, or `null`), with API tests for
  both partners' views and for drafts not counting.
- The prompt card shows `ConversationStatusPill` and "Continue conversation" when `inProgressPhase` is set.

### Notes

- **Drafts don't count.** Opening a prompt creates a session straight away, before anyone writes. Only a
  *submitted* answer shows the pill, so opening a prompt and leaving doesn't mark it (owner, 2026-11-17).
- **Only two phases can appear:** "Waiting together" (`waiting_for_partner`) and "Your turn"
  (`answering`). Once both submit it's answered and P1-32's behaviour takes over (hidden; "Talked about"
  with the chip).
- **The card stays a button,** not a link. Tapping calls `POST /sessions`, which reuses the open session
  and opens it, as today. So no session id is needed in `GET /themes`.
- **The phase comes from `sessionViewerPhase`,** the same function the hub uses, fed only the submitted
  answers (nobody can reveal before both have submitted). No new rules.
- **One lookup, two results.** `answeredSessionsByPrompt` becomes `promptProgressByPrompt` and returns the
  answered map and the in-progress map from the same four queries. No extra query.
- **No new web tests.** Nothing in `lib/` changes (`filterPrompts` doesn't need the new field, and in-progress
  prompts aren't filtered). The rule is tested in the domain and API; the card is rendering only, and
  component tests are still H-10.
- **Molecule using a molecule:** `PromptCard` renders `ConversationStatusPill`, as `ConversationCard`
  already does.
- **Comments describe behaviour** and don't reference task or decision ids.

Checked on a scratch copy of `main` @ `833d139`: domain 91, API 78 and web 21 tests pass; `check-types`
and web lint clean; formatted with the repo's `.prettierrc`.

---

## Step 1 · Domain

### `packages/domain/src/prompts/prompt-answered.ts` (change): add at the end
```ts

/**
 * Finds the session a prompt is waiting on, if one partner has answered it.
 *
 * @remarks
 * A prompt is in progress once at least one member has submitted an answer in
 * one of the couple's main sessions on it, until every member has (then it's
 * answered instead). A session with only drafts doesn't count, so opening a
 * prompt without answering doesn't mark it as started.
 *
 * @param input - The couple's members and their main sessions on the prompt
 * @returns The first such session, or `null` if none is in progress
 */
export function inProgressSession(
  input: AnsweredSessionInput,
): AnsweredSessionInput["sessions"][number] | null {
  if (answeredSessionId(input) !== null) return null;
  return (
    input.sessions.find((session) =>
      session.submittedUserIds.some((id) => input.memberIds.includes(id)),
    ) ?? null
  );
}
```

`index.ts` already exports everything in `prompt-answered.ts`, so nothing to add there.

### `packages/domain/src/prompts/prompt-answered.test.ts` (change)

**Import, before**
```ts
import { answeredSessionId } from "./prompt-answered.js";
```
**After**
```ts
import { answeredSessionId, inProgressSession } from "./prompt-answered.js";
```

**Add at the end**
```ts

describe("inProgressSession", () => {
  it("is null when the couple has no session on the prompt", () => {
    expect(inProgressSession({ memberIds: members, sessions: [] })).toBeNull();
  });

  it("is null while the session only has drafts", () => {
    expect(
      inProgressSession({
        memberIds: members,
        sessions: [{ id: "s1", submittedUserIds: [] }],
      }),
    ).toBeNull();
  });

  it("is the session once one partner has submitted", () => {
    const session = { id: "s1", submittedUserIds: ["u2"] };
    expect(inProgressSession({ memberIds: members, sessions: [session] })).toBe(
      session,
    );
  });

  it("is null once both have submitted, because it's answered", () => {
    expect(
      inProgressSession({
        memberIds: members,
        sessions: [{ id: "s1", submittedUserIds: ["u1", "u2"] }],
      }),
    ).toBeNull();
  });
});
```

---

## Step 2 · API

### `apps/api/src/conversations/conversations.service.ts` (change)

**Domain import, before**
```ts
  type PromptDepth,
  answeredSessionId,
} from "@couple-space/domain";
```
**After**
```ts
  type PromptDepth,
  type SessionViewerPhase,
  answeredSessionId,
  inProgressSession,
} from "@couple-space/domain";
```

**`listThemes`, before**
```ts
    const answered = await this.answeredSessionsByPrompt(user);
```
**After**
```ts
    const progress = await this.promptProgressByPrompt(user);
```
**Before**
```ts
            answeredSessionId: answered.get(p.id) ?? null,
```
**After**
```ts
            answeredSessionId: progress.answered.get(p.id) ?? null,
            // Set while one partner has answered and the other hasn't: what the
            // viewer needs to do, so the web can show the hub's status pill.
            inProgressPhase: progress.inProgress.get(p.id) ?? null,
```

**The helper: rename it and return both results. Before**
```ts
  /**
   * The couple's answered prompts, each with the session to open.
   *
   * @remarks
   * Soft on membership: `/start` is reachable before a couple exists,
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
```
**After**
```ts
  /**
   * Where the couple is with each prompt they've answered or are answering.
   *
   * @remarks
   * Soft on membership: `/start` is reachable before a couple exists,
   * so a user without an active couple gets empty results instead of a 404.
   * Only main sessions count; follow-ups never do. A prompt is `answered`
   * once both partners have submitted, and `inProgress` while only one has,
   * with the viewer's phase on that session. A session with only drafts puts
   * its prompt in neither.
   *
   * @param user - The signed-in user
   * @returns Answered prompt id → newest answered session id, and in-progress
   *   prompt id → the viewer's phase
   */
  private async promptProgressByPrompt(user: AuthUser): Promise<{
    answered: Map<string, string>;
    inProgress: Map<string, SessionViewerPhase>;
  }> {
    const answered = new Map<string, string>();
    const inProgress = new Map<string, SessionViewerPhase>();
```

**Both early returns, before**
```ts
    if (!membership) return answered;
```
```ts
    if (sessions.length === 0) return answered;
```
**After**
```ts
    if (!membership) return { answered, inProgress };
```
```ts
    if (sessions.length === 0) return { answered, inProgress };
```

**The loop at the end, before**
```ts
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
**After**
```ts
    for (const promptId of new Set(sessions.map((s) => s.promptId))) {
      const input = {
        memberIds,
        sessions: sessions
          .filter((s) => s.promptId === promptId)
          .map((s) => ({
            id: s.id,
            submittedUserIds: submitted
              .filter((r) => r.sessionId === s.id)
              .map((r) => r.userId),
          })),
      };

      const id = answeredSessionId(input);
      if (id) {
        answered.set(promptId, id);
        continue;
      }

      const waiting = inProgressSession(input);
      if (waiting) {
        inProgress.set(
          promptId,
          sessionViewerPhase({
            viewerId: user.id,
            memberIds,
            responses: waiting.submittedUserIds.map((userId) => ({
              userId,
              submitted: true,
            })),
            // Nobody can reveal until both have submitted.
            revealedUserIds: [],
          }),
        );
      }
    }
    return { answered, inProgress };
  }
```

### `apps/api/src/conversations/conversations.service.test.ts` (change)

All in the `listThemes` › answered-prompts `describe`. Its `setup` mock doesn't change (same queries), and
the viewer is `u1`.

**`setup`'s tsdoc, before**
```ts
     * `answeredSessionsByPrompt` (membership, members, sessions, submitted).
```
**After**
```ts
     * `promptProgressByPrompt` (membership, members, sessions, submitted).
```

**"marks a prompt both partners submitted with the session to open": the expectation, before**
```ts
      expect(result.themes[0]!.prompts).toEqual([
        expect.objectContaining({ id: "p1", answeredSessionId: "s1" }),
        expect.objectContaining({ id: "p2", answeredSessionId: null }),
      ]);
    });
```
**After**, plus a new test after it
```ts
      expect(result.themes[0]!.prompts).toEqual([
        expect.objectContaining({
          id: "p1",
          answeredSessionId: "s1",
          inProgressPhase: null,
        }),
        expect.objectContaining({
          id: "p2",
          answeredSessionId: null,
          // The viewer (u1) answered s2; the partner hasn't yet.
          inProgressPhase: "waiting_for_partner",
        }),
      ]);
    });

    it("gives the viewer's turn when only the partner has submitted, and ignores drafts", async () => {
      const db = setup(
        [
          { id: "s2", promptId: "p2" },
          { id: "s1", promptId: "p1" },
        ],
        // The partner (u2) submitted s1; s2 has only a draft, so no rows.
        [{ sessionId: "s1", userId: "u2" }],
      );

      const result = await (await serviceWith(db)).listThemes(user);

      expect(result.themes[0]!.prompts).toEqual([
        expect.objectContaining({ id: "p1", inProgressPhase: "answering" }),
        expect.objectContaining({ id: "p2", inProgressPhase: null }),
      ]);
    });
```

**"skips the responses query when the couple has no sessions", before**
```ts
      expect(result.themes[0]!.prompts[0]).toMatchObject({
        answeredSessionId: null,
      });
```
**After**
```ts
      expect(result.themes[0]!.prompts[0]).toMatchObject({
        answeredSessionId: null,
        inProgressPhase: null,
      });
```

---

## Step 3 · Web

### `apps/web/hooks/use-themes.ts` (change)
**Before**
```ts
import type { PromptDepth } from "@couple-space/domain";
```
**After**
```ts
import type { PromptDepth, SessionViewerPhase } from "@couple-space/domain";
```
**Before**
```ts
  answeredSessionId: string | null;
};
```
**After**
```ts
  answeredSessionId: string | null;
  /**
   * Set while one partner has answered and the other hasn't: what the viewer
   * needs to do, shown with the same pill as the hub.
   */
  inProgressPhase: SessionViewerPhase | null;
};
```

### `apps/web/components/molecules/prompt-card/prompt-card.tsx` (change)

**Imports, before**
```tsx
import { cn } from "@/lib/utils";
```
**After**
```tsx
import { cn } from "@/lib/utils";
import { ConversationStatusPill } from "@/components/molecules/conversation-status-pill/conversation-status-pill";
```

**`PromptCard`'s tsdoc, before**
```tsx
 * An unanswered prompt is a button that starts the conversation. One the
 * couple has answered is a link to that conversation instead,
 * so it can never be started twice.
```
**After**
```tsx
 * An unanswered prompt is a button that starts the conversation, or reopens
 * it if one partner has already answered; then it also shows the hub's status
 * pill, so both partners can see it's under way before tapping. One the
 * couple has answered is a link to that conversation instead, so it can never
 * be started twice.
```

**The button's body, before**
```tsx
      <PromptCardBody prompt={prompt} action="Start this conversation" />
```
**After**
```tsx
      <PromptCardBody
        prompt={prompt}
        action={
          prompt.inProgressPhase
            ? "Continue conversation"
            : "Start this conversation"
        }
      />
```

**In `PromptCardBody`, after the "Talked about" badge. Before**
```tsx
              Talked about
            </span>
          ) : null}
        </span>
```
**After**
```tsx
              Talked about
            </span>
          ) : null}
          {prompt.inProgressPhase ? (
            <ConversationStatusPill phase={prompt.inProgressPhase} />
          ) : null}
        </span>
```

---

## Verification

1. `pnpm test` → domain 91, API 78, web 21. `pnpm check-types` and `pnpm --filter web lint` clean.
2. In the browser, with two accounts in one couple:
   - A **opens** a prompt and leaves without submitting → no pill for either partner; it still says
     "Start this conversation".
   - A **submits** → in that theme A sees **"Waiting together"** and B sees **"Your turn"** on the card,
     both with "Continue conversation". It matches the hub.
   - B taps it → the conversation opens and B is told A has already answered (unchanged).
   - B submits → it's answered: hidden, and back with "Show talked about" as "Talked about".
