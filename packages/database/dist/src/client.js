import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";
export function createDb(connectionString) {
    const client = postgres(connectionString, { prepare: false });
    return drizzle(client, { schema });
}
