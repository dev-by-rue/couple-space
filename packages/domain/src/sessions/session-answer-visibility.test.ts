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
