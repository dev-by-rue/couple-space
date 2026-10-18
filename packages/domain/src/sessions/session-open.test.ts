import { describe, expect, it } from "vitest";
import { isSessionOpen } from "./session-open.js";

describe("isSessionOpen", () => {
  const memberIds = ["u1", "u2"];

  it("is open when nobody has revealed", () => {
    expect(isSessionOpen({ memberIds, revealedUserIds: [] })).toBe(true);
  });

  it("is open when only one member has revealed", () => {
    expect(isSessionOpen({ memberIds, revealedUserIds: ["u1"] })).toBe(true);
  });

  it("is closed when every member has revealed", () => {
    expect(isSessionOpen({ memberIds, revealedUserIds: ["u2", "u1"] })).toBe(
      false,
    );
  });
});
