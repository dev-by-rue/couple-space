/** What the service worker needs to show one notification. */
export type PushNotification = {
  title: string;
  body: string;
  /** App path opened when the notification is tapped. */
  url: string;
  /** Same tag replaces an older notification instead of stacking. */
  tag: string;
};

/**
 * Builds the push sent to a partner when a conversation is started.
 *
 * @remarks
 * Shown on a lock screen, so it never includes the theme, prompt or any
 * answer text. The starter's name is fine: only their partner receives it.
 *
 * @param input - The starter's display name and the new session's id
 * @returns The notification payload
 */
export function newConversationNotification(input: {
  starterName: string;
  sessionId: string;
}): PushNotification {
  return {
    title: "New conversation",
    body: `${input.starterName} started a new conversation`,
    url: `/conversation/${input.sessionId}`,
    tag: `session-${input.sessionId}`,
  };
}
