import { Global, Module } from "@nestjs/common";
import { createDb, type Db } from "@couple-space/database";
import { loadEnv } from "../config/env.js";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Db => {
        const env = loadEnv();
        return createDb(env.DATABASE_URL);
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
