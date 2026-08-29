import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const couples = pgTable("couples", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull(), // CoupleStatus
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
