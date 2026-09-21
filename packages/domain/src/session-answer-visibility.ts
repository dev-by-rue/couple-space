export type AnswerVisibilityInput = {
  viewerId: string;
  answerAuthorId: string;
  authorSubmitted: boolean;
  bothSubmitted: boolean;
  viewerHasRevealed: boolean;
};

/** Own submitted answers are visible to the author; partner text needs both submit + viewer reveal. */
export function canViewerSeeAnswerText(input: AnswerVisibilityInput): boolean {
  if (!input.authorSubmitted) return false;
  if (input.answerAuthorId === input.viewerId) return true;
  return input.bothSubmitted && input.viewerHasRevealed;
}
