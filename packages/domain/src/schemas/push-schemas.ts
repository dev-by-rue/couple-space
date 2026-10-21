import { z } from "zod";

/**
 * Hosts of the browser push services we accept endpoints from.
 *
 * @remarks
 * The API POSTs to whatever endpoint a client registers, so an open URL would
 * let anyone make the server call arbitrary hosts (SSRF). Chrome/Edge use FCM,
 * Safari uses Apple, Firefox uses Mozilla, and legacy Edge uses WNS.
 */
const PUSH_SERVICE_HOST =
  /^(?:[a-z0-9-]+\.)*(?:fcm\.googleapis\.com|android\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

/**
 * A browser push subscription, as `PushSubscription.toJSON()` returns it.
 *
 * @remarks
 * `expirationTime` is dropped: no browser sets it today.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .url({ protocol: /^https$/, hostname: PUSH_SERVICE_HOST })
    .max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const removePushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
});

export type RemovePushSubscriptionInput = z.infer<
  typeof removePushSubscriptionSchema
>;
