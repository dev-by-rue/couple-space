import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { createDb } from "../src/client.js";
import {
  promptTagLinks,
  promptTags,
  promptThemes,
  prompts,
} from "../src/schema/index.js";
import {
  promptRows,
  promptTagLinkRows,
  tagRows,
  themeRows,
} from "./catalogue/index.js";

const here = dirname(fileURLToPath(import.meta.url));
config({
  path: resolve(here, "../../../.env"),
});

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const db = createDb(url);

await db.transaction(async (tx) => {
  await tx
    .insert(promptThemes)
    .values(themeRows)
    .onConflictDoUpdate({
      target: promptThemes.id,
      set: {
        title: sql`excluded.title`,
        slug: sql`excluded.slug`,
        description: sql`excluded.description`,
        symbol: sql`excluded.symbol`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: new Date(),
      },
    });

  await tx
    .insert(prompts)
    .values(promptRows)
    .onConflictDoUpdate({
      target: prompts.id,
      set: {
        key: sql`excluded.key`,
        themeId: sql`excluded.theme_id`,
        depth: sql`excluded.depth`,
        parentPromptId: sql`excluded.parent_prompt_id`,
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        text: sql`excluded.text`,
        kind: sql`excluded.kind`,
        sortOrder: sql`excluded.sort_order`,
        // Keep the first retirement date on reruns; clear it to un-retire.
        retiredAt: sql`case when excluded.retired_at is null then null else coalesce(${prompts.retiredAt}, excluded.retired_at) end`,
        updatedAt: new Date(),
      },
    });

  await tx
    .insert(promptTags)
    .values(tagRows)
    .onConflictDoUpdate({
      target: promptTags.id,
      set: {
        slug: sql`excluded.slug`,
        label: sql`excluded.label`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: new Date(),
      },
    });

  // The seed owns every link, so replace them all: removing a tag from a question just works.
  await tx.delete(promptTagLinks);
  if (promptTagLinkRows.length > 0) {
    await tx.insert(promptTagLinks).values(promptTagLinkRows);
  }
});

console.log(
  `seeded ${themeRows.length} themes, ${promptRows.length} prompts, ${tagRows.length} tags`,
);
await db.$client.end();
