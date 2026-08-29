export const MembershipStatuses = ["active", "left"] as const;

export type MembershipStatus = (typeof MembershipStatuses)[number];
