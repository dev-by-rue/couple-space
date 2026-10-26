# P1-7 · Skip / archive

> **⛔ Shelved 2026-10-26. Don't build this.** The owner overruled [Q3](../../03-product-decisions.md#q3)
> and [Q4](../../03-product-decisions.md#q4): there's no one-sided skip (only Q24's per-person "Skip for
> now", with no reason), and archiving needs **both partners to agree**, like the reveal. That's a later
> phase ([roadmap](../../../product/future-roadmap.md#mutual-archive)). This guide is kept for reference:
> the preset reasons, the check-constraint approach and the audit event can be reused when the mutual
> archive is designed. P1-11 now adds its own write guard; P1-6's `archived` input stays `false`.

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Decisions: [Q3](../../03-product-decisions.md#q3), [Q4](../../03-product-decisions.md#q4) · After: [P1-6](P1-6-session-completion.md) · Next: [P1-11](P1-11-leave-couple.md)

**Builds on P1-8 and P1-6:** child sessions, and the `archived` input of `sessionCompletionState`.

**Goal:** either partner can skip (decline) a conversation or a started follow-up, with an optional
**preset** reason and no free text (Q3). Archived sessions leave the hub's active and past lists and are
kept in an "Archived" section (Q4). Nothing is hard-deleted.

**Done when:**

- `conversation_sessions.archived_at`, `archived_by_user_id`, `decline_reason` (nullable, checked against the preset list).
- `POST /sessions/:id/archive { declineReason? }` archives and writes an `session.archive` audit event (reason only, no content).
- Archived sessions reject answers, drafts and reveals (`409 session_archived`).
- `GET /sessions` returns `archived: true` items; the hub shows them in a collapsed "Archived" section.
- An archived follow-up no longer keeps its parent `in_discussion` (P1-6).
- Domain tests for the reasons schema and the archive rules.

### ⚠️ Product rules to confirm (not decided anywhere yet)

1. **The preset reasons.** Proposed: `not_now` "Not right now", `not_for_us` "Not for us",
   `rather_talk` "We'd rather talk in person", `too_much` "Feels like too much". Change the list in one
   place (`DECLINE_REASONS`).
2. **Archiving is couple-wide.** The columns sit on the session, so one partner's skip hides it for both.
   (A per-user hide would need a new table.)
3. **The partner sees that it was skipped and the reason, but not who** ("Skipped · Not right now"). In a
   two-person couple, who skipped is obvious anyway; the copy just doesn't point at them.
4. **No unarchive in MVP-1.** Q4 doesn't mention it. Re-starting the same prompt from `/start` creates a
   new session (the archived one is never reused).
5. **No push or email** when your partner skips.

---

## Step 1 · Domain

### `packages/domain/src/sessions/decline-reasons.ts` (new)
```ts
import { z } from "zod";

/** Q3: preset reasons only, never free text. Append-only once used in production. */
export const DECLINE_REASONS = [
  "not_now",
  "not_for_us",
  "rather_talk",
  "too_much",
] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  not_now: "Not right now",
  not_for_us: "Not for us",
  rather_talk: "We'd rather talk in person",
  too_much: "Feels like too much",
};

export const archiveSessionSchema = z.object({
  declineReason: z.enum(DECLINE_REASONS).optional(),
});

export type ArchiveSessionInput = z.infer<typeof archiveSessionSchema>;
```
The labels live in the domain so the API, web and any future email share one wording. (Other copy lives
in the web; this is the exception because the reason is a stored enum.)

### `packages/domain/src/sessions/session-archive.ts` (new)
```ts
export type SessionWriteBlock = "session_archived" | null;

/** Archived sessions are read-only: no answers, drafts or reveals (Q4). */
export function sessionWriteBlock(input: {
  archivedAt: Date | null;
}): SessionWriteBlock {
  return input.archivedAt ? "session_archived" : null;
}
```
It's tiny, but P1-11 adds "couple not active" here too, so the API has one place to ask "can this session
still change?".

### `packages/domain/src/index.ts` (change) — add
```ts
export * from "./sessions/decline-reasons.js";
export * from "./sessions/session-archive.js";
```

### `packages/domain/src/sessions/decline-reasons.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import {
  archiveSessionSchema,
  DECLINE_REASON_LABELS,
  DECLINE_REASONS,
} from "./decline-reasons.js";

describe("archiveSessionSchema", () => {
  it("accepts no reason", () => {
    expect(archiveSessionSchema.parse({})).toEqual({});
  });

  it("accepts each preset reason", () => {
    for (const reason of DECLINE_REASONS) {
      expect(archiveSessionSchema.parse({ declineReason: reason }).declineReason).toBe(reason);
    }
  });

  it("rejects free text (Q3)", () => {
    expect(() =>
      archiveSessionSchema.parse({ declineReason: "I just don't like it" }),
    ).toThrow();
  });

  it("has a label for every reason", () => {
    expect(Object.keys(DECLINE_REASON_LABELS).sort()).toEqual([...DECLINE_REASONS].sort());
  });
});
```

### `packages/domain/src/sessions/session-archive.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { sessionWriteBlock } from "./session-archive.js";

describe("sessionWriteBlock", () => {
  it("allows writes to a live session", () => {
    expect(sessionWriteBlock({ archivedAt: null })).toBeNull();
  });

  it("blocks writes to an archived session", () => {
    expect(sessionWriteBlock({ archivedAt: new Date() })).toBe("session_archived");
  });
});
```

### `packages/domain/src/sessions/session-completion.test.ts` (change) — add
```ts
  it("an archived, half-answered follow-up doesn't keep the session in discussion", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [{ submittedUserIds: ["u1"], archived: true }],
      }),
    ).toBe("completed");
  });
```

---

## Step 2 · Database

### `packages/database/src/schema/conversation-sessions.ts` (change)
**Before** (after P1-8)
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
```
**After**
```ts
import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { couples } from "./couples.js";
import { prompts } from "./prompts.js";
import { users } from "./users.js";
```
**Before**
```ts
    parentSessionId: uuid("parent_session_id").references(
      (): AnyPgColumn => conversationSessions.id,
    ),
```
**After**
```ts
    parentSessionId: uuid("parent_session_id").references(
      (): AnyPgColumn => conversationSessions.id,
    ),
    /** Q4: archive only, never delete. Couple-wide. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: uuid("archived_by_user_id").references(() => users.id),
    /** Q3: preset only (DECLINE_REASONS). Null = archived without a reason. */
    declineReason: text("decline_reason"),
```
**Before**
```ts
  (t) => [
    // One child per follow-up. NULLs never collide, so main sessions are unaffected.
    uniqueIndex("conversation_sessions_parent_prompt_unique").on(
      t.parentSessionId,
      t.promptId,
    ),
  ],
```
**After**
```ts
  (t) => [
    // One child per follow-up. NULLs never collide, so main sessions are unaffected.
    uniqueIndex("conversation_sessions_parent_prompt_unique").on(
      t.parentSessionId,
      t.promptId,
    ),
    // Keep in step with DECLINE_REASONS in @couple-space/domain.
    check(
      "conversation_sessions_decline_reason_preset",
      sql`${t.declineReason} is null or ${t.declineReason} in ('not_now', 'not_for_us', 'rather_talk', 'too_much')`,
    ),
    // Not "both or neither": P1-12 nulls archived_by_user_id when that account is deleted.
    check(
      "conversation_sessions_archived_by_needs_archived_at",
      sql`${t.archivedByUserId} is null or ${t.archivedAt} is not null`,
    ),
  ],
```
**Why `text` + `check`, not `pgEnum`:** the repo has no `pgEnum` yet (`prompts.kind` is plain `text`),
and adding a value to a Postgres enum can't run inside a transaction in older versions. A check
constraint is one `ALTER` to change. That's a choice between two patterns; say if you'd rather have
`pgEnum`. The ERD says "preset enum", which either satisfies.

### Migration
`generate`, then read it: three nullable `ADD COLUMN`s, an FK and two `CHECK`s. On existing rows all
three columns are `NULL`, so both checks pass. It's safe as generated.

---

## Step 3 · API

### `apps/api/src/conversations/dto/archive-session.schema.ts` (new)
```ts
/** Re-export shared archive schema from domain (Q3 preset reasons). */
export {
  archiveSessionSchema,
  type ArchiveSessionInput,
} from "@couple-space/domain";
```

### `apps/api/src/conversations/conversations.service.ts` (changes)
Add `sessionWriteBlock` and `type DeclineReason` to the domain import,
`import { AuditService } from "../audit/audit.service.js";`, and
`import type { ArchiveSessionInput } from "./dto/archive-session.schema.js";`.

**Constructor, before**
```ts
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly push: PushService,
  ) {}
```
**After**
```ts
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly push: PushService,
    private readonly audit: AuditService,
  ) {}
```
`AuditModule` is global. Add `{ provide: AuditService, useValue: { append: vi.fn() } }` to every
`Test.createTestingModule` in `conversations.service.test.ts`.

**A write guard, add next to `requireSessionMember`**
```ts
  /** Member check plus "can this session still change?". */
  private async requireWritableSession(user: AuthUser, sessionId: string) {
    const ctx = await this.requireSessionMember(user, sessionId);
    const block = sessionWriteBlock({ archivedAt: ctx.session.archivedAt });
    if (block) throw new ConflictException({ reason: block });
    return ctx;
  }
```
Then in `saveDraft`, `submitResponse` and `revealSession`, replace
`await this.requireSessionMember(user, sessionId)` with `await this.requireWritableSession(user, sessionId)`.
In `startFollowUp`, use it for the parent as well: you can't start a follow-up on an archived session.

**`listSessions`, before** (from P1-6)
```ts
      .select({
        id: conversationSessions.id,
        updatedAt: conversationSessions.updatedAt,
        promptTitle: prompts.title,
        promptText: prompts.text,
      })
```
**After**
```ts
      .select({
        id: conversationSessions.id,
        updatedAt: conversationSessions.updatedAt,
        archivedAt: conversationSessions.archivedAt,
        declineReason: conversationSessions.declineReason,
        promptTitle: prompts.title,
        promptText: prompts.text,
      })
```
**Children query, before**
```ts
      .select({
        id: conversationSessions.id,
        parentSessionId: conversationSessions.parentSessionId,
      })
```
**After**
```ts
      .select({
        id: conversationSessions.id,
        parentSessionId: conversationSessions.parentSessionId,
        archivedAt: conversationSessions.archivedAt,
      })
```
**In the row map, before**
```ts
              archived: false, // P1-7 replaces this with archivedAt != null
```
**After**
```ts
              archived: c.archivedAt != null,
```
**And the returned item, before**
```ts
          phase,
          status,
          updatedAt: row.updatedAt.toISOString(),
```
**After**
```ts
          phase,
          status,
          archived: row.archivedAt != null,
          declineReason: row.declineReason as DeclineReason | null,
          updatedAt: row.updatedAt.toISOString(),
```

**`createSession` must not reuse an archived session, before**
```ts
          eq(conversationSessions.promptId, prompt.id),
          isNull(conversationSessions.parentSessionId),
```
**After**
```ts
          eq(conversationSessions.promptId, prompt.id),
          isNull(conversationSessions.parentSessionId),
          isNull(conversationSessions.archivedAt),
```

**New method, add after `startFollowUp`**
```ts
  /**
   * Q3/Q4: archive (skip) a session for the couple. Idempotent: archiving an
   * archived session returns it unchanged and keeps the first reason.
   */
  async archiveSession(
    user: AuthUser,
    sessionId: string,
    input: ArchiveSessionInput,
  ): Promise<{ id: string; archived: true }> {
    const ctx = await this.requireSessionMember(user, sessionId);
    if (ctx.session.archivedAt) return { id: sessionId, archived: true };

    const now = new Date();
    const updated = await this.db
      .update(conversationSessions)
      .set({
        archivedAt: now,
        archivedByUserId: user.id,
        declineReason: input.declineReason ?? null,
        updatedAt: now,
      })
      // Guard against a double-tap race: only the first archive wins.
      .where(
        and(
          eq(conversationSessions.id, sessionId),
          isNull(conversationSessions.archivedAt),
        ),
      )
      .returning({ id: conversationSessions.id });

    if (updated.length > 0) {
      await this.audit.append({
        actorUserId: user.id,
        action: "session.archive",
        entityType: "conversation_session",
        entityId: sessionId,
        // Preset reason only: never free text, never answer content.
        metadata: {
          declineReason: input.declineReason ?? null,
          isFollowUp: ctx.session.parentSessionId != null,
        },
      });
    }
    return { id: sessionId, archived: true };
  }
```

**`loadDetail`: let the page know.** Add `archivedAt` and `declineReason` to the session select, then
pass `archived: session.archivedAt != null` and `declineReason` through `SessionDetailSource` to the DTO.
In `session-detail.mapper.ts`:
```ts
export type SessionDetailDto = {
  // …existing fields
  archived: boolean;
  declineReason: DeclineReason | null;
};
```
and in `SessionDetailSource` add `archived: boolean; declineReason: string | null;`, returned as
`archived: source.archived, declineReason: source.declineReason as DeclineReason | null`.
For each follow-up in `loadFollowUps`, select `archivedAt` too, and add `archived: boolean` to
`FollowUpDto` (`f.session?.archived ?? false`).

### `apps/api/src/conversations/conversations.controller.ts` (change)
Add `import { archiveSessionSchema } from "./dto/archive-session.schema.js";`, then:
```ts
  @Post("sessions/:id/archive")
  @HttpCode(200)
  archiveSession(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = archiveSessionSchema.parse(body ?? {});
    return this.conversations.archiveSession(user, id, input);
  }
```

### Tests — `apps/api/src/conversations/conversations.service.test.ts`
```ts
describe("ConversationsService.archiveSession", () => {
  const user = { id: "u1", email: "a@example.com", emailVerified: true };

  function memberSelects(db: { select: ReturnType<typeof vi.fn> }, session: Record<string, unknown>) {
    db.select
      .mockReturnValueOnce(queryResult([{ coupleId: "c1", userId: "u1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ id: "c1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ userId: "u1" }, { userId: "u2" }]))
      .mockReturnValueOnce(queryResult([session]));
  }

  async function build(db: unknown, audit = { append: vi.fn() }) {
    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: db },
        { provide: PushService, useValue: fakePush() },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return { service: module.get(ConversationsService), audit };
  }

  it("archives with a preset reason and audits without content", async () => {
    const set = vi.fn(() => ({
      where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "s1" }]) })),
    }));
    const db = { select: vi.fn(), update: vi.fn(() => ({ set })) };
    memberSelects(db, { id: "s1", coupleId: "c1", archivedAt: null, parentSessionId: null });
    const { service, audit } = await build(db);

    await service.archiveSession(user, "s1", { declineReason: "not_now" });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ archivedByUserId: "u1", declineReason: "not_now" }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "session.archive",
        metadata: { declineReason: "not_now", isFollowUp: false },
      }),
    );
  });

  it("is idempotent and keeps the first reason", async () => {
    const db = { select: vi.fn(), update: vi.fn() };
    memberSelects(db, { id: "s1", coupleId: "c1", archivedAt: new Date(), parentSessionId: null });
    const { service, audit } = await build(db);

    await expect(service.archiveSession(user, "s1", { declineReason: "too_much" })).resolves.toEqual({
      id: "s1",
      archived: true,
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it("rejects an answer on an archived session", async () => {
    const db = { select: vi.fn() };
    memberSelects(db, { id: "s1", coupleId: "c1", archivedAt: new Date(), parentSessionId: null });
    const { service } = await build(db);

    await expect(service.submitResponse(user, "s1", { text: "hi" })).rejects.toMatchObject({
      response: { reason: "session_archived" },
    });
  });
});
```

---

## Step 4 · Web

### `apps/web/hooks/use-sessions.ts` (change)
Add `type DeclineReason` to the domain import. Add to `SessionListItem`:
```ts
  archived: boolean;
  declineReason: DeclineReason | null;
```
to `SessionDetailDto` the same two fields, and to `FollowUp` `archived: boolean`. Then add:
```ts
export function useArchiveSessionMutation(
  options?: UseMutationOptions<
    { id: string; archived: true },
    Error,
    { sessionId: string; declineReason?: DeclineReason }
  >,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options ?? {};

  return useMutation({
    ...rest,
    mutationFn: ({ sessionId, declineReason }) =>
      apiFetch<{ id: string; archived: true }>(`/sessions/${sessionId}/archive`, {
        method: "POST",
        body: JSON.stringify({ declineReason }),
      }),
    onSuccess: async (...args) => {
      // Prefix match: refreshes the hub and any open session (parent included).
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      await onSuccess?.(...args);
    },
  });
}
```

### `apps/web/lib/session-sort.ts` (change)
**Before** (from P1-6)
```ts
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
**After**
```ts
/** Hub groups: archived sessions leave active/past and go to their own list (Q4). */
export function groupHubSessions(sessions: SessionListItem[]): {
  active: SessionListItem[];
  past: SessionListItem[];
  archived: SessionListItem[];
} {
  const live = sessions.filter((s) => !s.archived);
  return {
    active: live.filter((s) => s.status !== "completed"),
    past: live.filter((s) => s.status === "completed"),
    archived: sessions.filter((s) => s.archived),
  };
}
```
Rename the call in `conversation-list.tsx` to match.

### `apps/web/components/organisms/skip-session-dialog/skip-session-dialog.tsx` (new)
Presentational. RHF holds the selected reason, using radio inputs (no `useState`).
```tsx
"use client";

import { useForm } from "react-hook-form";
import {
  DECLINE_REASON_LABELS,
  DECLINE_REASONS,
  type DeclineReason,
} from "@couple-space/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SkipSessionDialogProps = {
  /** "conversation" for a main prompt, "follow-up" for a child. */
  noun: "conversation" | "follow-up";
  isSkipping: boolean;
  errorMessage?: string;
  onSkip: (declineReason?: DeclineReason) => void;
};

type FormValues = { declineReason: DeclineReason | "" };

export function SkipSessionDialog({
  noun,
  isSkipping,
  errorMessage,
  onSkip,
}: Readonly<SkipSessionDialogProps>) {
  const form = useForm<FormValues>({ defaultValues: { declineReason: "" } });
  const formId = `skip-${noun}`;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="self-start" />}>
        Skip this {noun}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg">Skip this {noun}?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            It moves to Archived for both of you. Nothing you&apos;ve written is
            deleted. A reason is optional.
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          onSubmit={form.handleSubmit(({ declineReason }) =>
            onSkip(declineReason || undefined),
          )}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Reason (optional)</legend>
            {DECLINE_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-3 text-sm">
                <input type="radio" value={reason} {...form.register("declineReason")} />
                {DECLINE_REASON_LABELS[reason]}
              </label>
            ))}
          </fieldset>
        </form>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep it</DialogClose>
          <Button type="submit" form={formId} disabled={isSkipping}>
            {isSkipping ? "Skipping…" : "Skip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
Plain `<input type="radio">` because there's no radio component in `components/ui` yet. If you add one
(shadcn `radio-group` on Base UI), swap it in. That would be a new UI primitive, so it's your call.

The dialog stays open on success. The page navigates away (main session) or the card re-renders
(follow-up), which unmounts it.

### Conversation page — `apps/web/app/(app)/conversation/[id]/page.tsx` (change)
Add the imports for `SkipSessionDialog`, `useArchiveSessionMutation`, `DECLINE_REASON_LABELS` and
`useRouter`. Then:
```tsx
  const router = useRouter();
  const archive = useArchiveSessionMutation({
    onSuccess: () => router.push("/couple"),
  });
```
**Archived banner, before**
```tsx
      <SessionPromptHeader prompt={data.prompt} />
```
**After**
```tsx
      <SessionPromptHeader prompt={data.prompt} />

      {data.archived ? (
        <p role="status" className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          Skipped
          {data.declineReason ? ` · ${DECLINE_REASON_LABELS[data.declineReason]}` : ""}.
          This conversation is archived and can&apos;t be changed.
        </p>
      ) : null}
```
**Gate the write UIs:** wrap the `answering` / `ready_to_reveal` branches with `!data.archived &&`, so an
archived session only shows what it already has (`waiting_for_partner` / `revealed`).

**Skip action, add after the phase branches**
```tsx
      {!data.archived && data.phase !== "revealed" ? (
        <SkipSessionDialog
          noun="conversation"
          isSkipping={archive.isPending}
          errorMessage={archive.isError ? "Couldn't skip just now. Please try again" : undefined}
          onSkip={(declineReason) => archive.mutate({ sessionId: id, declineReason })}
        />
      ) : null}
```
Hiding Skip once revealed is a UX choice: Q4 also allows archiving a finished conversation. If you want
"Archive" on revealed sessions, show the same dialog with the reason list hidden. Say which you want.

### Follow-ups — `follow-up-list.tsx` / `follow-up-card.tsx` (change)
In `FollowUpItem` add `const archive = useArchiveSessionMutation();` and pass to the card:
```tsx
      archived={followUp.archived}
      skip={
        followUp.sessionId && !followUp.archived && followUp.phase !== "revealed"
          ? {
              isSkipping: archive.isPending,
              onSkip: (declineReason) =>
                archive.mutate({ sessionId: followUp.sessionId!, declineReason }),
            }
          : undefined
      }
```
In `FollowUpCard`, add the props:
```tsx
  archived: boolean;
  /** Present only when the viewer may skip this started follow-up. */
  skip?: { isSkipping: boolean; onSkip: (declineReason?: DeclineReason) => void };
```
and render, **before** the phase branches:
```tsx
      {archived ? (
        <p className="text-sm text-muted-foreground">Skipped.</p>
      ) : (
        /* existing phase branches */
      )}
      {skip ? (
        <SkipSessionDialog noun="follow-up" isSkipping={skip.isSkipping} onSkip={skip.onSkip} />
      ) : null}
```
Skip appears only on **started** follow-ups. An unstarted one doesn't count toward `in_discussion`, so
there's nothing to skip.

### Hub — `conversation-list.tsx` (change)
After the "Past conversations" section:
```tsx
      {archived.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="text-sm font-semibold underline-offset-4 hover:underline">
            Archived ({archived.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-2">
            {archived.map((session) => (
              <ConversationCard key={session.id} session={session} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
```
In `ConversationStatusPill`, show "Skipped" when `archived` is true: add an `archived?: boolean` prop,
`if (archived) label = "Skipped"`, with the `completed` colour. Pass it from `ConversationCard`.

---

## Verification
1. `generate` → read the SQL → `migrate`. `pnpm check-types && pnpm test`.
2. A answers nothing, taps "Skip this conversation" → "Not right now" → back on the hub; the session is
   under Archived ("Skipped") for **both** A and B.
3. B opens it → sees the banner with the reason and no answer form. `curl` a submit → 409 `session_archived`.
4. Start the same prompt again from `/start` → a **new** session (not the archived one).
5. Start a follow-up, A answers, B skips it → the parent shows "Completed" in Past, not "In discussion".
6. `audit_events` has `session.archive` with `{"declineReason":"not_now","isFollowUp":false}` and nothing else.
7. `curl` archive with `{ "declineReason": "free text" }` → 400. A direct SQL update with a bad value → check constraint error.
