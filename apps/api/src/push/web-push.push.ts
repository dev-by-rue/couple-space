import webpush from "web-push";
import { loadEnv } from "../config/env.js";
import type { PushPort, PushTarget } from "./push.port.js";

/** How long the push service keeps an undelivered message (phone off). */
const TTL_SECONDS = 60 * 60 * 24;

/**
 * Sends web push with the `web-push` library and our VAPID keys.
 *
 * @remarks
 * Without VAPID keys (local dev, unit tests) sending is a no-op, so nothing
 * else needs to know whether push is configured.
 */
export function createWebPush(): PushPort {
  const env = loadEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { send: async () => "ok" };
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );

  return {
    async send(target: PushTarget, payload: string) {
      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          payload,
          { TTL: TTL_SECONDS, urgency: "normal" },
        );
        return "ok";
      } catch (error) {
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          return "gone";
        }
        throw error;
      }
    },
  };
}
