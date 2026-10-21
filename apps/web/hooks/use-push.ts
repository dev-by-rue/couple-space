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
