import type { InvitationStatus } from "./invitation-status.js";

export type CanAcceptInvitationInput = {
  invitationStatus: InvitationStatus;
  invitationExpiresAt: Date;
  now: Date;
  inviteeEmailVerified: boolean;
  inviteeHasActiveMembership: boolean;
  invitationEmail: string;
  inviteeEmail: string;
};

export type CanAcceptInvitationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canAcceptInvitation(
  input: CanAcceptInvitationInput,
): CanAcceptInvitationResult {
  if (input.invitationStatus !== "pending") {
    return { ok: false, reason: "not_pending" };
  }
  if (input.now.getTime() > input.invitationExpiresAt.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (!input.inviteeEmailVerified) {
    return { ok: false, reason: "email_unverified" };
  }
  if (input.inviteeHasActiveMembership) {
    return { ok: false, reason: "already_in_couple" };
  }
  if (
    input.invitationEmail.trim().toLowerCase() !==
    input.inviteeEmail.trim().toLowerCase()
  ) {
    return { ok: false, reason: "email_mismatch" };
  }
  return { ok: true };
}
