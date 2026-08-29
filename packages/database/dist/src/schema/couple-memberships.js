import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { couples } from "./couples.js";
import { users } from "./users.js";
export const coupleMemberships = pgTable("couple_memberships", {
    id: uuid("id").primaryKey().defaultRandom(),
    coupleId: uuid("couple_id")
        .notNull()
        .references(() => couples.id),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),
    status: text("status").notNull(), // MembershipStatus
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => [
    uniqueIndex("couple_memberships_one_active_per_user")
        .on(t.userId)
        .where(sql `${t.status} = 'active'`),
]);
