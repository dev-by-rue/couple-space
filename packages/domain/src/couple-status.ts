export const CoupleStatuses = [
  "forming",
  "active",
  "dissolving",
  "dissolved",
] as const;

export type CoupleStatus = (typeof CoupleStatuses)[number];
