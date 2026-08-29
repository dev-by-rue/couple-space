import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
export function createDb(connectionString) {
    const client = postgres(connectionString, { prepare: false });
    return drizzle(client);
}
