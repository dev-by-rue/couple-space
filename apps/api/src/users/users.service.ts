import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import { UpdateProfileInput } from "@couple-space/domain";

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async getMe(userId: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException();
    }

    // couple: null until formation Task 6 wires membership lookup.
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
      displayName: row.displayName,
      dateOfBirth: row.dateOfBirth,
      couple: null as null,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updatedProfile = await this.db
      .update(users)
      .set({ displayName: input.displayName, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedProfile[0]) throw new NotFoundException();

    await this.audit.append({
      actorUserId: userId,
      action: "user.update_profile",
      entityType: "user",
      entityId: userId,
    });

    return this.getMe(userId);
  }
}
