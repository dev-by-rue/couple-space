export function canActivateCouple(input) {
    if (input.coupleStatus !== "forming") {
        return { ok: false, reason: "not_forming" };
    }
    if (input.activeMemberships.length !== 2) {
        return { ok: false, reason: "member_count" };
    }
    if (input.activeMemberships.some((m) => !m.emailVerified)) {
        return { ok: false, reason: "member_unverified" };
    }
    return { ok: true };
}
