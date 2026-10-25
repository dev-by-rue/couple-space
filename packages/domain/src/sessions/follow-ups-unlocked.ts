export type FollowUpsUnlockedInput = {
  memberIds: string[];
  revealedUserIds: string[];
};

/** FR-19: follow-ups appear only once every member has revealed the main prompt. */
export function areFollowUpsUnlocked(input: FollowUpsUnlockedInput): boolean {
  return (
    input.memberIds.length > 0 &&
    input.memberIds.every((id) => input.revealedUserIds.includes(id))
  );
}
