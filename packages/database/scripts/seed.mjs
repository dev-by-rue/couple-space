import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(url, { prepare: false });
const seedPath = resolve(root, "drizzle/seed-curated-prompts.sql");
await sql.unsafe(readFileSync(seedPath, "utf8"));
await sql.end();
console.log("seed ok");
