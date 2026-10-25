import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  notificationsForSessionEvent,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
  type SessionEvent,
} from "@couple-space/domain";
import { pushSubscriptions, users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import type { AuthUser } from "../auth/auth-user.types.js";
import { PUSH, type PushPort } from "./push.port.js";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(PUSH) private readonly push: PushPort,
  ) {}

  async subscribe(user: AuthUser, input: PushSubscriptionInput) {
    const values = {
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    };
    await this.db
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  }

  async unsubscribe(user: AuthUser, input: RemovePushSubscriptionInput) {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, input.endpoint),
          eq(pushSubscriptions.userId, user.id),
        ),
      );
  }

  /**
   * Sends whatever the domain rules say a session event deserves.
   *
   * @remarks
   * Never throws: callers fire and forget, so a push outage can't fail or slow
   * an answer or a reveal. Logs counts only, never the payload.
   */
  async notifySessionEvent(input: {
    event: SessionEvent;
    memberIds: string[];
  }): Promise<void> {
    if (input.memberIds.length < 2) return;
    try {
      const rows = await this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, input.memberIds));
      const targets = notificationsForSessionEvent({
        event: input.event,
        memberIds: input.memberIds,
        names: Object.fromEntries(rows.map((r) => [r.id, r.displayName])),
      });
      for (const target of targets) {
        await this.sendToUsers(
          [target.toUserId],
          JSON.stringify(target.notification),
        );
      }
    } catch (error) {
      this.logger.warn(
        `Push for session ${input.event.sessionId} failed: ${error}`,
      );
    }
  }

  private async sendToUsers(userIds: string[], payload: string) {
    const targets = await this.db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    const results = await Promise.allSettled(
      targets.map((target) => this.push.send(target, payload)),
    );

    const gone = targets
      .filter((_, i) => {
        const result = results[i];
        return result.status === "fulfilled" && result.value === "gone";
      })
      .map((target) => target.endpoint);

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      this.logger.warn(`${failed} of ${targets.length} pushes failed`);
    }

    if (gone.length > 0) {
      await this.db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpoint, gone));
    }
  }
}
