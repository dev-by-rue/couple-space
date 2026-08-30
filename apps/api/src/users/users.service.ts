import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

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
}
