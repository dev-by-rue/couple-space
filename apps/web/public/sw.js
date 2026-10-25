/**
 * Couple Space service worker: shows push notifications and opens the app
 * when one is tapped.
 *
 * Push only, on purpose: there is no fetch handler, so pages and API responses
 * (which carry auth cookies) are never cached.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Reads the push payload; non-JSON (e.g. the DevTools "Push" button) becomes the body. */
function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

self.addEventListener("push", (event) => {
  const data = readPayload(event);
  // Only ever open paths in this app ("//host" would leave the origin).
  const url =
    typeof data.url === "string" &&
    data.url.startsWith("/") &&
    !data.url.startsWith("//")
      ? data.url
      : "/couple";

  // Browsers require every push to show a notification (iOS revokes the
  // subscription after a few silent ones), so this always shows one.
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Couple Space", {
      body: data.body,
      tag: data.tag,
      // Same tag replaces the older notification for this conversation;
      // renotify makes the replacement still sound/vibrate.
      renotify: Boolean(data.tag),
      icon: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url ?? "/couple",
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find((client) => "navigate" in client);
      if (open) {
        await open.focus();
        return open.navigate(url).catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    })(),
  );
});
