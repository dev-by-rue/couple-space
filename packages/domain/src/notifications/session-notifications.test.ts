import { describe, expect, it } from "vitest";
import { notificationsForSessionEvent } from "./session-notifications.js";

const memberIds = ["u1", "u2"];
const names = { u1: "Rue", u2: "Alex" };

describe("notificationsForSessionEvent: answered", () => {
  const base = {
    kind: "answered" as const,
    sessionId: "s1",
    parentSessionId: null,
  };

  it("the first answer tells the partner a conversation started", () => {
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
          title: "New conversation",
          body: "Rue started a new conversation",
          url: "/conversation/s1",
          tag: "session-s1",
        },
      },
    ]);
  });

  it("the second answer tells the first answerer they can reveal", () => {
    expect(
      notificationsForSessionEvent({
        memberIds,
        names,
        event: { ...base, actorId: "u2", submittedUserIds: ["u1", "u2"] },
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

  it("never notifies the actor about their own action", () => {
    const targets = notificationsForSessionEvent({
      memberIds,
      names,
      event: { ...base, actorId: "u2", submittedUserIds: ["u1", "u2"] },
    });
    expect(targets.map((t) => t.toUserId)).not.toContain("u2");
  });

  it("falls back to 'Your partner' when a name is missing", () => {
    const [target] = notificationsForSessionEvent({
      memberIds,
      names: {},
      event: { ...base, actorId: "u1", submittedUserIds: ["u1"] },
    });
    expect(target!.notification.body).toBe(
      "Your partner started a new conversation",
    );
  });
});

describe("notificationsForSessionEvent: revealed", () => {
  it("tells a partner who hasn't revealed yet", () => {
    expect(
      notificationsForSessionEvent({
        memberIds,
        names,
        event: {
          kind: "revealed",
          actorId: "u1",
          sessionId: "s1",
          revealedUserIds: ["u1"],
        },
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
        event: {
          kind: "revealed",
          actorId: "u2",
          sessionId: "s1",
          revealedUserIds: ["u1", "u2"],
        },
      }),
    ).toEqual([]);
  });
});

describe("notificationsForSessionEvent: follow-ups", () => {
  const base = {
    kind: "answered" as const,
    sessionId: "child-1",
    parentSessionId: "s1",
  };

  it("the first follow-up answer tells the partner, on the parent's tag", () => {
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

  it("the second follow-up answer tells the first answerer", () => {
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
