import postgres from "postgres";
export declare function createDb(connectionString: string): import("drizzle-orm/postgres-js").PostgresJsDatabase<Record<string, never>> & {
    $client: postgres.Sql<{}>;
};
export type Db = ReturnType<typeof createDb>;
