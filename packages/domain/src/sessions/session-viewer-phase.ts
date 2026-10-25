export type SessionViewerPhase =
  | "answering"
  | "waiting_for_partner"
  | "ready_to_reveal"
  | "revealed";

export type SessionViewerPhaseInput = {
  viewerId: string;
  memberIds: string[];
  responses: Array<{ userId: string; submitted: boolean }>;
  revealedUserIds: string[];
  /** Child session (Q22): goes straight from waiting_for_partner to revealed. */
  isFollowUp?: boolean;
};

export function sessionViewerPhase(
  input: SessionViewerPhaseInput,
): SessionViewerPhase {
  const byUser = new Map(input.responses.map((r) => [r.userId, r.submitted]));
  const viewerSubmitted = byUser.get(input.viewerId) === true;
  const bothSubmitted = input.memberIds.every((id) => byUser.get(id) === true);
  const viewerRevealed = input.revealedUserIds.includes(input.viewerId);

  if (!viewerSubmitted) return "answering";
  if (!bothSubmitted) return "waiting_for_partner";
  if (input.isFollowUp) return "revealed";
  if (!viewerRevealed) return "ready_to_reveal";
  return "revealed";
}
