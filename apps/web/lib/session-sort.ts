import type { SessionListItem } from "@/hooks/use-sessions";
import type { SessionViewerPhase } from "@couple-space/domain";

const PRIORITY_ORDER: SessionViewerPhase[] = [
  "answering",
  "ready_to_reveal",
  "waiting_for_partner",
  "revealed",
];

/**
 * Orders hub sessions so the ones needing the viewer come first.
 *
 * @remarks
 * Priority follows {@link PRIORITY_ORDER}; ties are broken newest first by
 * `updatedAt`. Returns a new array — React Query's cached data must not be
 * mutated.
 *
 * @param sessions - Sessions from `GET /sessions`, in any order
 * @returns A new, sorted array
 */
export function sortSessionsByPriority(
  sessions: SessionListItem[],
): SessionListItem[] {
  return sessions.toSorted(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.phase) - PRIORITY_ORDER.indexOf(b.phase) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

/**
 * Splits hub sessions into active ones and the "We talked about" list.
 *
 * @remarks
 * Active is `in_progress` and `in_discussion`; talked about is `completed`.
 * Keeps the incoming order, so call it on already-sorted data.
 *
 * @param sessions - Sessions from {@link sortSessionsByPriority}
 * @returns Two new arrays, in the same order as the input
 */
export function splitActiveAndTalkedAbout(sessions: SessionListItem[]): {
  active: SessionListItem[];
  talkedAbout: SessionListItem[];
} {
  return {
    active: sessions.filter((s) => s.status !== "completed"),
    talkedAbout: sessions.filter((s) => s.status === "completed"),
  };
}
