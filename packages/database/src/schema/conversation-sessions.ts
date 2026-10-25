import {
  AnyPgColumn,
  pgTable,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { couples } from "./couples.js";
import { prompts } from "./prompts.js";

export const conversationSessions = pgTable(
  "conversation_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coupleId: uuid("couple_id")
      .notNull()
      .references(() => couples.id),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    parentSessionId: uuid("parent_session_id").references(
      (): AnyPgColumn => conversationSessions.id,
    ),
  },
  (t) => [
    uniqueIndex("conversation_sessions_parent_prompt_unique").on(
      t.parentSessionId,
      t.promptId,
    ),
  ],
);
