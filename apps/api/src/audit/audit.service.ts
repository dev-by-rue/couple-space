import { Inject, Injectable } from "@nestjs/common";
import { auditEvents, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Security-sensitive actions only. Never put passwords or raw tokens in metadata.
   */
  async append(input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(auditEvents).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });
  }
}
