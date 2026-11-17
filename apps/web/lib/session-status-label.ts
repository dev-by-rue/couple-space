import type {
  SessionViewerPhase,
  SessionCompletionStatus,
} from "@couple-space/domain";

const LABELS: Record<SessionViewerPhase, string> = {
  answering: "Your turn",
  waiting_for_partner: "Waiting together",
  ready_to_reveal: "Ready to reveal",
  revealed: "Revealed",
};

/**
 * The hub pill's wording for a session.
 *
 * @remarks
 * Before both have revealed, the pill says what the viewer needs to do
 * (`phase`). After that, it says where the couple is (`status`).
 *
 * @param phase - The viewer's phase
 * @param status - The couple-level state, when known
 * @returns The label to show
 */
export function sessionStatusLabel(
  phase: SessionViewerPhase,
  status?: SessionCompletionStatus,
): string {
  if (status === "in_discussion") return "In discussion";
  if (status === "completed") return "Talked about";
  return LABELS[phase];
}

export function sessionCardActionLabel(phase: SessionViewerPhase): string {
  switch (phase) {
    case "answering":
      return "Answer privately";
    case "waiting_for_partner":
      return "View waiting space";
    case "ready_to_reveal":
      return "Reveal";
    case "revealed":
      return "View answers";
  }
}
