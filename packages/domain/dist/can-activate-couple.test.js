import { describe, expect, it } from "vitest";
import { canActivateCouple } from "./can-activate-couple.js";
describe("canActivateCouple", () => {
    it("activates when forming with exactly two verified active members", () => {
        expect(canActivateCouple({
            coupleStatus: "forming",
            activeMemberships: [
                { emailVerified: true },
                { emailVerified: true },
            ],
        })).toEqual({ ok: true });
    });
    it("rejects if couple not forming", () => {
        expect(canActivateCouple({
            coupleStatus: "active",
            activeMemberships: [
                { emailVerified: true },
                { emailVerified: true },
            ],
        })).toEqual({ ok: false, reason: "not_forming" });
    });
    it("rejects if not exactly two active members", () => {
        expect(canActivateCouple({
            coupleStatus: "forming",
            activeMemberships: [{ emailVerified: true }],
        })).toEqual({ ok: false, reason: "member_count" });
    });
    it("rejects if any member unverified", () => {
        expect(canActivateCouple({
            coupleStatus: "forming",
            activeMemberships: [
                { emailVerified: true },
                { emailVerified: false },
            ],
        })).toEqual({ ok: false, reason: "member_unverified" });
    });
});
