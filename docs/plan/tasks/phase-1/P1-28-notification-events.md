# P1-28 · Notification events (core loop + follow-ups)

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Gate A · Decision: [Q23](../../03-product-decisions.md#q23) · After: [P1-26](P1-26-push-api.md), [P1-27](P1-27-push-in-app.md) · Part B after: [P1-8](P1-8-follow-ups.md)

**Goal:** push for every step of a conversation, not only the first answer. One pure domain function
decides **who gets what**; `PushService` only sends.

| # | Event | Who gets it | Title · Body |
| --- | --- | --- | --- |
| A1 | First answer on a main session *(exists)* | Partner | New conversation · Alex started a new conversation |
| A2 | Second answer on a main session | First answerer | Ready to reveal · Alex has answered too |
| A3 | A partner reveals while the other hasn't | The one who hasn't | Alex has seen your answer · Reveal theirs whenever you're ready |
| B1 | First answer on a follow-up | Partner | Follow-up · Alex answered a follow-up |
| B2 | Second answer on a follow-up | First answerer | Follow-up answers are in · You've both answered a follow-up |

**Rules (agreed):**
- Push only. Email comes later (P1-14).
- There's one on/off switch: the existing per-device "Turn on/off notifications" item (P1-27). New
  events follow it automatically, so there's nothing to build for settings.
- Names only, never prompt or answer text (lock-screen privacy). The builders don't accept that data.
- **One tag per conversation.** Follow-ups use their **parent's** tag and URL, so a newer notification
  replaces the older one, and `renotify` makes the replacement still buzz.
- A3 only goes to a partner who **hasn't** revealed. If both reveal within seconds, nobody gets "has
  seen your answer" after already revealing.
- No quiet hours (decided: phones' Do Not Disturb covers it for now).

**Done when:**

- `notificationsForSessionEvent` (domain) covers A1–A3 (Part A) and B1–B2 (Part B), with tests.
- `PushService.notifySessionEvent` replaces `notifyNewConversation` and never throws.
- `submitResponse` and `revealSession` call it; the reveal call happens only when a new reveal row is written.
- The service worker sets `renotify`.

### Notes

- **Part A builds on today's code.** Part B needs P1-8's child sessions. Do Part A now and Part B when
  you build P1-8.
- **This replaces two lines in other guides:** the P1-8 guide's "skip the push for children" change
  (Part B supersedes it), and P1-14's edit to the same `isFirstToSubmit` block (P1-14 would hook in
  next to `notifySessionEvent` instead).
- **No new Nest module.** The event rules are domain logic; sending stays in `apps/api/src/push/`. A
  `NotificationService` that picks push or email per user only earns its place when email arrives.

---

# Part A · Core loop

## Step 1 · Domain

### `packages/domain/src/notifications/session-notifications.ts` (new)
```ts
import type { PushNotification } from "./new-conversation-notification.js";
import { newConversationNotification } from "./new-conversation-notification.js";

/**
 * Something that happened in a session, described after the change.
 *
 * @remarks
 * `submittedUserIds` / `revealedUserIds` include the actor, so the rules can
 * tell "first" from "second" without another query.
 */
export type SessionEvent =
  | {
      kind: "answered";
      actorId: string;
      sessionId: string;
      submittedUserIds: string[];
    }
  | {
      kind: "revealed";
      actorId: string;
      sessionId: string;
      revealedUserIds: string[];
    };

export type NotificationTarget = {
  toUserId: string;
  notification: PushNotification;
};

/** "Ready to reveal": sent to the first answerer when the second answer arrives. */
export function readyToRevealNotification(input: {
  partnerName: string;
  sessionId: string;
}): PushNotification {
  return {
    title: "Ready to reveal",
    body: `${input.partnerName} has answered too`,
    url: `/conversation/${input.sessionId}`,
    tag: `session-${input.sessionId}`,
  };
}

/** Sent to a partner who hasn't revealed yet, when the other one does. */
export function partnerRevealedNotification(input: {
  partnerName: string;
  sessionId: string;
}): PushNotification {
  return {
    title: `${input.partnerName} has seen your answer`,
    body: "Reveal theirs whenever you're ready",
    url: `/conversation/${input.sessionId}`,
    tag: `session-${input.sessionId}`,
  };
}

/**
 * Decides who is notified about a session event, and with what.
 *
 * @remarks
 * Pure, so every rule is unit-tested. It never sees prompt or answer text:
 * names and ids are the only inputs.
 *
 * @param input - The event, the couple's member ids, and their display names
 * @returns One entry per user to notify; empty when nobody should be
 */
export function notificationsForSessionEvent(input: {
  event: SessionEvent;
  memberIds: string[];
  names: Record<string, string>;
}): NotificationTarget[] {
  const { event, memberIds } = input;
  const actorName = input.names[event.actorId] ?? "Your partner";
  const others = memberIds.filter((id) => id !== event.actorId);

  if (event.kind === "answered") {
    const isFirst = event.submittedUserIds.every((id) => id === event.actorId);
    if (isFirst) {
      // A1: the partner has something to answer.
      return others.map((toUserId) => ({
        toUserId,
        notification: newConversationNotification({
          starterName: actorName,
          sessionId: event.sessionId,
        }),
      }));
    }
    const allSubmitted = memberIds.every((id) => event.submittedUserIds.includes(id));
    if (!allSubmitted) return [];
    // A2: everyone who answered earlier can now reveal.
    return others.map((toUserId) => ({
      toUserId,
      notification: readyToRevealNotification({
        partnerName: actorName,
        sessionId: event.sessionId,
      }),
    }));
  }

  // A3: only partners who haven't revealed yet. If both just revealed, nobody.
  return others
    .filter((id) => !event.revealedUserIds.includes(id))
    .map((toUserId) => ({
      toUserId,
      notification: partnerRevealedNotification({
        partnerName: actorName,
        sessionId: event.sessionId,
      }),
    }));
}
```
`PushNotification` lives in `new-conversation-notification.ts` today. Import it from there; don't move it
in this task.

### `packages/domain/src/index.ts` (change) — add
```ts
export * from "./notifications/session-notifications.js";
```

### `packages/domain/src/notifications/session-notifications.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { notificationsForSessionEvent } from "./session-notifications.js";

const memberIds = ["u1", "u2"];
const names = { u1: "Rue", u2: "Alex" };

describe("notificationsForSessionEvent: answered", () => {
  it("A1: the first answer tells the partner a conversation started", () => {
    expect(
      notificationsForSessionEvent({
        memberIds,
        names,
        event: { kind: "answered", actorId: "u1", sessionId: "s1", submittedUserIds: ["u1"] },
      }),
    ).toEqual([
      {
        toUserId: "u2",
        notification: {
          title: "New conversation",
          body: "Rue started a new conversation",
          url: "/conversation/s1",
          tag: "session-s1",
        },
      },
    ]);
  });

  it("A2: the second answer tells the first answerer they can reveal", () => {
    expect(
      notificationsForSessionEvent({
        memberIds,
        names,
        event: { kind: "answered", actorId: "u2", sessionId: "s1", submittedUserIds: ["u1", "u2"] },
      }),
    ).toEqual([
      {
        toUserId: "u1",
        notification: {
          title: "Ready to reveal",
          body: "Alex has answered too",
          url: "/conversation/s1",
          tag: "session-s1",
        },
      },
    ]);
  });

  it("never sends the actor a notification about their own action", () => {
    const targets = notificationsForSessionEvent({
      memberIds,
      names,
      event: { kind: "answered", actorId: "u2", sessionId: "s1", submittedUserIds: ["u1", "u2"] },
    });
    expect(targets.map((t) => t.toUserId)).not.toContain("u2");
  });

  it("falls back to 'Your partner' when a name is missing", () => {
    const [target] = notificationsForSessionEvent({
      memberIds,
      names: {},
      event: { kind: "answered", actorId: "u1", sessionId: "s1", submittedUserIds: ["u1"] },
    });
    expect(target!.notification.body).toBe("Your partner started a new conversation");
  });
});

describe("notificationsForSessionEvent: revealed", () => {
  it("A3: tells a partner who hasn't revealed yet", () => {
    expect(
      notificationsForSessionEvent({
        memberIds,
        names,
        event: { kind: "revealed", actorId: "u1", sessionId: "s1", revealedUserIds: ["u1"] },
      }),
    ).toEqual([
      {
        toUserId: "u2",
        notification: {
          title: "Rue has seen your answer",
          body: "Reveal theirs whenever you're ready",
          url: "/conversation/s1",
          tag: "session-s1",
        },
      },
    ]);
  });

  it("sends nothing when the partner has already revealed", () => {
    expect(
      notificationsForSessionEvent({
        memberIds,
        names,
        event: { kind: "revealed", actorId: "u2", sessionId: "s1", revealedUserIds: ["u1", "u2"] },
      }),
    ).toEqual([]);
  });
});
```

---

## Step 2 · `PushService`

### `apps/api/src/push/push.service.ts` (change)
**Imports, before**
```ts
import {
  newConversationNotification,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
} from "@couple-space/domain";
```
**After**
```ts
import {
  notificationsForSessionEvent,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
  type SessionEvent,
} from "@couple-space/domain";
```
**Replace `notifyNewConversation`, before**
```ts
  /**
   * Pings the partner's devices that a conversation was started.
   *
   * @remarks
   * Never throws: callers fire and forget, so a push outage can't fail or slow
   * session creation. Logs counts only, never the payload.
   */
  async notifyNewConversation(input: {
    starterId: string;
    partnerIds: string[];
    sessionId: string;
  }): Promise<void> {
    if (input.partnerIds.length === 0) return;
    try {
      const [starter] = await this.db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, input.starterId))
        .limit(1);
      const notification = newConversationNotification({
        starterName: starter?.displayName ?? "Your partner",
        sessionId: input.sessionId,
      });
      await this.sendToUsers(input.partnerIds, JSON.stringify(notification));
    } catch (error) {
      this.logger.warn(`Push for session ${input.sessionId} failed: ${error}`);
    }
  }
```
**After**
```ts
  /**
   * Sends whatever the domain rules say a session event deserves.
   *
   * @remarks
   * Never throws: callers fire and forget, so a push outage can't fail or slow
   * an answer or a reveal. Logs counts only, never the payload.
   */
  async notifySessionEvent(input: {
    event: SessionEvent;
    memberIds: string[];
  }): Promise<void> {
    if (input.memberIds.length < 2) return;
    try {
      const rows = await this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, input.memberIds));
      const targets = notificationsForSessionEvent({
        event: input.event,
        memberIds: input.memberIds,
        names: Object.fromEntries(rows.map((r) => [r.id, r.displayName])),
      });
      for (const target of targets) {
        await this.sendToUsers([target.toUserId], JSON.stringify(target.notification));
      }
    } catch (error) {
      this.logger.warn(`Push for session ${input.event.sessionId} failed: ${error}`);
    }
  }
```
`eq` may now be unused in this file except in `unsubscribe`; leave the import if it's still used there.
With two members there's at most one target, so the sequential loop costs nothing.

### `apps/api/src/push/push.service.test.ts` (change)
The helpers stay; only the first mocked select changes shape (names for everyone, awaited without
`.limit`) and the calls change.

**Before**
```ts
  mockDb.select
    // starter's display name
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ displayName: "Rue" }]),
        })),
      })),
    })
```
**After**
```ts
  mockDb.select
    // members' display names
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          { id: "u1", displayName: "Rue" },
          { id: "u2", displayName: "Alex" },
        ]),
      })),
    })
```
**Before**
```ts
const input = { starterId: "u1", partnerIds: ["u2"], sessionId: "s1" };

describe("PushService.notifyNewConversation", () => {
```
**After**
```ts
const input = {
  memberIds: ["u1", "u2"],
  event: {
    kind: "answered" as const,
    actorId: "u1",
    sessionId: "s1",
    submittedUserIds: ["u1"],
  },
};

describe("PushService.notifySessionEvent", () => {
```
Then rename every `service.notifyNewConversation(input)` call in the file to
`service.notifySessionEvent(input)`. The existing payload assertion (`"Rue started a new conversation"`)
still holds. Replace the last test:

**Before**
```ts
  it("does nothing without partners", async () => {
    const mockDb = { select: vi.fn() };
    const push = { send: vi.fn() };
    const service = await serviceWith(mockDb, push);

    await service.notifyNewConversation({ ...input, partnerIds: [] });

    expect(mockDb.select).not.toHaveBeenCalled();
  });
```
**After**
```ts
  it("does nothing without a partner", async () => {
    const mockDb = { select: vi.fn() };
    const push = { send: vi.fn() };
    const service = await serviceWith(mockDb, push);

    await service.notifySessionEvent({ ...input, memberIds: ["u1"] });

    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("sends nothing when the rules return no targets", async () => {
    const { mockDb } = mockDbWith([subscription("https://fcm.googleapis.com/a")]);
    const push = { send: vi.fn<PushPort["send"]>(async () => "ok") };
    const service = await serviceWith(mockDb, push);

    // Both revealed: A3 sends nothing.
    await service.notifySessionEvent({
      memberIds: ["u1", "u2"],
      event: { kind: "revealed", actorId: "u2", sessionId: "s1", revealedUserIds: ["u1", "u2"] },
    });

    expect(push.send).not.toHaveBeenCalled();
  });
```

---

## Step 3 · `ConversationsService`

### `apps/api/src/conversations/conversations.service.ts` — `submitResponse` (change)
**Before**
```ts
    const existing = responses.find((r) => r.userId === user.id);
    // Only the first answer pings: the partner has something to reply to,
    // and the second answer doesn't ping back.
    const isFirstToSubmit = responses.every(
      (r) => r.userId === user.id || r.submittedAt == null,
    );
```
**After**
```ts
    const existing = responses.find((r) => r.userId === user.id);
```
**Before**
```ts
    if (isFirstToSubmit) {
      // Fire and forget: notifyNewConversation never throws.
      void this.push.notifyNewConversation({
        starterId: user.id,
        partnerIds: ctx.memberIds.filter((id) => id !== user.id),
        sessionId,
      });
    }
```
**After**
```ts
    // Fire and forget: notifySessionEvent never throws. The domain decides
    // whether this is "new conversation" (first) or "ready to reveal" (second).
    void this.push.notifySessionEvent({
      memberIds: ctx.memberIds,
      event: {
        kind: "answered",
        actorId: user.id,
        sessionId,
        submittedUserIds: [
          ...responses
            .filter((r) => r.submittedAt != null)
            .map((r) => r.userId),
          user.id,
        ],
      },
    });
```

### `revealSession` (change)
**Before**
```ts
    if (!existingReveal) {
      const now = new Date();
      await this.db.insert(sessionReveals).values({
        sessionId,
        userId: user.id,
        revealedAt: now,
      });
      await this.db
        .update(conversationSessions)
        .set({ updatedAt: now })
        .where(eq(conversationSessions.id, sessionId));
    }
```
**After**
```ts
    if (!existingReveal) {
      const now = new Date();
      await this.db.insert(sessionReveals).values({
        sessionId,
        userId: user.id,
        revealedAt: now,
      });
      await this.db
        .update(conversationSessions)
        .set({ updatedAt: now })
        .where(eq(conversationSessions.id, sessionId));

      const reveals = await this.db
        .select({ userId: sessionReveals.userId })
        .from(sessionReveals)
        .where(eq(sessionReveals.sessionId, sessionId));
      // Only on a new reveal: re-tapping Reveal never re-notifies.
      void this.push.notifySessionEvent({
        memberIds: ctx.memberIds,
        event: {
          kind: "revealed",
          actorId: user.id,
          sessionId,
          revealedUserIds: reveals.map((r) => r.userId),
        },
      });
    }
```
The extra select reads the reveals **after** the insert, so if your partner revealed a moment earlier,
it's in the list and A3 correctly sends nothing.

### `apps/api/src/conversations/conversations.service.test.ts` (change)
**Before**
```ts
const fakePush = () => ({ notifyNewConversation: vi.fn() });
```
**After**
```ts
const fakePush = () => ({ notifySessionEvent: vi.fn() });
```
**In `describe("submitResponse notifications")`, before**
```ts
    it("pings the partner when the first answer is submitted", async () => {
      const { service, push } = await setup(null);

      await service.submitResponse(user, "s1", { text: "my answer" });
      expect(push.notifyNewConversation).toHaveBeenCalledWith({
        starterId: "u1",
        partnerIds: ["u2"],
        sessionId: "s1",
      });
    });

    it("sends nothing when the partner already submitted", async () => {
      const { service, push } = await setup(new Date());

      await service.submitResponse(user, "s1", { text: "my answer" });
      expect(push.notifyNewConversation).not.toHaveBeenCalled();
    });
```
**After**
```ts
    it("reports a first answer with only the viewer submitted", async () => {
      const { service, push } = await setup(null);

      await service.submitResponse(user, "s1", { text: "my answer" });
      expect(push.notifySessionEvent).toHaveBeenCalledWith({
        memberIds: ["u1", "u2"],
        event: {
          kind: "answered",
          actorId: "u1",
          sessionId: "s1",
          submittedUserIds: ["u1"],
        },
      });
    });

    it("reports a second answer with both submitted", async () => {
      const { service, push } = await setup(new Date());

      await service.submitResponse(user, "s1", { text: "my answer" });
      expect(push.notifySessionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({ submittedUserIds: ["u2", "u1"] }),
        }),
      );
    });
```
The "who gets what" assertions now live in the domain tests. Here we only check that the service
describes the event correctly.

Add a `describe("revealSession notifications")` in the same style: the four membership/session selects,
then responses (both submitted), then `existingReveal` → `[]`, then the post-insert reveals →
`[{ userId: "u1" }]`; `insert` → `{ values: vi.fn(async () => undefined) }`. Assert
`notifySessionEvent` was called with `event.kind === "revealed"` and `revealedUserIds: ["u1"]`. A second
case with `existingReveal` → `[{ id: "r1" }]` asserts it **wasn't** called.

---

## Step 4 · Service worker

### `apps/web/public/sw.js` (change)
**Before**
```js
    self.registration.showNotification(data.title ?? "Couple Space", {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      data: { url },
    }),
```
**After**
```js
    self.registration.showNotification(data.title ?? "Couple Space", {
      body: data.body,
      tag: data.tag,
      // Same tag replaces the older notification for this conversation;
      // renotify makes the replacement still sound/vibrate.
      renotify: Boolean(data.tag),
      icon: "/icons/icon-192.png",
      data: { url },
    }),
```
`renotify: true` without a `tag` throws in some browsers. That's why it's tied to the tag.
`notificationclick` doesn't need to close "other notifications for this conversation", because the
shared tag means there's only ever one.

`sw.js` is served `no-cache` (`next.config.ts`), so devices pick up the change on their next visit.

---

# Part B · Follow-ups (after P1-8)

Build this **with or after** P1-8. It assumes P1-8's `parentSessionId` on sessions and
`requireSessionMember` returning `{ ...ctx, session }`. **Skip** P1-8's "No push for follow-up answers"
change to `submitResponse`; this part replaces it.

## Step 5 · Domain

### `session-notifications.ts` (change)
**`answered` event, before**
```ts
  | {
      kind: "answered";
      actorId: string;
      sessionId: string;
      submittedUserIds: string[];
    }
```
**After**
```ts
  | {
      kind: "answered";
      actorId: string;
      sessionId: string;
      /** Set for a follow-up: notifications point at, and replace, the parent's. */
      parentSessionId: string | null;
      submittedUserIds: string[];
    }
```
**Add the builders**
```ts
/** B1: the partner answered a follow-up. Opens the parent conversation. */
export function followUpAnsweredNotification(input: {
  partnerName: string;
  parentSessionId: string;
}): PushNotification {
  return {
    title: "Follow-up",
    body: `${input.partnerName} answered a follow-up`,
    url: `/conversation/${input.parentSessionId}`,
    tag: `session-${input.parentSessionId}`,
  };
}

/** B2: both answered a follow-up, so the answers are showing (Q22: no reveal step). */
export function followUpReadyNotification(input: {
  parentSessionId: string;
}): PushNotification {
  return {
    title: "Follow-up answers are in",
    body: "You've both answered a follow-up",
    url: `/conversation/${input.parentSessionId}`,
    tag: `session-${input.parentSessionId}`,
  };
}
```
**In `notificationsForSessionEvent`, before**
```ts
  if (event.kind === "answered") {
    const isFirst = event.submittedUserIds.every((id) => id === event.actorId);
    if (isFirst) {
```
**After**
```ts
  if (event.kind === "answered") {
    const isFirst = event.submittedUserIds.every((id) => id === event.actorId);
    const allSubmitted = memberIds.every((id) => event.submittedUserIds.includes(id));

    if (event.parentSessionId) {
      const parentSessionId = event.parentSessionId;
      if (isFirst) {
        // B1
        return others.map((toUserId) => ({
          toUserId,
          notification: followUpAnsweredNotification({ partnerName: actorName, parentSessionId }),
        }));
      }
      // B2
      return allSubmitted
        ? others.map((toUserId) => ({
            toUserId,
            notification: followUpReadyNotification({ parentSessionId }),
          }))
        : [];
    }

    if (isFirst) {
```
and delete the now-duplicate `const allSubmitted = …` line further down in the main-session path.

### Tests (change)
Add `parentSessionId: null` to every existing `answered` event in `session-notifications.test.ts`, then:
```ts
describe("notificationsForSessionEvent: follow-ups", () => {
  const base = { kind: "answered" as const, sessionId: "child-1", parentSessionId: "s1" };

  it("B1: first follow-up answer tells the partner, on the parent's tag", () => {
    expect(
      notificationsForSessionEvent({
        memberIds,
        names,
        event: { ...base, actorId: "u1", submittedUserIds: ["u1"] },
      }),
    ).toEqual([
      {
        toUserId: "u2",
        notification: {
          title: "Follow-up",
          body: "Rue answered a follow-up",
          url: "/conversation/s1",
          tag: "session-s1",
        },
      },
    ]);
  });

  it("B2: second follow-up answer tells the first answerer", () => {
    const [target] = notificationsForSessionEvent({
      memberIds,
      names,
      event: { ...base, actorId: "u2", submittedUserIds: ["u1", "u2"] },
    });
    expect(target).toEqual({
      toUserId: "u1",
      notification: {
        title: "Follow-up answers are in",
        body: "You've both answered a follow-up",
        url: "/conversation/s1",
        tag: "session-s1",
      },
    });
  });

  it("never uses the child session id in the url or tag", () => {
    const targets = notificationsForSessionEvent({
      memberIds,
      names,
      event: { ...base, actorId: "u1", submittedUserIds: ["u1"] },
    });
    expect(JSON.stringify(targets)).not.toContain("child-1");
  });
});
```
Revealing a follow-up is impossible (P1-8 rejects it), so `revealed` needs no follow-up branch.

## Step 6 · API

### `submitResponse` (change)
**Before** (from Part A)
```ts
      event: {
        kind: "answered",
        actorId: user.id,
        sessionId,
        submittedUserIds: [
```
**After**
```ts
      event: {
        kind: "answered",
        actorId: user.id,
        sessionId,
        parentSessionId: ctx.session.parentSessionId,
        submittedUserIds: [
```
Update the two Part A service tests to expect `parentSessionId: null` (their session mock has no
parent), and add one with `{ id: "c1", coupleId: "c1", parentSessionId: "s1" }` asserting
`parentSessionId: "s1"` is passed through.

### Web
Nothing to change. The URL is the parent conversation, and P1-8's `FollowUpList` renders inside it.
P1-27's `notificationclick` already navigates there.

---

## Verification
1. `pnpm --filter @couple-space/domain test`, then `pnpm check-types && pnpm test`.
2. Both phones with notifications on (P1-27):
   - A answers a new prompt → B: "New conversation · Rue started a new conversation".
   - B answers → A: "Ready to reveal · Alex has answered too". A's lock screen shows one notification
     for the conversation, not two.
   - A reveals → B: "Rue has seen your answer".
   - B reveals → A gets **nothing**.
   - A taps Reveal again (or refreshes) → no new notification.
3. **Part B:** A answers a follow-up → B: "Follow-up · Rue answered a follow-up", and tapping it opens
   the main conversation. B answers → A: "Follow-up answers are in". Both replace the conversation's
   earlier notification.
4. Turn notifications off on one phone (account menu) → that phone gets none of the above.
