export function sessionViewerPhase(input) {
    const byUser = new Map(input.responses.map((r) => [r.userId, r.submitted]));
    const viewerSubmitted = byUser.get(input.viewerId) === true;
    const bothSubmitted = input.memberIds.every((id) => byUser.get(id) === true);
    const viewerRevealed = input.revealedUserIds.includes(input.viewerId);
    if (!viewerSubmitted)
        return "answering";
    if (!bothSubmitted)
        return "waiting_for_partner";
    if (!viewerRevealed)
        return "ready_to_reveal";
    return "revealed";
}
