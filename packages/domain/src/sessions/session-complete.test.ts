import { describe, expect, it } from "vitest";
import { sessionCompletionState } from "./session-completion.js";

const members = ["u1", "u2"];

describe("sessionCompletionState", () => {
  it("is in_progress until both have revealed the main prompt", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: [],
        children: [],
      }),
    ).toBe("in_progress");
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: ["u1"],
        children: [],
      }),
    ).toBe("in_progress");
  });

  it("is in_progress for a couple with no members (never completed by accident)", () => {
    expect(
      sessionCompletionState({
        memberIds: [],
        revealedUserIds: [],
        children: [],
      }),
    ).toBe("in_progress");
  });

  it("is completed when both revealed and no follow-up was started", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [],
      }),
    ).toBe("completed");
  });

  it("is in_discussion while a started follow-up isn't submitted by both", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [{ submittedUserIds: ["u1"], archived: false }],
      }),
    ).toBe("in_discussion");
  });

  it("is in_discussion for a follow-up started but not answered by either", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [{ submittedUserIds: [], archived: false }],
      }),
    ).toBe("in_discussion");
  });

  it("is completed when every started follow-up is submitted by both", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [
          { submittedUserIds: ["u1", "u2"], archived: false },
          { submittedUserIds: ["u2", "u1"], archived: false },
        ],
      }),
    ).toBe("completed");
  });

  it("ignores an archived follow-up that was never finished", () => {
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [{ submittedUserIds: ["u1"], archived: true }],
      }),
    ).toBe("completed");
  });

  it("goes back to in_discussion when a new follow-up starts on a completed session", () => {
    const children = [{ submittedUserIds: ["u1", "u2"], archived: false }];
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children,
      }),
    ).toBe("completed");
    expect(
      sessionCompletionState({
        memberIds: members,
        revealedUserIds: members,
        children: [...children, { submittedUserIds: [], archived: false }],
      }),
    ).toBe("in_discussion");
  });
});
