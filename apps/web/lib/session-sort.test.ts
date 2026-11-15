import { describe, expect, it } from "vitest";
import type { SessionListItem } from "@/hooks/use-sessions";
import {
  sortSessionsByPriority,
  splitActiveAndTalkedAbout,
} from "./session-sort";

function session(
  id: string,
  phase: SessionListItem["phase"],
  updatedAt: string,
  status: SessionListItem["status"] = "in_progress",
): SessionListItem {
  return { id, promptTitle: id, promptText: id, phase, status, updatedAt };
}

describe("sortSessionsByPriority", () => {
  it("puts the sessions that need the viewer first", () => {
    const sorted = sortSessionsByPriority([
      session("revealed", "revealed", "2026-10-26T10:00:00.000Z"),
      session("waiting", "waiting_for_partner", "2026-10-26T10:00:00.000Z"),
      session("ready", "ready_to_reveal", "2026-10-26T10:00:00.000Z"),
      session("answering", "answering", "2026-10-26T10:00:00.000Z"),
    ]);

    expect(sorted.map((s) => s.id)).toEqual([
      "answering",
      "ready",
      "waiting",
      "revealed",
    ]);
  });

  it("breaks ties newest first", () => {
    const sorted = sortSessionsByPriority([
      session("old", "answering", "2026-10-01T10:00:00.000Z"),
      session("new", "answering", "2026-10-26T10:00:00.000Z"),
    ]);

    expect(sorted.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("doesn't mutate the input (React Query's cache)", () => {
    const input = [
      session("revealed", "revealed", "2026-10-26T10:00:00.000Z"),
      session("answering", "answering", "2026-10-26T10:00:00.000Z"),
    ];
    sortSessionsByPriority(input);

    expect(input.map((s) => s.id)).toEqual(["revealed", "answering"]);
  });
});

describe("splitActiveAndTalkedAbout", () => {
  const at = "2026-10-26T10:00:00.000Z";

  it("keeps in progress and in discussion active, completed in talked about", () => {
    const { active, talkedAbout } = splitActiveAndTalkedAbout([
      session("answering", "answering", at),
      session("discussing", "revealed", at, "in_discussion"),
      session("done", "revealed", at, "completed"),
    ]);

    expect(active.map((s) => s.id)).toEqual(["answering", "discussing"]);
    expect(talkedAbout.map((s) => s.id)).toEqual(["done"]);
  });

  it("keeps the incoming order in both lists", () => {
    const { talkedAbout } = splitActiveAndTalkedAbout([
      session("newer", "revealed", at, "completed"),
      session("older", "revealed", at, "completed"),
    ]);

    expect(talkedAbout.map((s) => s.id)).toEqual(["newer", "older"]);
  });
});
