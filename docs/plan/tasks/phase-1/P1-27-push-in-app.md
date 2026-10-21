# P1-27 · Notifications in the app

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Gate A · Decision: [Q23](../../03-product-decisions.md#q23) · Depends on: [P1-25](P1-25-installable-app.md), [P1-26](P1-26-push-api.md)

**Goal:** when you start a conversation, your partner's phone pings, and tapping the notification opens it.

**Done when:**

- The hub shows a "Turn on notifications" banner until you enable it or tap "Not now" (remembered per
  device).
- On iPhone in Safari (not installed), the banner says to add the app to the Home Screen first instead.
- The account menu has "Turn on notifications" / "Turn off notifications" for this device.
- Logging out removes this device's subscription.
- Tapping a notification opens `/conversation/<id>`, reusing an open window when there is one.
- The service worker handles push only. No `fetch` handler, so nothing is cached offline.

The web app has no test runner, so the logic that matters (who gets a push, what it says, cleanup) is
tested in P1-26. This step is checked by hand on real phones (see **Check**).

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Manifest + Apple metadata | `app/manifest.ts`, `app/layout.tsx` | From P1-25. iOS only allows push for Home Screen apps |
| Push endpoints | `POST`/`DELETE /push/subscriptions` | From P1-26 |
| `apiFetch` | `lib/api.ts` | Cookies via `/backend` on Railway, so the service worker is same-origin with the API proxy |
| Logout | `useLogoutMutation` in `hooks/use-auth-mutations.ts` | Called from the account menu in `app-header.tsx` |
| Hub | `app/(app)/couple/page.tsx` | `StartConversation` + `ConversationList` when the couple is `active` |

---

## Steps

### Step 1 · VAPID public key for the web

The browser needs the API's **public** VAPID key to subscribe. It's public by design, so a build-time
`NEXT_PUBLIC_` variable is fine, the same way `NEXT_PUBLIC_API_URL` works.

- `apps/web/.env.local`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same value as the api's VAPID_PUBLIC_KEY>`
- Railway **web** service: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${{api.VAPID_PUBLIC_KEY}}` (a reference variable,
  so there's one source of truth; use your api service's name). Redeploy web after setting it, because
  it's read at build time.
- Add it to the web env list in [`docs/deployment/railway.md`](../../../deployment/railway.md).

### Step 2 · Service worker

New file `apps/web/public/sw.js`. It's plain JavaScript, because files in `public/` are served as-is.

```js
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

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  // Only ever open paths in this app.
  const url = typeof data.url === "string" && data.url.startsWith("/")
    ? data.url
    : "/couple";

  // Browsers require every push to show a notification (iOS revokes the
  // subscription after a few silent ones), so this always shows one.
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Couple Space", {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/couple", self.location.origin).href;

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
```

In `apps/web/next.config.ts`, serve it uncached so updates reach phones straight away. Add a `headers()`
next to `rewrites()`:

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  async rewrites() {
    …unchanged
  },
};
```

### Step 3 · Browser helpers

New file `apps/web/lib/push.ts`. These are thin wrappers over browser APIs, kept out of components and
hooks so the hook reads clearly. No `apiFetch` here.

```ts
/**
 * Browser helpers for web push.
 *
 * @packageDocumentation
 */

const DISMISSED_KEY = "cs_push_banner_dismissed";

/**
 * Whether this browser can do web push right now.
 *
 * @remarks
 * iOS Safari only exposes `PushManager` inside a Home Screen app, so this is
 * `false` in a normal Safari tab on iPhone.
 *
 * @returns `true` when service workers, `PushManager` and `Notification` all exist
 */
export function isPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Whether this is an iPhone or iPad browser tab that could get push once installed.
 *
 * @remarks
 * iPadOS reports a Mac user agent, so touch support tells them apart.
 *
 * @returns `true` on iOS/iPadOS when not opened from the Home Screen
 */
export function needsHomeScreenInstall() {
  const ua = navigator.userAgent;
  const isIos =
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

/**
 * Registers `/sw.js` (a no-op if it already is) and waits until it's active.
 *
 * @remarks
 * `pushManager.subscribe` fails without an active worker, hence `ready`.
 *
 * @returns The active registration
 */
export async function registerServiceWorker() {
  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  return navigator.serviceWorker.ready;
}

/**
 * Converts the base64url VAPID public key into the bytes `subscribe` wants.
 *
 * @remarks
 * Some browsers accept the string directly; Safari has been inconsistent, so
 * always pass bytes.
 *
 * @param base64Url - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
 * @returns The raw key bytes
 */
export function vapidKeyToBytes(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/**
 * Whether "Not now" was tapped on this device.
 *
 * @remarks
 * A UI preference only, so `localStorage` is fine here (no tokens). Private
 * mode can make storage throw, which counts as not dismissed.
 *
 * @returns `true` once the banner was dismissed on this device
 */
export function isBannerDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers "Not now" on this device. */
export function dismissBanner() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Storage blocked: the banner just shows again next visit.
  }
}
```

The two `try/catch` blocks wrap `localStorage`, not a form submit, so the "no `try/catch` in submit
handlers" rule doesn't apply.

### Step 4 · Hooks

New file `apps/web/hooks/use-push.ts`. The device's push state is read through React Query, so there's no
`useState`/`useEffect`: enabling, disabling and dismissing all invalidate the one query.

```ts
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  dismissBanner,
  isBannerDismissed,
  isPushSupported,
  needsHomeScreenInstall,
  registerServiceWorker,
  vapidKeyToBytes,
} from "@/lib/push";

/**
 * Push state for this device.
 *
 * - `unsupported`: this browser can't do web push.
 * - `needs-install`: iPhone/iPad Safari tab; add to Home Screen first.
 * - `denied`: blocked in browser or OS settings; only the user can undo that.
 * - `dismissed`: "Not now" was tapped; the menu toggle still works.
 * - `off` / `on`: whether this device is subscribed.
 */
export type PushStatus =
  | "unsupported"
  | "needs-install"
  | "denied"
  | "dismissed"
  | "off"
  | "on";

export const PUSH_STATUS_QUERY_KEY = ["push-status"] as const;

async function readPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return needsHomeScreenInstall() ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";

  const registration = await registerServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && Notification.permission === "granted") return "on";

  return isBannerDismissed() ? "dismissed" : "off";
}

/**
 * Reads whether this device can get, or already gets, notifications.
 *
 * @remarks
 * Also registers the service worker. Refetches on focus because permission
 * can be changed in system settings while the app is in the background.
 *
 * @returns The React Query result with a {@link PushStatus}
 */
export function usePushStatusQuery() {
  return useQuery({
    queryKey: PUSH_STATUS_QUERY_KEY,
    queryFn: readPushStatus,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
  });
}

/**
 * Subscribes this device and saves the subscription on the API.
 *
 * @remarks
 * Call `mutate(Notification.requestPermission())` straight from the click
 * handler. Browsers (Safari especially) only show the permission prompt during
 * the tap itself, and React Query runs `mutationFn` a tick later, so the
 * request has to start before `mutate`.
 *
 * @returns The React Query mutation
 */
export function useEnablePushMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (permission: Promise<NotificationPermission>) => {
      if ((await permission) !== "granted") return;
      const registration = await registerServiceWorker();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToBytes(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ),
      });
      await apiFetch<void>("/push/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PUSH_STATUS_QUERY_KEY }),
  });
}

/**
 * Removes this device's subscription from the API and the browser.
 *
 * @remarks
 * Used by the menu toggle and by logout, so a logged-out phone stops getting
 * the previous user's notifications.
 *
 * @returns Resolves once both are removed, or straight away if there was none
 */
export async function unsubscribeThisDevice() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await apiFetch<void>("/push/subscriptions", {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

export function useDisablePushMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unsubscribeThisDevice,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PUSH_STATUS_QUERY_KEY }),
  });
}

export function useDismissPushBannerMutation(
  options?: UseMutationOptions<void, Error, void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async () => dismissBanner(),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: PUSH_STATUS_QUERY_KEY }),
  });
}
```

`useDismissPushBannerMutation` takes `options` like `useLogoutMutation` does. Drop the parameter if
nothing ends up passing any.

### Step 5 · Unsubscribe on logout

`apps/web/hooks/use-auth-mutations.ts`, before → after:

```ts
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
```

```ts
    mutationFn: async () => {
      // Before logout, while the auth cookie still works. A failure here
      // must not block logging out.
      await unsubscribeThisDevice().catch(() => undefined);
      return apiFetch("/auth/logout", { method: "POST" });
    },
```

with `import { unsubscribeThisDevice } from "@/hooks/use-push";`. The `.catch` is on purpose: logout
has to work even if the push service or network is down.

### Step 6 · The banner

New file `apps/web/components/molecules/notifications-banner/notifications-banner.tsx`:

```tsx
"use client";

import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PushStatus } from "@/hooks/use-push";

type NotificationsBannerProps = {
  /** This device's push state, from `usePushStatusQuery`. */
  status: PushStatus;
  isEnabling: boolean;
  isError: boolean;
  /** Must call `Notification.requestPermission()` synchronously. */
  onEnable: () => void;
  onDismiss: () => void;
};

/**
 * Asks to turn on notifications, or explains the iPhone Home Screen step.
 *
 * @remarks
 * Renders nothing once notifications are on, dismissed, blocked or
 * unsupported. The browser's own prompt only ever appears after Enable is
 * tapped, never on page load.
 */
export function NotificationsBanner({
  status,
  isEnabling,
  isError,
  onEnable,
  onDismiss,
}: Readonly<NotificationsBannerProps>) {
  if (status !== "off" && status !== "needs-install") return null;

  const needsInstall = status === "needs-install";

  return (
    <section className="rounded-lg bg-card p-6 text-card-foreground ring-1 ring-foreground/10">
      <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent-foreground">
        <BellIcon aria-hidden="true" className="size-4" />
      </span>
      <h2 className="mt-4 text-2xl">
        {needsInstall ? "Get notifications on iPhone" : "Turn on notifications"}
      </h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        {needsInstall
          ? "Tap Share, then Add to Home Screen. Open Couple Space from your Home Screen and turn notifications on there."
          : "Get a ping on this device when your partner starts a conversation."}
      </p>
      {isError ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Couldn&apos;t turn on notifications. Please try again.
        </p>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {needsInstall ? null : (
          <Button disabled={isEnabling} onClick={onEnable}>
            {isEnabling ? "Turning on…" : "Turn on"}
          </Button>
        )}
        <Button variant="ghost" disabled={isEnabling} onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </section>
  );
}
```

The layout and classes copy `InvitePendingCard`. If `bg-accent-soft` / `text-destructive` aren't the
tokens you want, swap them for whichever your palette uses for an info card and an error line.

### Step 7 · Show it on the hub

`apps/web/app/(app)/couple/page.tsx`. Add the imports and hooks:

```tsx
import { NotificationsBanner } from "@/components/molecules/notifications-banner/notifications-banner";
import {
  useDismissPushBannerMutation,
  useEnablePushMutation,
  usePushStatusQuery,
} from "@/hooks/use-push";
…
export default function CouplePage() {
  const couple = useCoupleMeQuery();
  const sendNewLink = useSendNewInviteLinkMutation();
  const revokeInvite = useRevokeInviteMutation();
  const pushStatus = usePushStatusQuery();
  const enablePush = useEnablePushMutation();
  const dismissPush = useDismissPushBannerMutation();
```

Then in the `active` branch, before → after:

```tsx
      {status === "active" ? (
        <>
          <StartConversation />
          <ConversationList />
        </>
```

```tsx
      {status === "active" ? (
        <>
          {pushStatus.data ? (
            <NotificationsBanner
              status={pushStatus.data}
              isEnabling={enablePush.isPending}
              isError={enablePush.isError}
              onEnable={() => enablePush.mutate(Notification.requestPermission())}
              onDismiss={() => dismissPush.mutate()}
            />
          ) : null}
          <StartConversation />
          <ConversationList />
        </>
```

Only for an `active` couple: before your partner joins there's nobody to notify you.

### Step 8 · On/off in the account menu

`apps/web/components/organisms/app-header/app-header.tsx`. Add:

```tsx
import {
  useDisablePushMutation,
  useEnablePushMutation,
  usePushStatusQuery,
} from "@/hooks/use-push";
…
  const pushStatus = usePushStatusQuery();
  const enablePush = useEnablePushMutation();
  const disablePush = useDisablePushMutation();
```

Then before the last `<DropdownMenuSeparator />` (the one above **Log out**):

```tsx
          {pushStatus.data === "on" ? (
            <DropdownMenuItem
              disabled={disablePush.isPending}
              onClick={() => disablePush.mutate()}
            >
              Turn off notifications
            </DropdownMenuItem>
          ) : pushStatus.data === "off" || pushStatus.data === "dismissed" ? (
            <DropdownMenuItem
              disabled={enablePush.isPending}
              onClick={() => enablePush.mutate(Notification.requestPermission())}
            >
              Turn on notifications
            </DropdownMenuItem>
          ) : pushStatus.data === "denied" ? (
            <DropdownMenuItem disabled>
              Notifications blocked in settings
            </DropdownMenuItem>
          ) : null}
```

This is a stand-in until the settings page ([P1-4](../phase-1-mvp-1.md)) exists. Move it there then.

---

## Check

Push needs HTTPS, so test on the Railway deploy. (`localhost` also works on a laptop, but not from a phone.)

1. **Desktop Chrome first** (quickest to debug). Log in as A, tap **Turn on** in the banner, and allow.
   DevTools → **Application → Service workers** shows `sw.js` activated, and a row appears in
   `push_subscriptions`. In a second browser profile, log in as B and start a conversation. A gets a
   notification. Clicking it opens `/conversation/<id>`.
2. **Android:** install from P1-25, open from the home screen, turn on, then have your partner start a
   conversation with the app closed.
3. **iPhone:** in Safari the banner says to add to the Home Screen. Do that, open the app from the Home
   Screen, and the banner now offers **Turn on**. After you allow it, notifications arrive with the app
   closed, and tapping one opens the conversation.
4. **Toggle:** menu → Turn off notifications. The row is gone, and no push arrives for the next new
   conversation. Turn it back on from the menu.
5. **Logout:** log out on a subscribed device. The row is deleted.
6. **Not now:** dismiss the banner. It stays hidden after a reload, and the menu still offers Turn on.
7. `pnpm check-types` and `pnpm --filter @couple-space/web lint` pass.

## Known limits (fine for Gate A)

- If a browser rotates a subscription by itself (rare), that device stops getting pushes until it's
  turned off and on again. A fix later: re-send the subscription to `POST /push/subscriptions` whenever
  the status reads `on` (the upsert makes that safe).
- If permission is `denied`, only the person can undo it in browser or iOS settings. The menu says so.

Commit: `feat(web): P1-27 push notifications service worker and opt-in`.
