import { areFollowUpsUnlocked } from "./follow-ups-unlocked.js";

export type SessionCompletionInput = {
  memberIds: string[];
  reveealedUserIds: string[];
  children: Array<{
    submittedUserids: string;
    archived: boolean;
  }>;
};

export type SessionCompletionStatus =
  | "in_progress"
  | "in_discussion"
  | "completed";

/**
 * Works out the couple-level status of a main session.
 *
 * @remarks
 * `in_progress` until both have revealed the main prompt; after this it should be `in_discussion`
 * while any have started, unarchived follw-ups are not submited by both; otherwise `completed`.
 * Follow-ups nobody has started don't count, so starting a new one moves completed to `in_discussion`.
 *
 * @param input - The couples members, the main prompt reeeaals and the follow-ups
 *   that they have started.
 * @returns The sessions completion status
 */
export function sessionCompletionState(
  input: SessionCompletionInput,
): SessionCompletionStatus {
  if (
    !areFollowUpsUnlocked({
      memberIds: input.memberIds,
      revealedUserIds: input.reveealedUserIds,
    })
  ) {
    return "in_progress";
  }

  const anyOpenSessions = input.children.some(
    (child) =>
      !child.archived &&
      !input.memberIds.every((id) => child.submittedUserids.includes(id)),
  );

  return anyOpenSessions ? "in_discussion" : "completed";
}
