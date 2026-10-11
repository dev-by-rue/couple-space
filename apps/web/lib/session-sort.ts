import type { SessionListItem } from "@/hooks/use-sessions";
import type { SessionViewerPhase } from "@couple-space/domain";

const PRIORITY_ORDER: SessionViewerPhase[] = [
  "answering",
  "ready_to_reveal",
  "waiting_for_partner",
  "revealed",
];

export const sortSessionsByPriority = (
  sessions: SessionListItem[],
): SessionListItem[] =>
  sessions.toSorted(
    (a, b) =>
      PRIORITY_ORDER.indexOf(b.phase) || b.updatedAt.localeCompare(a.updatedAt),
  );
