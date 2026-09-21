export type SessionViewerPhase = "answering" | "waiting_for_partner" | "ready_to_reveal" | "revealed";
export type SessionViewerPhaseInput = {
    viewerId: string;
    memberIds: string[];
    responses: Array<{
        userId: string;
        submitted: boolean;
    }>;
    revealedUserIds: string[];
};
export declare function sessionViewerPhase(input: SessionViewerPhaseInput): SessionViewerPhase;
