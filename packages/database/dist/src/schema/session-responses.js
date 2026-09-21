import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { conversationSessions } from "./conversation-sessions.js";
import { users } from "./users.js";
export const sessionResponses = pgTable("session_responses", {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
        .notNull()
        .references(() => conversationSessions.id),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),
    body: text("body").notNull().default(""),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => [
    uniqueIndex("session_responses_session_user_unique").on(t.sessionId, t.userId),
]);
