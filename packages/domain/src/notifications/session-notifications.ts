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
      /** Set for a follow-up: notifications point at, and replace, the parent's. */
      parentSessionId: string | null;
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

/** The partner answered a follow-up. Opens the parent conversation. */
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

/** Both answered a follow-up, so the answers are showing (no reveal step, Q22). */
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
  const to = (notification: PushNotification) =>
    others.map((toUserId) => ({ toUserId, notification }));

  if (event.kind === "answered") {
    const isFirst = event.submittedUserIds.every((id) => id === event.actorId);
    const allSubmitted = memberIds.every((id) =>
      event.submittedUserIds.includes(id),
    );

    if (event.parentSessionId) {
      const parentSessionId = event.parentSessionId;
      if (isFirst) {
        return to(
          followUpAnsweredNotification({
            partnerName: actorName,
            parentSessionId,
          }),
        );
      }
      return allSubmitted
        ? to(followUpReadyNotification({ parentSessionId }))
        : [];
    }

    if (isFirst) {
      // The partner has something to answer.
      return to(
        newConversationNotification({
          starterName: actorName,
          sessionId: event.sessionId,
        }),
      );
    }
    // Everyone who answered earlier can now reveal.
    return allSubmitted
      ? to(
          readyToRevealNotification({
            partnerName: actorName,
            sessionId: event.sessionId,
          }),
        )
      : [];
  }

  // Only partners who haven't revealed yet. If both just revealed, nobody.
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
