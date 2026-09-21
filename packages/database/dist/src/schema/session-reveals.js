import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { conversationSessions } from "./conversation-sessions.js";
import { users } from "./users.js";
export const sessionReveals = pgTable("session_reveals", {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
        .notNull()
        .references(() => conversationSessions.id),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),
    revealedAt: timestamp("revealed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => [
    uniqueIndex("session_reveals_session_user_unique").on(t.sessionId, t.userId),
]);
