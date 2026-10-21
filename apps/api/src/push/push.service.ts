import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  newConversationNotification,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
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
   * Pings the partner's devices that a conversation was started.
   *
   * @remarks
   * Never throws: callers fire and forget, so a push outage can't fail or slow
   * session creation. Logs counts only, never the payload.
   */
  async notifyNewConversation(input: {
    starterId: string;
    partnerIds: string[];
    sessionId: string;
  }): Promise<void> {
    if (input.partnerIds.length === 0) return;
    try {
      const [starter] = await this.db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, input.starterId))
        .limit(1);
      const notification = newConversationNotification({
        starterName: starter?.displayName ?? "Your partner",
        sessionId: input.sessionId,
      });
      await this.sendToUsers(input.partnerIds, JSON.stringify(notification));
    } catch (error) {
      this.logger.warn(`Push for session ${input.sessionId} failed: ${error}`);
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
