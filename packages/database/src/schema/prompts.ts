import {
  AnyPgColumn,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { promptThemes } from "./prompt-themes.js";

export const prompts = pgTable("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  themeId: uuid("theme_id")
    .notNull()
    .references(() => promptThemes.id),
  parentPromptId: uuid("parent_prmopt_id").references(
    (): AnyPgColumn => prompts.id,
  ),
  title: text("title").notNull(),
  description: text("description").notNull(),
  text: text("text").notNull(),
  kind: text("kind").notNull().default("curated"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
});
