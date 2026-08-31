export function canAcceptInvitation(input) {
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
    if (input.invitationEmail.trim().toLowerCase() !==
        input.inviteeEmail.trim().toLowerCase()) {
        return { ok: false, reason: "email_mismatch" };
    }
    return { ok: true };
}
