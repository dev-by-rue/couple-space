import type { SessionViewerPhase } from "@couple-space/domain";

const LABELS: Record<SessionViewerPhase, string> = {
  answering: "Your turn",
  waiting_for_partner: "Waiting together",
  ready_to_reveal: "Ready to reveal",
  revealed: "Revealed",
};

export function sessionStatusLabel(phase: SessionViewerPhase): string {
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
