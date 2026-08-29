import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { couples } from "./couples.js";
import { users } from "./users.js";
export const coupleInvitations = pgTable("couple_invitations", {
    id: uuid("id").primaryKey().defaultRandom(),
    coupleId: uuid("couple_id")
        .notNull()
        .references(() => couples.id),
    invitedByUserId: uuid("invited_by_user_id")
        .notNull()
        .references(() => users.id),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull(), // InvitationStatus
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});
