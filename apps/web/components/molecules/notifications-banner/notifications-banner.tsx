"use client";

import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PushStatus } from "@/hooks/use-push";

type NotificationsBannerProps = {
  /** This device's push state, from `usePushStatusQuery`. */
  status: PushStatus;
  /** True while the device is being subscribed. */
  isEnabling: boolean;
  /** True when the last attempt to turn notifications on failed. */
  isError: boolean;
  /** Must call `Notification.requestPermission()` synchronously. */
  onEnable: () => void;
  /** Hides the banner on this device ("Not now"). */
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
