import { describe, expect, it } from "vitest";
import { answeredSessionId } from "./prompt-answered.js";

const members = ["u1", "u2"];

describe("answeredSessionId", () => {
  it("is null when the couple has no session on the prompt", () => {
    expect(answeredSessionId({ memberIds: members, sessions: [] })).toBeNull();
  });

  it("is null while only one partner has submitted", () => {
    expect(
      answeredSessionId({
        memberIds: members,
        sessions: [{ id: "s1", submittedUserIds: ["u1"] }],
      }),
    ).toBeNull();
  });

  it("is the session once both have submitted, revealed or not", () => {
    expect(
      answeredSessionId({
        memberIds: members,
        sessions: [{ id: "s1", submittedUserIds: ["u2", "u1"] }],
      }),
    ).toBe("s1");
  });

  it("prefers the first answered session in the order given", () => {
    expect(
      answeredSessionId({
        memberIds: members,
        sessions: [
          { id: "open", submittedUserIds: ["u1"] },
          { id: "newer", submittedUserIds: ["u1", "u2"] },
          { id: "older", submittedUserIds: ["u1", "u2"] },
        ],
      }),
    ).toBe("newer");
  });

  it("is never answered for a couple with no members", () => {
    expect(
      answeredSessionId({
        memberIds: [],
        sessions: [{ id: "s1", submittedUserIds: [] }],
      }),
    ).toBeNull();
  });
});
