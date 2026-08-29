import { describe, expect, it } from "vitest";
import { canAcceptInvitation } from "./can-accept-invitation.js";

describe("canAcceptInvitation", () => {
  const base = {
    invitationStatus: "pending" as const,
    invitationExpiresAt: new Date(Date.now() + 60_000),
    now: new Date(),
    inviteeEmailVerified: true,
    inviteeHasActiveMembership: false,
    invitationEmail: "partner@example.com",
    inviteeEmail: "partner@example.com",
  };

  it("allows a valid pending invite", () => {
    expect(canAcceptInvitation(base)).toEqual({ ok: true });
  });

  it("rejects when email not verified", () => {
    expect(
      canAcceptInvitation({ ...base, inviteeEmailVerified: false }),
    ).toEqual({ ok: false, reason: "email_unverified" });
  });

  it("rejects when invitee already in an active couple", () => {
    expect(
      canAcceptInvitation({ ...base, inviteeHasActiveMembership: true }),
    ).toEqual({ ok: false, reason: "already_in_couple" });
  });

  it("rejects revoked invites", () => {
    expect(
      canAcceptInvitation({ ...base, invitationStatus: "revoked" }),
    ).toEqual({ ok: false, reason: "not_pending" });
  });

  it("rejects expired invites by status", () => {
    expect(
      canAcceptInvitation({ ...base, invitationStatus: "expired" }),
    ).toEqual({ ok: false, reason: "not_pending" });
  });

  it("rejects when now is past expiresAt", () => {
    expect(
      canAcceptInvitation({
        ...base,
        invitationExpiresAt: new Date(Date.now() - 1000),
      }),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects email mismatch", () => {
    expect(
      canAcceptInvitation({
        ...base,
        inviteeEmail: "other@example.com",
      }),
    ).toEqual({ ok: false, reason: "email_mismatch" });
  });
});
