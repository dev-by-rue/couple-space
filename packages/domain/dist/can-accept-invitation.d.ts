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
export type CanAcceptInvitationResult = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
export declare function canAcceptInvitation(input: CanAcceptInvitationInput): CanAcceptInvitationResult;
