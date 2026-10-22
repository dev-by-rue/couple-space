import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createDb } from "../src/client.js";
import {
  conversationSessions,
  sessionResponses,
  sessionReveals,
} from "../src/schema/index.js";

const here = dirname(fileURLToPath(import.meta.url));
config({
  path: resolve(here, "../../../.env"),
});

// Runs on every api pre-deploy, so it only acts when CLEAR_SESSIONS is set to
// today's UTC date (e.g. 2026-10-22). A variable left behind is a no-op later.
const today = new Date().toISOString().slice(0, 10);
if (process.env.CLEAR_SESSIONS !== today) {
  console.log("clear-sessions: skipped");
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const db = createDb(url);

// Children first: responses and reveals reference the session without cascade.
const deleted = await db.transaction(async (tx) => {
  await tx.delete(sessionReveals);
  await tx.delete(sessionResponses);
  return tx
    .delete(conversationSessions)
    .returning({ id: conversationSessions.id });
});

console.log(`clear-sessions: deleted ${deleted.length} sessions`);
await db.$client.end();
