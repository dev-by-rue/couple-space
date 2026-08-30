import "reflect-metadata";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./config/env.js";
import cookieParser from "cookie-parser";
import { ZodExceptionFilter } from "./common/zod-exception.filter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../../../.env") });

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalFilters(new ZodExceptionFilter());
  
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  await app.listen(env.API_PORT);
}

await bootstrap();
