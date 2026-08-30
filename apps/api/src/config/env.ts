import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(8080),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be 32 characters long'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().default(2592000),
  
  COOKIE_SECURE: z.enum(['true', 'false']).default("false").transform((val) => val === 'true'),
  ENABLE_DEV_AUTH_ENDPOINTS: z.enum(['true', 'false']).default("false").transform((val) => val === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}