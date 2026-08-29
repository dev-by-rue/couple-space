import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "@couple-space/database";
import { DB } from "./db/db.module.js";

@Controller()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get("health")
  health() {
    return { ok: true };
  }

  @Get("health/db")
  async healthDb() {
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, db: true };
    } catch (error) {
      const cause =
        error instanceof Error && "cause" in error
          ? error.cause
          : undefined;
      const detail =
        cause instanceof Error
          ? cause.message
          : error instanceof Error
            ? error.message
            : "unknown";
      throw new ServiceUnavailableException(`database unreachable: ${detail}`);
    }
  }
}
