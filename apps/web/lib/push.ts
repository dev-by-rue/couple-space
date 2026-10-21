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
