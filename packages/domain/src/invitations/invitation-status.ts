export const InvitationStatuses = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;

export type InvitationStatus = (typeof InvitationStatuses)[number];
