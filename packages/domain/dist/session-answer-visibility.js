/** Own submitted answers are visible to the author; partner text needs both submit + viewer reveal. */
export function canViewerSeeAnswerText(input) {
    if (!input.authorSubmitted)
        return false;
    if (input.answerAuthorId === input.viewerId)
        return true;
    return input.bothSubmitted && input.viewerHasRevealed;
}
