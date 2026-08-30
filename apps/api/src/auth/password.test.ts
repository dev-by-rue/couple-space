import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password helpers", () => {
  it("hashes and verifies a correct password", async () => {
    // We assert verify(true) — not that the hash equals the plain text.
    const hash = await hashPassword("correct-horse-battery-1!");
    expect(hash).not.toBe("correct-horse-battery-1!");
    expect(await verifyPassword(hash, "correct-horse-battery-1!")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    // Guards against always-returning-true bugs in verify.
    const hash = await hashPassword("correct-horse-battery-1!");
    expect(await verifyPassword(hash, "wrong-password!!!!")).toBe(false);
  });
});