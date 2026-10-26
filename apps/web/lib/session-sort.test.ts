import type { SessionListItem } from "@/hooks/use-sessions";
import { describe, it, expect } from "vitest";
import { sortSessionsByPriority } from "./session-sort";

function session(
  id: string,
  phase: SessionListItem["phase"],
  updatedAt: string,
) {
  return { id, promptTitle: id, promptText: id, phase, updatedAt };
}

describe("sortSessionsByPriority", () => {
  it("puts sessions that need the viewer first", () => {
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

  it("breaks ties - newest being first", () => {
    const sorted = sortSessionsByPriority([
      session("old", "answering", "2026-10-01T10:00:00:00.000Z"),
      session("new", "answering", "2026-10-26T10:00:00:00.000Z"),
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
