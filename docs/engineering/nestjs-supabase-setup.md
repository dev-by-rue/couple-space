# Add NestJS and connect to hosted Supabase

Step-by-step instructions to add `apps/api` (NestJS) to this pnpm + Turbo monorepo and prove a Postgres connection to your **existing hosted** Supabase project.

**Done when:** API boots, `GET /health` returns ok, and `GET /health/db` successfully runs `select 1` against Supabase.

**Not in this guide:** JWT auth, couple/invite features, Next.js Auth UI, or the full formation schema. Those come later (see `docs/superpowers/plans/2026-08-29-couple-formation.md`).

---

## Prerequisites

- This repo cloned; `pnpm` installed (see root `package.json` → `devEngines.packageManager`)
- Access to your hosted Supabase project dashboard
- Nest CLI available via `pnpm` (you will use `pnpm dlx @nestjs/cli`)

---

## 1. Understand what Supabase gave you vs what Nest needs

The dashboard **“Connect to your project”** snippet usually looks like this (new API keys):

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
```

| Variable | What it is | Needed for this Nest + Postgres guide? |
|---|---|---|
| `SUPABASE_URL` | Project HTTP API URL | No (save for web / Auth client later) |
| `SUPABASE_PUBLISHABLE_KEY` | Low-privilege client key (`sb_publishable_…`; replaces legacy `anon`) | No (web later; never treat as a DB password) |
| `SUPABASE_SECRET_KEY` | Elevated server key (`sb_secret_…`; replaces legacy `service_role`) | No for Drizzle; **server-only** if you use the Supabase JS admin client later |
| `SUPABASE_JWKS_URL` | Public keys to verify user JWTs | No for this guide (use later instead of a shared JWT secret) |

**None of those is the Postgres connection string.** Nest + Drizzle need `DATABASE_URL` from the **Database** settings page.

### 1.1 Get `DATABASE_URL`

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Project Settings → Database** (not the “Connect” API keys snippet).
3. Copy a connection string (URI) that includes the **database password**.

**Which URI to use**

| Purpose | Prefer |
|---|---|
| Nest runtime (this guide) | **Transaction pooler** URI |
| Later: Drizzle migrations / DDL | **Direct** or **Session** URI if the pooler rejects DDL |

You only need a working runtime URI for this guide.

---

## 2. Create root env files

### 2.1 `.env` (local secrets — do not commit)

At the **repo root**, create `.env`. Keep the Connect-snippet vars for later Auth/web work, and add `DATABASE_URL` for Nest:

```bash
# From dashboard “Connect to your project” (API / Auth — not Postgres)
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=

# From Project Settings → Database (required for Nest + Drizzle)
DATABASE_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres

# API
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
```

Paste your real values. Nest only **requires** `DATABASE_URL` (+ `API_PORT` / `CORS_ORIGIN`) for the smoke test in this guide.

Root `.gitignore` already ignores `.env*`. To commit a template later, add `.env.example` and force-add it (`git add -f .env.example`) or narrow the ignore rule.

### 2.2 Optional `.env.example` (safe to commit — empty values only)

```bash
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
DATABASE_URL=
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
```

**Do not** put `SUPABASE_SECRET_KEY` or `DATABASE_URL` in `apps/web` or any `NEXT_PUBLIC_*` / public client env.
---

## 3. Add a minimal DB package

The API will import a shared Drizzle helper from `packages/db` (matches the monorepo layout in the platform design).

### 3.1 Create `packages/db/package.json`

```json
{
  "name": "@couple-space/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

### 3.2 Create `packages/db/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

### 3.3 Create `packages/db/src/client.ts`

`prepare: false` is required when using Supabase’s **transaction** pooler:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client);
}

export type Db = ReturnType<typeof createDb>;
```

### 3.4 Create `packages/db/src/index.ts`

```ts
export * from "./client.js";
```

### 3.5 Install

From repo root:

```bash
pnpm install
```

---

## 4. Scaffold NestJS as `apps/api`

From the **repo root**:

```bash
pnpm dlx @nestjs/cli@11 new api --directory apps/api --package-manager pnpm --skip-git
```

If the CLI creates a nested git repo or unwanted extras, remove them. You want `apps/api` as a workspace package under `apps/*` (already covered by `pnpm-workspace.yaml`).

### 4.1 Rename packages to avoid clashes

`apps/web` is currently named `"couple-space"`. Rename it so it does not collide with a future `@couple-space/*` naming scheme:

In `apps/web/package.json`:

```json
"name": "@couple-space/web"
```

In `apps/api/package.json`:

```json
"name": "@couple-space/api"
```

### 4.2 Add API dependencies

From repo root:

```bash
pnpm --filter @couple-space/api add @couple-space/db zod dotenv
pnpm --filter @couple-space/api add -D @types/node
```

(Nest core packages should already be present from the CLI scaffold.)

### 4.3 Prefer CommonJS for Nest if imports fight ESM

If workspace/`exports` imports misbehave under Nest, set `apps/api/tsconfig.json` `"module": "commonjs"` and use extensionless relative imports inside `apps/api` only. Keep `packages/db` as ESM; Nest’s bundler/runtime usually still resolves `workspace:*` packages.

---

## 5. Wire env, DB module, and health routes

### 5.1 Env validation — `apps/api/src/config/env.ts`

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
```

### 5.2 DB module — `apps/api/src/db/db.module.ts`

```ts
import { Global, Module } from "@nestjs/common";
import { createDb, type Db } from "@couple-space/db";
import { loadEnv } from "../config/env";

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
```

### 5.3 Health controller — `apps/api/src/health.controller.ts`

```ts
import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "@couple-space/db";
import { DB } from "./db/db.module";

@Controller()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get("health")
  health() {
    return { ok: true };
  }

  @Get("health/db")
  async healthDb() {
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, db: true };
    } catch {
      throw new ServiceUnavailableException("database unreachable");
    }
  }
}
```

Add `drizzle-orm` to the API if Nest cannot resolve `sql` via the db package alone:

```bash
pnpm --filter @couple-space/api add drizzle-orm
```

### 5.4 Register modules — `apps/api/src/app.module.ts`

```ts
import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [DbModule],
  controllers: [HealthController],
})
export class AppModule {}
```

Remove or stop using the default `AppController` / `AppService` if the CLI left them in place and they conflict.

### 5.5 Bootstrap — `apps/api/src/main.ts`

Load the **repo root** `.env` before Nest starts (Nest’s cwd is `apps/api`):

```ts
import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";

config({ path: resolve(__dirname, "../../../.env") });

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  await app.listen(env.API_PORT);
}

bootstrap();
```

### 5.6 Dev script

Ensure `apps/api/package.json` has:

```json
"dev": "nest start --watch"
```

Root Turbo already has a `dev` task; you can run the API alone with the filter below.

---

## 6. Verify the connection

Terminal 1:

```bash
pnpm --filter @couple-space/api dev
```

Expected: Nest boots with **no** Zod parse error (missing `DATABASE_URL` would throw).

Terminal 2:

```bash
curl -s localhost:3001/health
curl -s localhost:3001/health/db
```

Expected:

```json
{"ok":true}
{"ok":true,"db":true}
```

If `/health/db` returns `503`, the API is up but Postgres is not reachable — see troubleshooting.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Zod fails on boot | `.env` missing or not loaded | Confirm root `.env` exists; check `dotenv` path in `main.ts` |
| `database unreachable` | Wrong URI / password / network | Re-copy URI from Supabase; URL-encode special characters in the password |
| Prepared-statement / pooler errors | Transaction pooler + prepared statements | Keep `postgres(..., { prepare: false })` in `createDb` |
| Cannot find `@couple-space/db` | Install not run / wrong package name | `pnpm install` from root; check `packages/db/package.json` `name` |
| Nest import / ESM errors | Module format clash | Prefer CommonJS in `apps/api` (see §4.3) |
| Port in use | Something else on 3001 | Change `API_PORT` in `.env` |

---

## 8. Security

- Never commit `.env` or real `DATABASE_URL` / `SUPABASE_SECRET_KEY` values.
- If a secret was pasted into chat, logs, or a ticket, **rotate** it in Supabase (**Settings → API Keys** for `sb_secret_…`; reset the DB password if the URI was exposed).
- Do not put `DATABASE_URL` or `SUPABASE_SECRET_KEY` in `apps/web` or any public/client env.
- `SUPABASE_PUBLISHABLE_KEY` is safe for the browser later; it is not a substitute for `DATABASE_URL`.
- Pooler/direct DB password and secret API keys are server-only (API process).
---

## Next steps

When this smoke test passes:

1. Add Supabase JWT verification (`SUPABASE_JWT_SECRET`) when you need authenticated routes.
2. Follow couple-formation Task 3+ for schema/migrations and product endpoints:  
   `docs/superpowers/plans/2026-08-29-couple-formation.md`
