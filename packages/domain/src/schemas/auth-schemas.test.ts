import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "../schemas/auth-schemas.js";

describe("registerSchema", () => {
  const valid = {
    email: "  Alex@Example.com ",
    password: "Password1234",
    displayName: "Alex",
    dateOfBirth: "1990-01-15",
  };

  it("accepts a valid payload and normalizes email", () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe("alex@example.com");
    expect(parsed.displayName).toBe("Alex");
  });

  it("rejects short passwords", () => {
    expect(() =>
      registerSchema.parse({ ...valid, password: "Short1A" }),
    ).toThrow();
  });

  it("rejects passwords missing complexity", () => {
    expect(() =>
      registerSchema.parse({ ...valid, password: "passwordpassword" }),
    ).toThrow();
  });

  it("rejects bad dateOfBirth formats", () => {
    expect(() =>
      registerSchema.parse({ ...valid, dateOfBirth: "15-01-1990" }),
    ).toThrow();
  });
});

describe("loginSchema", () => {
  it("normalizes email", () => {
    const parsed = loginSchema.parse({
      email: "Pat@Example.com",
      password: "x",
    });
    expect(parsed.email).toBe("pat@example.com");
  });
});

describe("updateProfileSchema", () => {
  it("trims the display name", () => {
    expect(
      updateProfileSchema.parse({
        displayName: " Rueben",
      }).displayName,
    ).toBe("Rueben");
  });

  it("rejects empty/whitespace-only names", () => {
    expect(() =>
      updateProfileSchema.parse({
        displayName: "   ",
      }),
    ).toThrow();
  });

  it("will accept 40 characters or less", () => {
    expect(() =>
      updateProfileSchema.parse({ displayName: "a".repeat(40) }),
    ).not.toThrow();
    expect(() =>
      updateProfileSchema.parse({ displayName: "a".repeat(23) }),
    ).not.toThrow();
    expect(() =>
      updateProfileSchema.parse({ displayName: "a".repeat(41) }),
    ).not.toThrow();
    expect(() =>
      updateProfileSchema.parse({ displayName: "a".repeat(45) }),
    ).not.toThrow();
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    currentPassword: "OldPassword123",
    newPassword: "NewPassword123",
  };

  it("accepts a valid change", () => {
    expect(changePasswordSchema.parse(valid)).toEqual(valid);
  });

  it("requires the current password", () => {
    expect(() =>
      changePasswordSchema.parse({ ...valid, currentPassword: "" }),
    ).toThrow();
  });

  it("applies the register password policy to the new password", () => {
    expect(() =>
      changePasswordSchema.parse({ ...valid, newPassword: "passwordpassword" }),
    ).toThrow();
  });

  it("rejects a new password equal to the current one, on newPassword", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "SamePassword123",
      newPassword: "SamePassword123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
  });
});
