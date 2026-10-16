import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../schemas/auth-schemas.js";

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
