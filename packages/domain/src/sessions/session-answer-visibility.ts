export type AnswerVisibilityInput = {
  viewerId: string;
  answerAuthorId: string;
  authorSubmitted: boolean;
  bothSubmitted: boolean;
  viewerHasRevealed: boolean;
  /** Child session (Q22): no reveal step; both submitted is enough. */
  isFollowUp?: boolean;
};

/**
 * Own answers are always visible to the author. Partner text needs both
 * submitted, plus the viewer's reveal on a main session.
 */
export function canViewerSeeAnswerText(input: AnswerVisibilityInput): boolean {
  if (input.answerAuthorId === input.viewerId) return true;
  if (!input.authorSubmitted) return false;
  if (input.isFollowUp) return input.bothSubmitted;
  return input.bothSubmitted && input.viewerHasRevealed;
}
