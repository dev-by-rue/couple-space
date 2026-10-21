export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** `gone` means the push service no longer knows this subscription. */
export type PushResult = "ok" | "gone";

export interface PushPort {
  send(target: PushTarget, payload: string): Promise<PushResult>;
}

export const PUSH = Symbol("PUSH");
