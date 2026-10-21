import { describe, expect, it } from "vitest";
import { newConversationNotification } from "./new-conversation-notification.js";

describe("newConversationNotification", () => {
  const notification = newConversationNotification({
    starterName: "Rue",
    sessionId: "s1",
  });

  it("names the starter and nothing else", () => {
    expect(notification).toEqual({
      title: "New conversation",
      body: "Rue started a new conversation",
      url: "/conversation/s1",
      tag: "session-s1",
    });
  });
});
