export type SessionOpenInput = {
  memberIds: string[];
  revealedUserIds: string[];
};

export function isSessionOpen(input: SessionOpenInput): boolean {
  return !input.memberIds.every((id) => input.revealedUserIds.includes(id));
}
