import { describe, expect, it } from "vitest";
import { createInvitationSchema } from "./invitation-schemas.js";

describe("createInvitationSchema", () => {
  it("accepts a valid email and normalizes it", () => {
    const parsed = createInvitationSchema.parse({
      email: "  Partner@Example.com ",
    });
    expect(parsed.email).toBe("partner@example.com");
  });

  it("rejects invalid email", () => {
    expect(() =>
      createInvitationSchema.parse({ email: "not-an-email" }),
    ).toThrow();
  });
});
