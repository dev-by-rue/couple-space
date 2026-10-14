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

  INVITE_TTL_HOURS: z.coerce.number().positive().default(72),
  INVITE_RATE_LIMIT_PER_HOUR: z.coerce.number().positive().default(10),

  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  EMAIL_VERIFY_TTL_HOURS: z.coerce.number().positive().default(24),
  EMAIL_VERIFY_RESEND_PER_HOUR: z.coerce.number().positive().default(5),
  // Safe defaults so loadEnv() in unit tests (TokenService) passes without SMTP in process.env.
  // Real Ethereal credentials belong in developer .env — see .env.example.
  SMTP_HOST: z.string().min(1).default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1).default("unused"),
  SMTP_PASS: z.string().min(1).default("unused"),
  SMTP_FROM: z.string().min(1).default("noreply@example.com"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Hosts like Railway inject PORT; honour it when API_PORT isn't set.
  return envSchema.parse({
    ...source,
    API_PORT: source.API_PORT ?? source.PORT,
  });
}