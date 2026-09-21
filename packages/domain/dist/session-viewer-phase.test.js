import { describe, expect, it } from "vitest";
import { sessionViewerPhase } from "./session-viewer-phase.js";
const members = ["u1", "u2"];
describe("sessionViewerPhase", () => {
    it("answering when viewer has not submitted", () => {
        expect(sessionViewerPhase({
            viewerId: "u1",
            memberIds: [...members],
            responses: [
                { userId: "u1", submitted: false },
                { userId: "u2", submitted: false },
            ],
            revealedUserIds: [],
        })).toBe("answering");
    });
    it("waiting_for_partner when viewer submitted and partner has not", () => {
        expect(sessionViewerPhase({
            viewerId: "u1",
            memberIds: [...members],
            responses: [
                { userId: "u1", submitted: true },
                { userId: "u2", submitted: false },
            ],
            revealedUserIds: [],
        })).toBe("waiting_for_partner");
    });
    it("ready_to_reveal when both submitted and viewer has not revealed", () => {
        expect(sessionViewerPhase({
            viewerId: "u1",
            memberIds: [...members],
            responses: [
                { userId: "u1", submitted: true },
                { userId: "u2", submitted: true },
            ],
            revealedUserIds: [],
        })).toBe("ready_to_reveal");
    });
    it("revealed when viewer has revealed", () => {
        expect(sessionViewerPhase({
            viewerId: "u1",
            memberIds: [...members],
            responses: [
                { userId: "u1", submitted: true },
                { userId: "u2", submitted: true },
            ],
            revealedUserIds: ["u1"],
        })).toBe("revealed");
    });
    it("ready_to_reveal for u2 when only u1 has revealed", () => {
        expect(sessionViewerPhase({
            viewerId: "u2",
            memberIds: [...members],
            responses: [
                { userId: "u1", submitted: true },
                { userId: "u2", submitted: true },
            ],
            revealedUserIds: ["u1"],
        })).toBe("ready_to_reveal");
    });
});
