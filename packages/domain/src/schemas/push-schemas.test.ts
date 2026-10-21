import { describe, expect, it } from "vitest";
import { pushSubscriptionSchema } from "./push-schemas.js";

const keys = { p256dh: "BNc…", auth: "tBH…" };

describe("pushSubscriptionSchema", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/QGuQ",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
      true,
    );
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://evil.example.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example.com/x",
    "https://localhost:8080/internal",
  ])("rejects %s", (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
      false,
    );
  });

  it("drops expirationTime", () => {
    const parsed = pushSubscriptionSchema.parse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      expirationTime: null,
      keys,
    });
    expect(parsed).not.toHaveProperty("expirationTime");
  });
});
