import {
  type AnyPgColumn,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { promptThemes } from "./prompt-themes.js";
import { sql } from "drizzle-orm";

export const prompts = pgTable(
  "prompts",
  {
    key: text("key").unique(),
    id: uuid("id").primaryKey().defaultRandom(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => promptThemes.id),
    parentPromptId: uuid("parent_prompt_id").references(
      (): AnyPgColumn => prompts.id,
    ),
    title: text("title").notNull(),
    description: text("description").notNull(),
    text: text("text").notNull(),
    kind: text("kind").notNull().default("curated"),
    depth: text("depth"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "prompts_depth_preset",
      sql`${t.depth} is null or ${t.depth} in ('light', 'medium', 'deep')`,
    ),
    check(
      "prompts_catalogue_key_depth",
      sql`${t.kind} not in ('curated', 'follow_up') or (${t.key} is not null and ${t.depth} is not null)`,
    ),
  ],
);
