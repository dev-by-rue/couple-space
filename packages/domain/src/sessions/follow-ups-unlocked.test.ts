import { describe, expect, it } from "vitest";
import { areFollowUpsUnlocked } from "./follow-ups-unlocked.js";

describe("areFollowUpsUnlocked", () => {
  it("is locked until both members have revealed", () => {
    expect(
      areFollowUpsUnlocked({ memberIds: ["u1", "u2"], revealedUserIds: [] }),
    ).toBe(false);
    expect(
      areFollowUpsUnlocked({
        memberIds: ["u1", "u2"],
        revealedUserIds: ["u1"],
      }),
    ).toBe(false);
  });

  it("unlocks when both have revealed", () => {
    expect(
      areFollowUpsUnlocked({
        memberIds: ["u1", "u2"],
        revealedUserIds: ["u2", "u1"],
      }),
    ).toBe(true);
  });

  it("stays locked with no members", () => {
    expect(areFollowUpsUnlocked({ memberIds: [], revealedUserIds: [] })).toBe(
      false,
    );
  });
});
