import { describe, expect, it } from "vitest";
import { canViewerSeeAnswerText } from "./session-answer-visibility.js";

describe("canViewerSeeAnswerText", () => {
  it("allows viewer to see their own submitted answer before reveal", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u1",
        authorSubmitted: true,
        bothSubmitted: false,
        viewerHasRevealed: false,
      }),
    ).toBe(true);
  });

  it("hides partner text until both submitted and viewer revealed", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u2",
        authorSubmitted: true,
        bothSubmitted: true,
        viewerHasRevealed: false,
      }),
    ).toBe(false);
  });

  it("shows partner text when both submitted and viewer revealed", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u2",
        authorSubmitted: true,
        bothSubmitted: true,
        viewerHasRevealed: true,
      }),
    ).toBe(true);
  });

  it("lets the author see their own unsubmitted draft", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u1",
        authorSubmitted: false,
        bothSubmitted: false,
        viewerHasRevealed: false,
      }),
    ).toBe(true);
  });

  it("never shows a partner's unsubmitted draft", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u2",
        authorSubmitted: false,
        bothSubmitted: false,
        viewerHasRevealed: true,
      }),
    ).toBe(false);
  });
});
