import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Application user = auth subject.
 * - id: primary key AND JWT `sub` (no separate auth_user_id).
 * - password_hash: argon2id string; never select this into API responses.
 * - email_verified: product gate for invite accept / couple activation.
 * - date_of_birth: required at register; age-gate policy is a later product decision.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    displayName: text("display_name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "users_display_name_length",
      sql`length(${t.displayName}) between 1 and 40`,
    ),
  ],
);
