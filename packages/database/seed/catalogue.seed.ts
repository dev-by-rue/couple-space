import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { createDb } from "../src/client.js";
import { promptThemes, prompts } from "../src/schema/index.js";
import { themeRows, promptRows } from "./catalogue.data.js";

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
        themeId: sql`excluded.theme_id`,
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
});

console.log(`seeded ${themeRows.length} themes, ${promptRows.length} prompts`);
await db.$client.end();
