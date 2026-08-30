# Nest-Owned Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship NestJS-owned register/login/refresh/logout, dual cookie+Bearer transport, dev email verify, and `GET /me` — replacing Supabase Auth for formation Slice 1.

**Architecture:** Nest is the IdP. Access JWTs (`sub` = `users.id`) plus DB-backed refresh token hashes. Auth responses always set `cs_access` / `cs_refresh` httpOnly cookies **and** return tokens in JSON (web uses cookies; native will use Bearer). Guard accepts either. Web Task 8 uses `credentials: 'include'` — no Supabase clients.

**Tech Stack:** NestJS 11/12, Drizzle, Postgres, `jose`, `@node-rs/argon2`, `cookie-parser`, Zod, Vitest, Next.js (`apps/web` for Task 8 deltas).

**Spec:** `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`  
**Product:** `docs/product/scope.md`  
**Supersedes:** formation plan Tasks 5 & 8 Supabase Auth steps

## Global Constraints

- Authoritative product: `docs/product/scope.md` — private-first, couple-centric.
- Do not implement `docs/product/future-roadmap.md` items.
- **Heavily comment** committed source and plan code: explain *why* (security, dual transport, why no `auth_user_id`), not obvious syntax.
- Prefer small files; one responsibility per module/file.
- TypeScript strict; no `any` without justification.
- Authorization only on the server; never trust the client for membership.
- Passwords: **argon2id**; never log passwords or raw refresh tokens.
- Dev verify only when `ENABLE_DEV_AUTH_ENDPOINTS=true` (never in prod).
- Cookie names: `cs_access`, `cs_refresh`; SameSite=Lax; Secure when `COOKIE_SECURE=true`.
- **Git commits:** only when the user explicitly asks. Skip commit steps unless told to commit.
- Prefer TDD: failing test → implement → pass.
- Package name is `@couple-space/database` (not `packages/db`).

## File structure (create/modify)

```
packages/database/
  src/schema/users.ts              # drop auth_user_id; add password_hash, date_of_birth; unique email
  src/schema/refresh-tokens.ts     # new
  src/schema/index.ts
  drizzle/0001_*.sql               # generated migration

apps/api/
  src/config/env.ts                # JWT + cookie + TTL + ENABLE_DEV_AUTH_ENDPOINTS
  src/main.ts                      # cookie-parser
  src/app.module.ts                # AuthModule, UsersModule, AuditModule
  src/auth/auth.module.ts
  src/auth/auth-user.ts
  src/auth/password.ts             # hash/verify
  src/auth/token.service.ts        # access JWT + refresh issue/rotate/revoke
  src/auth/cookies.ts              # set/clear auth cookies
  src/auth/auth.service.ts
  src/auth/auth.controller.ts
  src/auth/jwt-auth.guard.ts
  src/auth/current-user.decorator.ts
  src/auth/dto/register.dto.ts     # zod schemas or class + zod
  src/auth/dto/login.dto.ts
  src/auth/password.test.ts
  src/auth/token.service.test.ts
  src/auth/auth.service.test.ts
  src/users/users.module.ts
  src/users/users.controller.ts    # GET /me
  src/users/users.service.ts
  src/audit/audit.module.ts
  src/audit/audit.service.ts

apps/web/                          # Task 8 deltas only
  lib/api.ts
  app/login/page.tsx
  app/signup/page.tsx

.env.example                       # Nest auth vars; remove Supabase auth keys from auth path
```

---

### Task 1: Schema — drop `auth_user_id`, add password + DOB + refresh_tokens

**Files:**
- Modify: `packages/database/src/schema/users.ts`
- Create: `packages/database/src/schema/refresh-tokens.ts`
- Modify: `packages/database/src/schema/index.ts`
- Modify: `.env.example` (auth-related keys)

**Interfaces:**
- Produces: Drizzle tables `users`, `refreshTokens` exported from `@couple-space/database`

- [ ] **Step 1: Replace users schema**

Why: Nest is the IdP now. A separate `auth_user_id` only made sense for an external issuer (Supabase). JWT `sub` will equal `users.id`.

`packages/database/src/schema/users.ts`:

```ts
import {
  boolean,
  date,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Application user = auth subject.
 * - id: primary key AND JWT `sub` (no separate auth_user_id).
 * - password_hash: argon2id string; never select this into API responses.
 * - email_verified: product gate for invite accept / couple activation.
 * - date_of_birth: required at register; age-gate policy is a later product decision.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  displayName: text("display_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 2: Add refresh_tokens schema**

`packages/database/src/schema/refresh-tokens.ts`:

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Store only a HASH of the refresh token.
 * If the DB leaks, attackers still cannot replay refresh tokens without the raw value
 * that lived in the httpOnly cookie / native secure storage.
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 3: Export from schema barrel**

`packages/database/src/schema/index.ts`:

```ts
export * from "./users.js";
export * from "./couples.js";
export * from "./couple-memberships.js";
export * from "./couple-invitations.js";
export * from "./audit-events.js";
export * from "./refresh-tokens.js";
```

- [ ] **Step 4: Generate + apply migration**

From repo root (loads `DATABASE_URL` from root `.env` via drizzle config):

```bash
pnpm --filter @couple-space/database generate
pnpm --filter @couple-space/database migrate
pnpm --filter @couple-space/database build
```

Expected: new SQL under `packages/database/drizzle/`; tables updated; `\d users` shows no `auth_user_id`, has `password_hash` + `date_of_birth`; `refresh_tokens` exists.

**Local note:** If migrate fails because old rows lack new NOT NULL columns, truncate empty formation tables (`users`, etc.) on the local DB and re-run migrate — Slice 1 local data is disposable.

- [ ] **Step 5: Update `.env.example` for Nest auth**

Replace Supabase-auth-oriented keys with:

```bash
# Postgres
DATABASE_URL=

# API
API_PORT=8080
CORS_ORIGIN=http://localhost:3000

# Nest-owned auth (see docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md)
JWT_SECRET=
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
COOKIE_SECURE=false
ENABLE_DEV_AUTH_ENDPOINTS=true

# Formation (later tasks)
INVITE_TTL_HOURS=72
INVITE_RATE_LIMIT_PER_HOUR=10

# Web
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Also add the same auth keys to your local root `.env` (do not commit `.env`) with a long random `JWT_SECRET`.

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add packages/database .env.example
git commit -m "feat(database): nest auth user fields and refresh_tokens"
```

---

### Task 2: API deps + env validation

**Files:**
- Modify: `apps/api/package.json` (via pnpm add)
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Produces: `loadEnv()` returning JWT/cookie/TTL/dev-flag fields

- [ ] **Step 1: Install dependencies**

```bash
pnpm --filter @couple-space/api add jose @node-rs/argon2 cookie-parser
pnpm --filter @couple-space/api add -D @types/cookie-parser
```

- [ ] **Step 2: Expand env schema**

`apps/api/src/config/env.ts`:

```ts
import { z } from "zod";

/**
 * Fail fast at boot if auth secrets/TTLs are missing.
 * ACCESS/REFRESH TTLs are seconds (numbers) so juniors do not parse duration strings.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(8080),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().positive().default(2_592_000),
  // When true, Set-Cookie includes Secure (required for HTTPS / production).
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // MUST be false in any shared/staging/prod environment.
  ENABLE_DEV_AUTH_ENDPOINTS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
```

- [ ] **Step 3: Enable cookie-parser**

`apps/api/src/main.ts` — after creating the app, before listen:

```ts
import "reflect-metadata";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../../../.env") });

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  // Required so JwtAuthGuard can read cs_access / cs_refresh.
  app.use(cookieParser());

  // credentials: true is required for browser cookie auth from Next.js.
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  await app.listen(env.API_PORT);
}

await bootstrap();
```

- [ ] **Step 4: Smoke boot**

```bash
pnpm --filter @couple-space/api dev
```

Expected: API starts; missing `JWT_SECRET` should throw Zod error — confirm secret is set in `.env`.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "chore(api): auth deps, env, cookie-parser"
```

---

### Task 3: Password helpers (TDD)

**Files:**
- Create: `apps/api/src/auth/password.ts`
- Create: `apps/api/src/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(hash: string, plain: string): Promise<boolean>`

- [ ] **Step 1: Write failing tests**

`apps/api/src/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password helpers", () => {
  it("hashes and verifies a correct password", async () => {
    // We assert verify(true) — not that the hash equals the plain text.
    const hash = await hashPassword("correct-horse-battery-1!");
    expect(hash).not.toBe("correct-horse-battery-1!");
    expect(await verifyPassword(hash, "correct-horse-battery-1!")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    // Guards against always-returning-true bugs in verify.
    const hash = await hashPassword("correct-horse-battery-1!");
    expect(await verifyPassword(hash, "wrong-password!!!!")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm --filter @couple-space/api test src/auth/password.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`apps/api/src/auth/password.ts`:

```ts
import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id is the recommended password KDF for new systems (memory-hard).
 * Never store or log the plaintext password.
 */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  return verify(passwordHash, plain);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm --filter @couple-space/api test src/auth/password.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api/src/auth/password.ts apps/api/src/auth/password.test.ts
git commit -m "feat(api): argon2id password helpers"
```

---

### Task 4: TokenService — access JWT + refresh rotate/revoke (TDD)

**Files:**
- Create: `apps/api/src/auth/auth-user.ts`
- Create: `apps/api/src/auth/token.service.ts`
- Create: `apps/api/src/auth/token.service.test.ts`

**Interfaces:**
- Produces:
  - `AuthUser = { appUserId: string; email: string; emailVerified: boolean }`
  - `TokenService.issueTokenPair(user)`, `rotateRefresh(rawRefresh)`, `revokeRefresh(rawRefresh)`, `verifyAccessToken(jwt)`

- [ ] **Step 1: AuthUser type**

`apps/api/src/auth/auth-user.ts`:

```ts
/**
 * Attached to requests after JwtAuthGuard succeeds.
 * appUserId === users.id === access JWT `sub`.
 * Keep this lean for authorization; profile fields live on GET /me.
 */
export type AuthUser = {
  appUserId: string;
  email: string;
  emailVerified: boolean;
};
```

- [ ] **Step 2: Write failing TokenService tests**

Use an in-memory fake DB shape (only the methods TokenService needs). Full file:

`apps/api/src/auth/token.service.test.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { createTokenServiceForTests } from "./token.service.js";

function sha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

describe("TokenService", () => {
  const jwtSecret = "test-secret-at-least-32-characters!!";
  const env = {
    JWT_SECRET: jwtSecret,
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_SECONDS: 3600,
  };

  const inserted: Array<Record<string, unknown>> = [];
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          returning: vi.fn(async () => [{ id: "rt-1", ...row }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    inserted.length = 0;
  });

  it("issueTokenPair stores only a hash of the refresh token", async () => {
    // Security invariant: raw refresh must never be written to Postgres.
    const service = createTokenServiceForTests(db as never, env as never);
    const pair = await service.issueTokenPair({
      id: "user-1",
      email: "a@example.com",
      emailVerified: false,
    });

    expect(pair.accessToken.length).toBeGreaterThan(20);
    expect(pair.refreshToken.length).toBeGreaterThan(20);
    expect(inserted[0]?.tokenHash).toBe(sha256(pair.refreshToken));
    expect(inserted[0]?.tokenHash).not.toBe(pair.refreshToken);
  });

  it("verifyAccessToken returns AuthUser claims", async () => {
    const service = createTokenServiceForTests(db as never, env as never);
    const pair = await service.issueTokenPair({
      id: "user-1",
      email: "a@example.com",
      emailVerified: true,
    });
    const user = await service.verifyAccessToken(pair.accessToken);
    expect(user).toEqual({
      appUserId: "user-1",
      email: "a@example.com",
      emailVerified: true,
    });
  });
});
```

- [ ] **Step 3: Run — expect fail**

```bash
pnpm --filter @couple-space/api test src/auth/token.service.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement TokenService**

`apps/api/src/auth/token.service.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { refreshTokens, users } from "@couple-space/database";
import type { Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { loadEnv, type Env } from "../config/env.js";
import type { AuthUser } from "./auth-user.js";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Fast one-way hash for refresh-token lookup.
 * Refresh tokens are high-entropy random bytes, so SHA-256 is fine here.
 * (Passwords use argon2id instead — never hash passwords with SHA-256.)
 */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

@Injectable()
export class TokenService {
  private env: Env = loadEnv();
  private secret: Uint8Array = new TextEncoder().encode(this.env.JWT_SECRET);

  constructor(@Inject(DB) private readonly db: Db) {}

  async issueTokenPair(user: {
    id: string;
    email: string;
    emailVerified: boolean;
  }): Promise<TokenPair> {
    // Access token is a short-lived JWT. `sub` MUST be users.id.
    const accessToken = await new SignJWT({
      email: user.email,
      email_verified: user.emailVerified,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.secret);

    // Opaque refresh token (not a JWT) so we can revoke it in Postgres.
    const refreshToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + this.env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(accessToken: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(accessToken, this.secret);
    if (!payload.sub || typeof payload.email !== "string") {
      throw new Error("invalid_access_token");
    }
    return {
      appUserId: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
    };
  }

  /**
   * Rotate: revoke the presented refresh, then issue a brand-new pair.
   * Limits damage if a refresh token is stolen and replayed later.
   */
  async rotateRefresh(
    rawRefresh: string,
  ): Promise<TokenPair & { userId: string }> {
    const tokenHash = hashToken(rawRefresh);
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      throw new Error("invalid_refresh");
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));

    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    const user = userRows[0];
    if (!user) {
      throw new Error("invalid_refresh");
    }

    const pair = await this.issueTokenPair({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });
    return { ...pair, userId: user.id };
  }

  async revokeRefresh(rawRefresh: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(rawRefresh)));
  }
}

/**
 * Unit-test factory: Nest DI is not running in Vitest, so we inject a fake db
 * and a fixed env (avoids depending on the developer's real .env).
 */
export function createTokenServiceForTests(db: Db, env: Env): TokenService {
  const service = new TokenService(db);
  (service as unknown as { env: Env }).env = env;
  (service as unknown as { secret: Uint8Array }).secret = new TextEncoder().encode(
    env.JWT_SECRET,
  );
  return service;
}
```

Update the test file to call `createTokenServiceForTests(db as never, env as never)` instead of `new TokenService(...)`.

- [ ] **Step 5: Run tests — pass**

```bash
pnpm --filter @couple-space/api test src/auth/token.service.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add apps/api/src/auth
git commit -m "feat(api): access JWT and refresh token rotation"
```

---

### Task 5: Cookies helper + Zod DTOs

**Files:**
- Create: `apps/api/src/auth/cookies.ts`
- Create: `apps/api/src/auth/dto/register.schema.ts`
- Create: `apps/api/src/auth/dto/login.schema.ts`

**Interfaces:**
- Produces: `setAuthCookies(res, pair)`, `clearAuthCookies(res)`, register/login zod schemas

- [ ] **Step 1: Cookie helpers**

`apps/api/src/auth/cookies.ts`:

```ts
import type { Response } from "express";
import { loadEnv } from "../config/env.js";
import type { TokenPair } from "./token.service.js";

export const ACCESS_COOKIE = "cs_access";
export const REFRESH_COOKIE = "cs_refresh";

/**
 * Dual transport: browsers store tokens in httpOnly cookies (not readable by JS).
 * Native apps ignore Set-Cookie and use the JSON body instead.
 */
export function setAuthCookies(res: Response, pair: TokenPair): void {
  const env = loadEnv();
  const common = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
  };

  res.cookie(ACCESS_COOKIE, pair.accessToken, {
    ...common,
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, pair.refreshToken, {
    ...common,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const env = loadEnv();
  const common = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
  };
  res.clearCookie(ACCESS_COOKIE, common);
  res.clearCookie(REFRESH_COOKIE, common);
}
```

- [ ] **Step 2: Register / login schemas**

`apps/api/src/auth/dto/register.schema.ts`:

```ts
import { z } from "zod";

/**
 * Password policy: min 12 + upper/lower/digit.
 * Product profile: displayName + dateOfBirth required at signup.
 */
export const registerSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z
    .string()
    .min(12)
    .regex(/[a-z]/, "password needs a lowercase letter")
    .regex(/[A-Z]/, "password needs an uppercase letter")
    .regex(/[0-9]/, "password needs a digit"),
  displayName: z.string().trim().min(1).max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

`apps/api/src/auth/dto/login.schema.ts`:

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add apps/api/src/auth/cookies.ts apps/api/src/auth/dto
git commit -m "feat(api): auth cookies and validation schemas"
```

---

### Task 6: AuditService (minimal)

**Files:**
- Create: `apps/api/src/audit/audit.service.ts`
- Create: `apps/api/src/audit/audit.module.ts`

**Interfaces:**
- Produces: `AuditService.append({ actorUserId, action, entityType, entityId, metadata? })`

- [ ] **Step 1: Implement**

`apps/api/src/audit/audit.service.ts`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { auditEvents } from "@couple-space/database";
import type { Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Security-sensitive actions only. Never put passwords or raw tokens in metadata.
   */
  async append(input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(auditEvents).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });
  }
}
```

`apps/api/src/audit/audit.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service.js";

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 2: Commit (only if user asked)**

```bash
git add apps/api/src/audit
git commit -m "feat(api): audit event writer"
```

---

### Task 7: AuthService + AuthController (register/login/refresh/logout/dev-verify)

**Files:**
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.service.test.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`

**Interfaces:**
- Produces HTTP:
  - `POST /auth/register|login|refresh|logout`
  - `POST /auth/dev/verify` (flag-gated)
- Body always includes `{ user, accessToken, refreshToken }` on register/login/refresh (plus Set-Cookie)

- [ ] **Step 1: Failing AuthService register test**

`apps/api/src/auth/auth.service.test.ts` — assert register rejects duplicate email with reason `email_taken`, and successful register returns user with `emailVerified: false`. Mock `db` / `TokenService` / `AuditService` as needed. (Implementer: write at least two tests — create success path with mocks, and email_taken path.)

Minimal success-path sketch:

```ts
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";

describe("AuthService.register", () => {
  it("creates user with emailVerified false and issues tokens", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [
            {
              id: "u1",
              email: "a@example.com",
              emailVerified: false,
              displayName: "Ada",
              dateOfBirth: "1990-01-01",
            },
          ]),
        })),
      })),
    };
    const tokens = {
      issueTokenPair: vi.fn(async () => ({
        accessToken: "access",
        refreshToken: "refresh",
      })),
    };
    const audit = { append: vi.fn(async () => undefined) };

    const service = new AuthService(
      db as never,
      tokens as never,
      audit as never,
    );

    const result = await service.register({
      email: "a@example.com",
      password: "CorrectHorse1!",
      displayName: "Ada",
      dateOfBirth: "1990-01-01",
    });

    expect(result.user.emailVerified).toBe(false);
    expect(result.accessToken).toBe("access");
    expect(audit.append).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm --filter @couple-space/api test src/auth/auth.service.test.ts
```

- [ ] **Step 3: Implement AuthService**

`apps/api/src/auth/auth.service.ts`:

```ts
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users } from "@couple-space/database";
import type { Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import type { RegisterInput } from "./dto/register.schema.js";
import type { LoginInput } from "./dto/login.schema.js";
import { hashPassword, verifyPassword } from "./password.js";
import { TokenService, type TokenPair } from "./token.service.js";

export type PublicUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  dateOfBirth: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: RegisterInput,
  ): Promise<TokenPair & { user: PublicUser }> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing[0]) {
      // Stable machine-readable reason for clients.
      throw new ConflictException({ reason: "email_taken" });
    }

    const passwordHash = await hashPassword(input.password);
    const created = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        dateOfBirth: input.dateOfBirth,
        emailVerified: false,
      })
      .returning();

    const row = created[0]!;
    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: row.id,
      action: "auth.register",
      entityType: "user",
      entityId: row.id,
    });

    return {
      ...pair,
      user: {
        id: row.id,
        email: row.email,
        emailVerified: row.emailVerified,
        displayName: row.displayName,
        dateOfBirth: row.dateOfBirth,
      },
    };
  }

  async login(input: LoginInput): Promise<TokenPair & { user: PublicUser }> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    const row = rows[0];

    // Same error whether missing user or bad password — reduces email enumeration.
    const ok =
      row && (await verifyPassword(row.passwordHash, input.password));
    if (!row || !ok) {
      throw new UnauthorizedException({ reason: "invalid_credentials" });
    }

    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: row.id,
      action: "auth.login",
      entityType: "user",
      entityId: row.id,
    });

    return {
      ...pair,
      user: {
        id: row.id,
        email: row.email,
        emailVerified: row.emailVerified,
        displayName: row.displayName,
        dateOfBirth: row.dateOfBirth,
      },
    };
  }

  async refresh(rawRefresh: string): Promise<TokenPair & { user: PublicUser }> {
    try {
      const rotated = await this.tokens.rotateRefresh(rawRefresh);
      const rows = await this.db
        .select()
        .from(users)
        .where(eq(users.id, rotated.userId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new UnauthorizedException({ reason: "invalid_refresh" });
      }
      return {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        user: {
          id: row.id,
          email: row.email,
          emailVerified: row.emailVerified,
          displayName: row.displayName,
          dateOfBirth: row.dateOfBirth,
        },
      };
    } catch {
      throw new UnauthorizedException({ reason: "invalid_refresh" });
    }
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (rawRefresh) {
      await this.tokens.revokeRefresh(rawRefresh);
    }
  }

  async devVerify(userId: string): Promise<PublicUser> {
    const updated = await this.db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    const row = updated[0]!;
    await this.audit.append({
      actorUserId: userId,
      action: "auth.dev_verify",
      entityType: "user",
      entityId: userId,
    });
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
      displayName: row.displayName,
      dateOfBirth: row.dateOfBirth,
    };
  }
}
```

- [ ] **Step 4: AuthController**

`apps/api/src/auth/auth.controller.ts`:

```ts
import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { loadEnv } from "../config/env.js";
import { AuthService } from "./auth.service.js";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "./cookies.js";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthUser } from "./auth-user.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { loginSchema } from "./dto/login.schema.js";
import { registerSchema } from "./dto/register.schema.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = registerSchema.parse(body);
    const result = await this.auth.register(input);
    // Dual transport: cookies for web + JSON for native.
    setAuthCookies(res, result);
    return result;
  }

  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = loginSchema.parse(body);
    const result = await this.auth.login(input);
    setAuthCookies(res, result);
    return result;
  }

  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw =
      body?.refreshToken ??
      (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!raw) {
      clearAuthCookies(res);
      throw new ForbiddenException({ reason: "invalid_refresh" });
    }
    const result = await this.auth.refresh(raw);
    setAuthCookies(res, result);
    return result;
  }

  @Post("logout")
  async logout(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw =
      body?.refreshToken ??
      (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    await this.auth.logout(raw);
    clearAuthCookies(res);
    return { ok: true };
  }

  /**
   * TEMPORARY: stands in for "click link in verification email".
   * Remove/replace when a mailer + verify-token flow exists.
   * Disabled unless ENABLE_DEV_AUTH_ENDPOINTS=true.
   */
  @Post("dev/verify")
  @UseGuards(JwtAuthGuard)
  async devVerify(@CurrentUser() user: AuthUser) {
    if (!loadEnv().ENABLE_DEV_AUTH_ENDPOINTS) {
      throw new ForbiddenException({ reason: "dev_auth_disabled" });
    }
    return this.auth.devVerify(user.appUserId);
  }
}
```

Note: `JwtAuthGuard` / `CurrentUser` are created in Task 8 — if compile order blocks you, implement Task 8 before finishing this controller's `dev/verify`, or temporarily comment that route until Task 8 lands. Prefer implementing Task 8 guard next immediately.

- [ ] **Step 5: AuthModule**

```ts
import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard],
  exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}
```

- [ ] **Step 6: Run AuthService tests — pass**

```bash
pnpm --filter @couple-space/api test src/auth/auth.service.test.ts
```

- [ ] **Step 7: Commit (only if user asked)**

```bash
git add apps/api/src/auth apps/api/src/audit
git commit -m "feat(api): register login refresh logout and dev verify"
```

---

### Task 8: JwtAuthGuard + CurrentUser + GET /me

**Files:**
- Create: `apps/api/src/auth/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/current-user.decorator.ts`
- Create: `apps/api/src/users/users.service.ts`
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/users.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `@UseGuards(JwtAuthGuard) @CurrentUser() user: AuthUser`
- `GET /me` → profile + `couple: null`

- [ ] **Step 1: Guard + decorator**

`apps/api/src/auth/jwt-auth.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { ACCESS_COOKIE } from "./cookies.js";
import { TokenService } from "./token.service.js";
import type { AuthUser } from "./auth-user.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { authUser?: AuthUser }
    >();

    // Prefer Authorization for native; fall back to cookie for web.
    const header = req.headers.authorization;
    const bearer =
      header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    const cookieToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    const accessToken = bearer ?? cookieToken;

    if (!accessToken) {
      throw new UnauthorizedException();
    }

    try {
      req.authUser = await this.tokens.verifyAccessToken(accessToken);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

`apps/api/src/auth/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./auth-user.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ authUser: AuthUser }>();
    return req.authUser;
  },
);
```

- [ ] **Step 2: Users GET /me**

`apps/api/src/users/users.service.ts`:

```ts
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users } from "@couple-space/database";
import type { Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getMe(appUserId: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, appUserId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException();
    }
    // couple: null until formation Task 6 wires membership lookup.
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
      displayName: row.displayName,
      dateOfBirth: row.dateOfBirth,
      couple: null as null,
    };
  }
}
```

`apps/api/src/users/users.controller.ts`:

```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { UsersService } from "./users.service.js";

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.appUserId);
  }
}
```

`apps/api/src/users/users.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 3: Wire AppModule**

`apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DbModule } from "./db/db.module.js";
import { HealthController } from "./health.controller.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [DbModule, AuditModule, AuthModule, UsersModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: Manual smoke (API)**

With `ENABLE_DEV_AUTH_ENDPOINTS=true` and API running:

```bash
# Register
curl -s -c /tmp/cs.jar -H 'Content-Type: application/json' \
  -d '{"email":"a@example.com","password":"CorrectHorse1!","displayName":"Ada","dateOfBirth":"1990-01-01"}' \
  http://localhost:8080/auth/register | tee /tmp/reg.json

# Dev verify (cookie jar)
curl -s -b /tmp/cs.jar -X POST http://localhost:8080/auth/dev/verify

# /me via cookie
curl -s -b /tmp/cs.jar http://localhost:8080/me

# /me via Bearer (native-style) — use accessToken from /tmp/reg.json
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/reg.json','utf8')).accessToken)")
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/me

# Unauthenticated
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/me
# Expected: 401
```

Expected: register returns user + tokens; after verify, `emailVerified: true`; `/me` works with cookie and Bearer; bare `/me` is 401.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api/src
git commit -m "feat(api): JWT guard and GET /me"
```

---

### Task 9: Web deltas (formation Task 8 replacement)

**Files:**
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/signup/page.tsx`
- Do **not** add `@supabase/*`

**Interfaces:**
- Produces: `apiFetch` with `credentials: 'include'`; login/signup forms posting to Nest

- [ ] **Step 1: apiFetch**

`apps/web/lib/api.ts`:

```ts
/**
 * Web auth uses Nest httpOnly cookies.
 * Always include credentials so the browser sends cs_access / cs_refresh.
 * Do NOT put access tokens in localStorage for the web client.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Signup page (minimal)**

`apps/web/app/signup/page.tsx` — form fields: email, password, displayName, dateOfBirth; on submit `apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(...) })` then `apiFetch('/auth/dev/verify', { method: 'POST' })` in development (comment that mailer replaces this), then `router.push('/couple')` or `/` until couple routes exist.

Include heavy comments in the file explaining why `credentials` matter and why dev verify is temporary.

- [ ] **Step 3: Login page**

`apps/web/app/login/page.tsx` — email + password → `POST /auth/login` → redirect.

- [ ] **Step 4: Manual web check**

Set `NEXT_PUBLIC_API_URL=http://localhost:8080` in web env or `.env.local`. Sign up → verify → call `/me` from a button or network tab with cookies present.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/web/lib/api.ts apps/web/app/login apps/web/app/signup
git commit -m "feat(web): nest auth login and signup without supabase"
```

---

### Task 10: Note formation plan + definition of done

**Files:**
- Modify (short note at top of Task 5/8 sections): `docs/superpowers/plans/2026-08-29-couple-formation.md` — add a callout that Tasks 5 & 8 are superseded by this plan / auth design (do not execute old Supabase steps).

- [ ] **Step 1: Add supersession callout**

At the top of formation Task 5 and Task 8 in that file, insert:

```markdown
> **Superseded:** Use `docs/superpowers/plans/2026-08-30-nest-owned-auth.md` and `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md` instead of Supabase Auth steps below.
```

- [ ] **Step 2: Verify definition of done (from design §11)**

Checklist:

- [ ] Register creates user with hash, displayName, DOB, `email_verified=false`
- [ ] Dev verify (flag on) sets verified true
- [ ] `/me` cookie + Bearer work; unauthenticated 401
- [ ] Refresh rotates; old refresh fails
- [ ] Logout clears session
- [ ] Dev verify unavailable when flag false
- [ ] No Supabase auth packages in web

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add docs/superpowers/plans
git commit -m "docs: point formation Tasks 5/8 at nest-owned auth plan"
```

---

## Plan self-review

**Spec coverage:** Schema (§5), env (§5.4), register profile fields, argon2id, cookies+JSON dual transport, refresh rotation, guard cookie|Bearer, `/me`, dev verify + flag, audit actions, Task 8 web deltas, heavy comments (§13). Platform onboarding docs (§14) intentionally out of scope.

**Placeholders:** None intentional. Web signup/login pages are described with required fields and API calls; implementers should write full JSX with comments (not left as TBD).

**Type consistency:** `AuthUser.appUserId` = `users.id` = JWT `sub`; cookie names `cs_access` / `cs_refresh`; public user includes `dateOfBirth` as `YYYY-MM-DD` string matching Drizzle `date` column string mode.
