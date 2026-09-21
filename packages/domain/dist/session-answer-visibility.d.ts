export type AnswerVisibilityInput = {
    viewerId: string;
    answerAuthorId: string;
    authorSubmitted: boolean;
    bothSubmitted: boolean;
    viewerHasRevealed: boolean;
};
/** Own submitted answers are visible to the author; partner text needs both submit + viewer reveal. */
export declare function canViewerSeeAnswerText(input: AnswerVisibilityInput): boolean;
