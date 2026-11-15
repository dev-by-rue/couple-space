import { describe, expect, it } from "vitest";
import {
  sessionCardActionLabel,
  sessionStatusLabel,
} from "./session-status-label";

describe("sessionStatusLabel", () => {
  it("uses the viewer's phase before both have revealed", () => {
    expect(sessionStatusLabel("answering", "in_progress")).toBe("Your turn");
    expect(sessionStatusLabel("ready_to_reveal")).toBe("Ready to reveal");
  });

  it("uses the couple's state once both have revealed", () => {
    expect(sessionStatusLabel("revealed", "in_discussion")).toBe(
      "In discussion",
    );
    expect(sessionStatusLabel("revealed", "completed")).toBe("Talked about");
  });
});

describe("sessionCardActionLabel", () => {
  it("is View answers for any revealed session, in discussion or not", () => {
    expect(sessionCardActionLabel("revealed")).toBe("View answers");
  });
});
