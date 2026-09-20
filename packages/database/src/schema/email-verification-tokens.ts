import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Store only a HASH of the email-verification token.
 * Raw token lives in the email link; DB leak must not allow replay without the raw value.
 */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
