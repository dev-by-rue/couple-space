import {
  areFollowUpsUnlocked,
  canViewerSeeAnswerText,
  sessionViewerPhase,
  type SessionViewerPhase,
} from "@couple-space/domain";

type ResponseDto = {
  userId: string;
  displayName: string;
  submitted: boolean;
  text: string | null;
};

export type FollowUpDto = {
  promptId: string;
  text: string;
  /** Null until either partner starts it. */
  sessionId: string | null;
  /** Null until started. Never `ready_to_reveal` (Q22). */
  phase: SessionViewerPhase | null;
  responses: ResponseDto[];
};

export type SessionDetailDto = {
  id: string;
  parentSessionId: string | null;
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: "curated" | "follow_up";
  };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: ResponseDto[];
  /** Present only on a main session once both have revealed (FR-19). */
  followUps?: FollowUpDto[];
};

type ResponseSource = Array<{
  userId: string;
  displayName: string;
  body: string;
  submittedAt: Date | null;
}>;

export type SessionDetailSource = {
  sessionId: string;
  parentSessionId: string | null;
  viewerId: string;
  memberIds: string[];
  prompt: {
    id: string;
    title: string;
    description: string;
    text: string;
    kind: string;
  };
  responses: ResponseSource;
  revealedUserIds: string[];
  /** Loaded by the service only when the main prompt is unlocked. */
  followUps?: Array<{
    prompt: { id: string; text: string };
    session: { id: string; responses: ResponseSource } | null;
  }>;
};

/** Phase + redacted responses for one viewer. Shared by main and child sessions. */
function viewerView(input: {
  viewerId: string;
  memberIds: string[];
  responses: ResponseSource;
  revealedUserIds: string[];
  isFollowUp: boolean;
}) {
  const flags = input.responses.map((r) => ({
    userId: r.userId,
    submitted: r.submittedAt != null,
  }));
  const bothSubmitted = input.memberIds.every((id) =>
    flags.some((r) => r.userId === id && r.submitted),
  );
  const viewerHasRevealed = input.revealedUserIds.includes(input.viewerId);
  const phase = sessionViewerPhase({
    viewerId: input.viewerId,
    memberIds: input.memberIds,
    responses: flags,
    revealedUserIds: input.revealedUserIds,
    isFollowUp: input.isFollowUp,
  });
  const partner = input.responses.find((r) => r.userId !== input.viewerId);

  return {
    phase,
    partnerSubmitted: partner?.submittedAt != null,
    responses: input.responses.map((r): ResponseDto => {
      const submitted = r.submittedAt != null;
      const visible = canViewerSeeAnswerText({
        viewerId: input.viewerId,
        answerAuthorId: r.userId,
        authorSubmitted: submitted,
        bothSubmitted,
        viewerHasRevealed,
        isFollowUp: input.isFollowUp,
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

/** Pure mapper: applies domain redaction for the requesting viewer. */
export function buildSessionDetailDto(
  source: SessionDetailSource,
): SessionDetailDto {
  const isFollowUp = source.parentSessionId != null;
  const view = viewerView({
    viewerId: source.viewerId,
    memberIds: source.memberIds,
    responses: source.responses,
    revealedUserIds: source.revealedUserIds,
    isFollowUp,
  });

  const unlocked =
    !isFollowUp &&
    areFollowUpsUnlocked({
      memberIds: source.memberIds,
      revealedUserIds: source.revealedUserIds,
    });

  return {
    id: source.sessionId,
    parentSessionId: source.parentSessionId,
    prompt: {
      id: source.prompt.id,
      title: source.prompt.title,
      description: source.prompt.description,
      text: source.prompt.text,
      kind: isFollowUp ? "follow_up" : "curated",
    },
    ...view,
    ...(unlocked && source.followUps
      ? {
          followUps: source.followUps.map((f): FollowUpDto => {
            if (!f.session) {
              return {
                promptId: f.prompt.id,
                text: f.prompt.text,
                sessionId: null,
                phase: null,
                responses: [],
              };
            }
            const child = viewerView({
              viewerId: source.viewerId,
              memberIds: source.memberIds,
              responses: f.session.responses,
              revealedUserIds: [],
              isFollowUp: true,
            });
            return {
              promptId: f.prompt.id,
              text: f.prompt.text,
              sessionId: f.session.id,
              phase: child.phase,
              responses: child.responses,
            };
          }),
        }
      : {}),
  };
}
