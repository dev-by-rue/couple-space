import {
  canViewerSeeAnswerText,
  sessionViewerPhase,
  type SessionViewerPhase,
} from "@couple-space/domain";

export type SessionDetailDto = {
  id: string;
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: "curated";
  };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: Array<{
    userId: string;
    displayName: string;
    submitted: boolean;
    text: string | null;
  }>;
};

export type SessionDetailSource = {
  sessionId: string;
  viewerId: string;
  memberIds: string[];
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: string;
  };
  responses: Array<{
    userId: string;
    displayName: string;
    body: string;
    submittedAt: Date | null;
  }>;
  revealedUserIds: string[];
};

/** Pure mapper: applies domain redaction for the requesting viewer. */
export function buildSessionDetailDto(
  source: SessionDetailSource,
): SessionDetailDto {
  const responseFlags = source.responses.map((r) => ({
    userId: r.userId,
    submitted: r.submittedAt != null,
  }));
  const bothSubmitted = source.memberIds.every((id) =>
    responseFlags.some((r) => r.userId === id && r.submitted),
  );
  const viewerHasRevealed = source.revealedUserIds.includes(source.viewerId);
  const phase = sessionViewerPhase({
    viewerId: source.viewerId,
    memberIds: source.memberIds,
    responses: responseFlags,
    revealedUserIds: source.revealedUserIds,
  });

  const partner = source.responses.find((r) => r.userId !== source.viewerId);
  const partnerSubmitted = partner?.submittedAt != null;

  return {
    id: source.sessionId,
    prompt: {
      id: source.prompt.id,
      title: source.prompt.title,
      description: source.prompt.description,
      text: source.prompt.text,
      kind: "curated",
    },
    phase,
    partnerSubmitted: Boolean(partnerSubmitted),
    responses: source.responses.map((r) => {
      const submitted = r.submittedAt != null;
      const visible = canViewerSeeAnswerText({
        viewerId: source.viewerId,
        answerAuthorId: r.userId,
        authorSubmitted: submitted,
        bothSubmitted,
        viewerHasRevealed,
      });
      return {
        userId: r.userId,
        displayName: r.displayName,
        submitted,
        text: visible ? r.body : null,
      };
    }),
  };
}
