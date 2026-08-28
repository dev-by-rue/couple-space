# Couple Formation (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship user registration (via Supabase Auth), partner invitation, and couple activation so two verified users become one active couple.

**Architecture:** NestJS API owns couple/invite rules and verifies Supabase JWTs. Drizzle talks to Supabase Postgres with the service role. Next.js web handles Auth UI and calls the API with the access token. Pure domain helpers in `packages/domain` encode activation/invite invariants for unit tests without the DB.

**Tech Stack:** pnpm + Turbo monorepo, NestJS 11, Drizzle ORM, Supabase (Auth + Postgres), Next.js 16 (`apps/web`), Vitest, Zod, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-08-29-couple-space-platform-design.md`  
**Product:** `docs/product/scope.md`

## Global Constraints

- Authoritative product: `docs/product/scope.md` — private-first, couple-centric; not dating/hookup/anonymous/porn.
- Do not implement or model `docs/product/future-roadmap.md` items.
- Do **not** create Session / Prompt / Community / Moderation tables in this slice.
- TypeScript strict; no `any` without justification.
- Authorization only on the server (NestJS); never trust the client for membership.
- Security-sensitive actions write `AuditEvent` rows; do not log intimate content (N/A this slice beyond emails in audit metadata sparingly).
- Critical mutations are idempotent (especially invite accept).
- At most one **active** `CoupleMembership` per user (DB partial unique index).
- Couple activation requires two active memberships and both users email-verified (`email_confirmed_at` from JWT/user record).
- Membership table shape (not hard-coded partner_a/partner_b-only) so future multi-partner is not prohibitively hard; MVP still enforces exactly two members to activate.
- **Git commits:** only when the user explicitly asks. Skip commit steps during execution unless told to commit.
- Prefer TDD: failing test → implement → pass.

## Scope boundary

**In:** User profile sync, create couple, create/revoke invite, accept invite, activate couple, read own couple status, invite rate limit, audit events, web signup/login/invite/accept UI.

**Out:** Conversation engine, dissolve UX details beyond blocking if needed, stronger ID verification, notifications, mobile app, RLS deep policy design beyond a minimal “deny all for anon” stub if desired.

## File structure (create/modify)

```
packages/domain/
  package.json
  tsconfig.json
  vitest.config.ts
  src/index.ts
  src/couple-status.ts
  src/invitation-status.ts
  src/membership-status.ts
  src/can-accept-invitation.ts
  src/can-activate-couple.ts
  src/can-accept-invitation.test.ts
  src/can-activate-couple.test.ts

packages/db/
  package.json
  tsconfig.json
  drizzle.config.ts
  src/index.ts
  src/client.ts
  src/schema/users.ts
  src/schema/couples.ts
  src/schema/couple-memberships.ts
  src/schema/couple-invitations.ts
  src/schema/audit-events.ts
  src/schema/index.ts

apps/api/
  package.json
  tsconfig.json
  nest-cli.json
  vitest.config.ts
  src/main.ts
  src/app.module.ts
  src/config/env.ts
  src/db/db.module.ts
  src/auth/auth.module.ts
  src/auth/supabase-jwt.guard.ts
  src/auth/current-user.decorator.ts
  src/auth/auth-user.ts
  src/users/users.module.ts
  src/users/users.service.ts
  src/couples/couples.module.ts
  src/couples/couples.controller.ts
  src/couples/couples.service.ts
  src/couples/dto/create-couple.dto.ts
  src/couples/dto/create-invitation.dto.ts
  src/couples/couples.service.test.ts
  src/audit/audit.module.ts
  src/audit/audit.service.ts

apps/web/
  package.json                          # rename to @couple-space/web; add supabase deps
  lib/supabase/client.ts
  lib/supabase/server.ts
  lib/api.ts
  app/login/page.tsx
  app/signup/page.tsx
  app/auth/callback/route.ts
  app/(app)/layout.tsx
  app/(app)/couple/page.tsx
  app/(app)/invite/page.tsx
  app/invite/[token]/page.tsx

.env.example                            # root or apps — document required vars
```

---

### Task 1: Scaffold `packages/domain`

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/vitest.config.ts`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/couple-status.ts`
- Create: `packages/domain/src/invitation-status.ts`
- Create: `packages/domain/src/membership-status.ts`
- Modify: root `package.json` (add `test` script via turbo if missing)
- Modify: `turbo.json` (add `test` task)

**Interfaces:**
- Produces: status string unions exported from `@couple-space/domain`

- [ ] **Step 1: Create package manifest**

```json
{
  "name": "@couple-space/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Add tsconfig + vitest config**

`packages/domain/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`packages/domain/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 3: Add status enums and barrel export**

`packages/domain/src/couple-status.ts`:

```ts
export const CoupleStatuses = [
  "forming",
  "active",
  "dissolving",
  "dissolved",
] as const;

export type CoupleStatus = (typeof CoupleStatuses)[number];
```

`packages/domain/src/invitation-status.ts`:

```ts
export const InvitationStatuses = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;

export type InvitationStatus = (typeof InvitationStatuses)[number];
```

`packages/domain/src/membership-status.ts`:

```ts
export const MembershipStatuses = ["active", "left"] as const;

export type MembershipStatus = (typeof MembershipStatuses)[number];
```

`packages/domain/src/index.ts`:

```ts
export * from "./couple-status.js";
export * from "./invitation-status.js";
export * from "./membership-status.js";
```

- [ ] **Step 4: Wire turbo test + install**

Root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "check-types": "turbo run check-types",
    "test": "turbo run test"
  }
}
```

`turbo.json` add:

```json
"test": {
  "dependsOn": ["^build"],
  "outputs": []
}
```

Run: `pnpm install` from repo root  
Expected: `@couple-space/domain` linked.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add packages/domain package.json turbo.json pnpm-lock.yaml
git commit -m "chore: scaffold @couple-space/domain package"
```

---

### Task 2: Domain invariants — accept invite & activate couple

**Files:**
- Create: `packages/domain/src/can-accept-invitation.ts`
- Create: `packages/domain/src/can-accept-invitation.test.ts`
- Create: `packages/domain/src/can-activate-couple.ts`
- Create: `packages/domain/src/can-activate-couple.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces:
  - `canAcceptInvitation(input: CanAcceptInvitationInput): { ok: true } | { ok: false; reason: string }`
  - `canActivateCouple(input: CanActivateCoupleInput): { ok: true } | { ok: false; reason: string }`

- [ ] **Step 1: Write failing tests for `canAcceptInvitation`**

```ts
// packages/domain/src/can-accept-invitation.test.ts
import { describe, expect, it } from "vitest";
import { canAcceptInvitation } from "./can-accept-invitation.js";

describe("canAcceptInvitation", () => {
  const base = {
    invitationStatus: "pending" as const,
    invitationExpiresAt: new Date(Date.now() + 60_000),
    now: new Date(),
    inviteeEmailVerified: true,
    inviteeHasActiveMembership: false,
    invitationEmail: "partner@example.com",
    inviteeEmail: "partner@example.com",
  };

  it("allows a valid pending invite", () => {
    expect(canAcceptInvitation(base)).toEqual({ ok: true });
  });

  it("rejects when email not verified", () => {
    expect(
      canAcceptInvitation({ ...base, inviteeEmailVerified: false }),
    ).toEqual({ ok: false, reason: "email_unverified" });
  });

  it("rejects when invitee already in an active couple", () => {
    expect(
      canAcceptInvitation({ ...base, inviteeHasActiveMembership: true }),
    ).toEqual({ ok: false, reason: "already_in_couple" });
  });

  it("rejects revoked invites", () => {
    expect(
      canAcceptInvitation({ ...base, invitationStatus: "revoked" }),
    ).toEqual({ ok: false, reason: "not_pending" });
  });

  it("rejects expired invites by status", () => {
    expect(
      canAcceptInvitation({ ...base, invitationStatus: "expired" }),
    ).toEqual({ ok: false, reason: "not_pending" });
  });

  it("rejects when now is past expiresAt", () => {
    expect(
      canAcceptInvitation({
        ...base,
        invitationExpiresAt: new Date(Date.now() - 1000),
      }),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects email mismatch", () => {
    expect(
      canAcceptInvitation({
        ...base,
        inviteeEmail: "other@example.com",
      }),
    ).toEqual({ ok: false, reason: "email_mismatch" });
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `pnpm --filter @couple-space/domain test`  
Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Implement `canAcceptInvitation`**

```ts
// packages/domain/src/can-accept-invitation.ts
import type { InvitationStatus } from "./invitation-status.js";

export type CanAcceptInvitationInput = {
  invitationStatus: InvitationStatus;
  invitationExpiresAt: Date;
  now: Date;
  inviteeEmailVerified: boolean;
  inviteeHasActiveMembership: boolean;
  invitationEmail: string;
  inviteeEmail: string;
};

export type CanAcceptInvitationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canAcceptInvitation(
  input: CanAcceptInvitationInput,
): CanAcceptInvitationResult {
  if (input.invitationStatus !== "pending") {
    return { ok: false, reason: "not_pending" };
  }
  if (input.now.getTime() > input.invitationExpiresAt.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (!input.inviteeEmailVerified) {
    return { ok: false, reason: "email_unverified" };
  }
  if (input.inviteeHasActiveMembership) {
    return { ok: false, reason: "already_in_couple" };
  }
  if (
    input.invitationEmail.trim().toLowerCase() !==
    input.inviteeEmail.trim().toLowerCase()
  ) {
    return { ok: false, reason: "email_mismatch" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Write failing tests for `canActivateCouple`**

```ts
// packages/domain/src/can-activate-couple.test.ts
import { describe, expect, it } from "vitest";
import { canActivateCouple } from "./can-activate-couple.js";

describe("canActivateCouple", () => {
  it("activates when forming with exactly two verified active members", () => {
    expect(
      canActivateCouple({
        coupleStatus: "forming",
        activeMemberships: [
          { emailVerified: true },
          { emailVerified: true },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects if couple not forming", () => {
    expect(
      canActivateCouple({
        coupleStatus: "active",
        activeMemberships: [
          { emailVerified: true },
          { emailVerified: true },
        ],
      }),
    ).toEqual({ ok: false, reason: "not_forming" });
  });

  it("rejects if not exactly two active members", () => {
    expect(
      canActivateCouple({
        coupleStatus: "forming",
        activeMemberships: [{ emailVerified: true }],
      }),
    ).toEqual({ ok: false, reason: "member_count" });
  });

  it("rejects if any member unverified", () => {
    expect(
      canActivateCouple({
        coupleStatus: "forming",
        activeMemberships: [
          { emailVerified: true },
          { emailVerified: false },
        ],
      }),
    ).toEqual({ ok: false, reason: "member_unverified" });
  });
});
```

- [ ] **Step 5: Implement `canActivateCouple` and export**

```ts
// packages/domain/src/can-activate-couple.ts
import type { CoupleStatus } from "./couple-status.js";

export type CanActivateCoupleInput = {
  coupleStatus: CoupleStatus;
  activeMemberships: Array<{ emailVerified: boolean }>;
};

export type CanActivateCoupleResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canActivateCouple(
  input: CanActivateCoupleInput,
): CanActivateCoupleResult {
  if (input.coupleStatus !== "forming") {
    return { ok: false, reason: "not_forming" };
  }
  if (input.activeMemberships.length !== 2) {
    return { ok: false, reason: "member_count" };
  }
  if (input.activeMemberships.some((m) => !m.emailVerified)) {
    return { ok: false, reason: "member_unverified" };
  }
  return { ok: true };
}
```

Update `packages/domain/src/index.ts`:

```ts
export * from "./couple-status.js";
export * from "./invitation-status.js";
export * from "./membership-status.js";
export * from "./can-accept-invitation.js";
export * from "./can-activate-couple.js";
```

- [ ] **Step 6: Run tests — expect pass**

Run: `pnpm --filter @couple-space/domain test`  
Expected: all tests PASS

- [ ] **Step 7: Commit (only if user asked)**

```bash
git add packages/domain
git commit -m "feat(domain): couple invite accept and activation invariants"
```

---

### Task 3: Scaffold `packages/db` + Drizzle schema (formation only)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema/*.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `schema` tables + `createDb(connectionString: string)` returning Drizzle instance

- [ ] **Step 1: Create package + deps**

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
    "check-types": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0",
    "typescript": "^5",
    "dotenv": "^16"
  }
}
```

Run: `pnpm install`

- [ ] **Step 2: Define schema tables**

`packages/db/src/schema/users.ts`:

```ts
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

`packages/db/src/schema/couples.ts`:

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const couples = pgTable("couples", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull(), // CoupleStatus
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

`packages/db/src/schema/couple-memberships.ts`:

```ts
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { couples } from "./couples.js";
import { users } from "./users.js";

export const coupleMemberships = pgTable(
  "couple_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coupleId: uuid("couple_id")
      .notNull()
      .references(() => couples.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(), // MembershipStatus
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("couple_memberships_one_active_per_user")
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
  ],
);
```

`packages/db/src/schema/couple-invitations.ts`:

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { couples } from "./couples.js";
import { users } from "./users.js";

export const coupleInvitations = pgTable("couple_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupleId: uuid("couple_id")
    .notNull()
    .references(() => couples.id),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull(), // InvitationStatus
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});
```

`packages/db/src/schema/audit-events.ts`:

```ts
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

`packages/db/src/schema/index.ts`:

```ts
export * from "./users.js";
export * from "./couples.js";
export * from "./couple-memberships.js";
export * from "./couple-invitations.js";
export * from "./audit-events.js";
```

`packages/db/src/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
```

`packages/db/src/index.ts`:

```ts
export * from "./schema/index.js";
export * from "./client.js";
```

- [ ] **Step 3: Drizzle config + env example**

`packages/db/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

`.env.example` (repo root):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=

# API
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
INVITE_TTL_HOURS=72
INVITE_RATE_LIMIT_PER_HOUR=10
```

- [ ] **Step 4: Generate migration**

Run (with `DATABASE_URL` set to local Supabase or Postgres):

```bash
cd packages/db && pnpm generate
```

Expected: SQL migration under `packages/db/drizzle/` including partial unique index.

- [ ] **Step 5: Apply migration to local DB**

Run: `cd packages/db && pnpm migrate`  
Expected: tables created; verify partial unique index exists.

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add packages/db .env.example
git commit -m "feat(db): formation schema for users, couples, invites, audit"
```

---

### Task 4: Scaffold NestJS `apps/api` + env + DB module

**Files:**
- Create: `apps/api/package.json`, `tsconfig.json`, `nest-cli.json`, `vitest.config.ts`
- Create: `apps/api/src/main.ts`, `app.module.ts`, `config/env.ts`, `db/db.module.ts`
- Modify: `apps/web/package.json` name to `@couple-space/web` if still `couple-space` (avoid workspace name clash)

**Interfaces:**
- Produces: HTTP server on `API_PORT`; `DB` injection token

- [ ] **Step 1: Create API package.json**

```json
{
  "name": "@couple-space/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "check-types": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@couple-space/db": "workspace:*",
    "@couple-space/domain": "workspace:*",
    "@nestjs/common": "^11",
    "@nestjs/core": "^11",
    "@nestjs/platform-express": "^11",
    "jose": "^6",
    "reflect-metadata": "^0.2",
    "rxjs": "^7",
    "zod": "^3"
  },
  "devDependencies": {
    "@nestjs/cli": "^11",
    "@nestjs/testing": "^11",
    "@types/express": "^5",
    "@types/node": "^20",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

Ensure `apps/web/package.json` `"name": "@couple-space/web"`.

- [ ] **Step 2: Env validation**

```ts
// apps/api/src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  INVITE_TTL_HOURS: z.coerce.number().default(72),
  INVITE_RATE_LIMIT_PER_HOUR: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
```

- [ ] **Step 3: DB module + app bootstrap**

```ts
// apps/api/src/db/db.module.ts
import { Global, Module } from "@nestjs/common";
import { createDb, type Db } from "@couple-space/db";
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
```

```ts
// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module.js";

@Module({
  imports: [DbModule],
})
export class AppModule {}
```

```ts
// apps/api/src/main.ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./config/env.js";

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  await app.listen(env.API_PORT);
}

bootstrap();
```

Add minimal `tsconfig.json` / `nest-cli.json` suitable for Nest 11 + ESM or CJS — prefer **CommonJS for Nest** if ESM friction appears; keep packages as `workspace:*` imports working under Nest's bundler. If Nest CJS: set `"module": "commonjs"` in `apps/api/tsconfig.json` and import without `.js` suffixes inside `apps/api` only.

- [ ] **Step 4: Health check route (smoke)**

Add `apps/api/src/health.controller.ts`:

```ts
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  get() {
    return { ok: true };
  }
}
```

Register in `AppModule` controllers.

Run: `pnpm --filter @couple-space/api dev`  
Curl: `curl -s localhost:3001/health` → `{"ok":true}`

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api apps/web/package.json
git commit -m "chore: scaffold NestJS API with DB module"
```

---

### Task 5: Supabase JWT auth guard + user sync

**Files:**
- Create: `apps/api/src/auth/*`
- Create: `apps/api/src/users/*`
- Create: `apps/api/src/audit/*`

**Interfaces:**
- Produces:
  - `@CurrentUser() user: AuthUser` where `AuthUser = { authUserId: string; email: string; emailVerified: boolean; appUserId: string }`
  - `UsersService.ensureFromAuth(...)` upserts `users` row

- [ ] **Step 1: Write failing unit test for UsersService ensure**

```ts
// apps/api/src/users/users.service.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UsersService } from "./users.service";

describe("UsersService.ensureFromAuth", () => {
  const insertReturning = vi.fn();
  const selectLimit = vi.fn();

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: insertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a user on first seen auth id", async () => {
    selectLimit.mockResolvedValueOnce([]);
    insertReturning.mockResolvedValueOnce([
      {
        id: "app-user-1",
        authUserId: "auth-1",
        email: "a@example.com",
        emailVerified: true,
      },
    ]);

    const service = new UsersService(db as never);
    const user = await service.ensureFromAuth({
      authUserId: "auth-1",
      email: "a@example.com",
      emailVerified: true,
    });

    expect(user).toEqual({
      appUserId: "app-user-1",
      authUserId: "auth-1",
      email: "a@example.com",
      emailVerified: true,
    });
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("returns existing user without inserting", async () => {
    selectLimit.mockResolvedValueOnce([
      {
        id: "app-user-1",
        authUserId: "auth-1",
        email: "a@example.com",
        emailVerified: true,
      },
    ]);

    const service = new UsersService(db as never);
    const user = await service.ensureFromAuth({
      authUserId: "auth-1",
      email: "a@example.com",
      emailVerified: true,
    });

    expect(user.appUserId).toBe("app-user-1");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm --filter @couple-space/api test`  
Expected: FAIL

- [ ] **Step 3: Implement UsersService + AuditService + JWT guard**

`AuthUser` type:

```ts
export type AuthUser = {
  authUserId: string;
  appUserId: string;
  email: string;
  emailVerified: boolean;
};
```

Guard responsibilities:
1. Read `Authorization: Bearer <token>`
2. `jwtVerify` with `SUPABASE_JWT_SECRET` (HS256) via `jose`
3. Require `email` claim; `emailVerified = Boolean(payload.email_confirmed_at ?? payload.user_metadata?.email_verified)` — use Supabase access token fields actually present (`email_confirmed_at` may be in user object; for JWT use `app_metadata` / confirm against Supabase docs for project). **Minimum:** treat `email_confirmed_at` claim if present; otherwise call is verified only when claim indicates confirmed. Document chosen claim in ADR later.
4. Call `users.ensureFromAuth`
5. Attach `AuthUser` to request

`AuditService.append({ actorUserId, action, entityType, entityId, metadata })` inserts into `audit_events`.

- [ ] **Step 4: Protected `GET /me` endpoint**

Returns `{ id, email, emailVerified, couple: null | { id, status } }` (couple lookup can be stubbed null until Task 6).

- [ ] **Step 5: Manual smoke**

Obtain a Supabase access token from the web signup flow (or Supabase dashboard user).  
`curl -H "Authorization: Bearer $TOKEN" localhost:3001/me`  
Expected: 200 with user id; second call same id (idempotent upsert).

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add apps/api
git commit -m "feat(api): Supabase JWT guard and user sync"
```

---

### Task 6: Create couple + create invitation

**Files:**
- Create: `apps/api/src/couples/couples.module.ts`
- Create: `apps/api/src/couples/couples.service.ts`
- Create: `apps/api/src/couples/couples.controller.ts`
- Create: `apps/api/src/couples/dto/create-couple.dto.ts`
- Create: `apps/api/src/couples/dto/create-invitation.dto.ts`
- Create: `apps/api/src/couples/couples.service.test.ts`

**Interfaces:**
- Produces:
  - `POST /couples` → `{ coupleId, status: "forming" }`
  - `POST /couples/:coupleId/invitations` body `{ email: string }` → `{ token, expiresAt }`
  - `GET /couples/me` → current couple + memberships summary

- [ ] **Step 1: Failing tests for createCouple**

Cases:
1. User with no active membership can create couple → status `forming`, one active membership, audit `couple.created`
2. User with active membership cannot create → conflict

- [ ] **Step 2: Implement `createCouple` in transaction**

Pseudocode:

```ts
await db.transaction(async (tx) => {
  // reject if active membership exists
  const couple = await tx.insert(couples).values({ status: "forming" }).returning();
  await tx.insert(coupleMemberships).values({
    coupleId: couple.id,
    userId: appUserId,
    status: "active",
  });
  await audit.append({ action: "couple.created", ... });
});
```

- [ ] **Step 3: Failing tests for createInvitation**

Cases:
1. Only active member of forming/active couple can invite
2. Email validated (zod email)
3. Token = `crypto.randomUUID()` + optional secret hash storage (store raw token unique; treat as capability URL secret)
4. `expiresAt = now + INVITE_TTL_HOURS`
5. Rate limit: count invites created by user in last hour; if `>= INVITE_RATE_LIMIT_PER_HOUR` → 429
6. Audit `invitation.created` (metadata: coupleId, invitee email domain ok; full email allowed in audit for support — do not log tokens)

- [ ] **Step 4: Implement createInvitation**

Map domain errors to HTTP: 403 / 409 / 429 / 400.

- [ ] **Step 5: Run API tests**

Run: `pnpm --filter @couple-space/api test`  
Expected: PASS

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add apps/api
git commit -m "feat(api): create couple and partner invitations"
```

---

### Task 7: Accept invitation → activate couple (idempotent)

**Files:**
- Modify: `apps/api/src/couples/couples.service.ts`
- Modify: `apps/api/src/couples/couples.controller.ts`
- Modify: `apps/api/src/couples/couples.service.test.ts`

**Interfaces:**
- Produces: `POST /invitations/:token/accept` → `{ coupleId, status: "active" }`
- Idempotent: second accept by same user on already-accepted invite for same couple returns same success payload (or 200 with current state), never two memberships

- [ ] **Step 1: Write failing accept tests**

Cover:
1. Happy path: forming couple + pending invite + verified invitee → membership created, invite `accepted`, couple `active`, audit `invitation.accepted` + `couple.activated`
2. Unverified email → 403 `email_unverified`
3. Wrong email → 403 `email_mismatch`
4. Invitee already in another couple → 409
5. Expired → 409/410
6. Double accept same user → idempotent success
7. Creator cannot accept own invite to add a second seat for themselves if email differs — still enforce email match
8. Use `canAcceptInvitation` + `canActivateCouple` from `@couple-space/domain`

- [ ] **Step 2: Implement accept in a single DB transaction**

Lock invitation row (`FOR UPDATE` via Drizzle/`sql` if available). Re-check status after lock. Insert membership. Re-load active memberships with user emailVerified flags. If `canActivateCouple` ok → set couple `active`.

- [ ] **Step 3: `POST /invitations/:token/revoke` (inviter only)**

Pending → revoked; audit `invitation.revoked`.

- [ ] **Step 4: Run tests — pass**

Run: `pnpm --filter @couple-space/api test`  
Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/api
git commit -m "feat(api): accept invite and activate couple"
```

---

### Task 8: Web — Supabase Auth + API client

**Files:**
- Modify: `apps/web/package.json` (add `@supabase/supabase-js`, `@supabase/ssr`)
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/app/auth/callback/route.ts`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/signup/page.tsx`

**Interfaces:**
- Produces: `apiFetch(path, { method, body })` attaches Supabase access token

- [ ] **Step 1: Install web auth deps**

```bash
pnpm --filter @couple-space/web add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Supabase browser/server clients**

Follow current Supabase SSR Next.js App Router pattern for your installed `@supabase/ssr` version (cookie session). Callback route exchanges code for session.

- [ ] **Step 3: `apiFetch` helper**

```ts
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { accessToken: string },
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${init.accessToken}`,
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

- [ ] **Step 4: Login/signup pages**

Email + password (or magic link if you prefer — pick **email + password** for simpler local testing unless you already use magic links). After signup, show “verify your email” message. After login, redirect to `/couple`.

- [ ] **Step 5: Manual test**

Sign up two users in local Supabase; verify emails (Inbucket/local); login; `GET /me` via UI or network tab succeeds.

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add apps/web
git commit -m "feat(web): Supabase auth and API client"
```

---

### Task 9: Web — couple dashboard, invite, accept

**Files:**
- Create: `apps/web/app/(app)/layout.tsx` (require session)
- Create: `apps/web/app/(app)/couple/page.tsx`
- Create: `apps/web/app/(app)/invite/page.tsx`
- Create: `apps/web/app/invite/[token]/page.tsx`
- Modify: `apps/web/app/page.tsx` (redirect logged-in users)

**Interfaces:**
- Consumes: `POST /couples`, `POST /couples/:id/invitations`, `POST /invitations/:token/accept`, `GET /couples/me`

- [ ] **Step 1: Couple page**

- If no couple: button “Create couple space” → `POST /couples` → show status `forming`
- If forming: show invite form (email) → display invite link `https://<web>/invite/<token>`
- If active: show “Couple active” + partner emails/ids (no community chrome)

- [ ] **Step 2: Accept page `/invite/[token]`**

- Require login; if email unverified, prompt to verify
- Button Accept → `POST /invitations/:token/accept`
- On success redirect to `/couple` showing `active`

- [ ] **Step 3: End-to-end manual checklist**

1. User A signs up, verifies, creates couple  
2. User A invites User B email  
3. User B signs up with that email, verifies  
4. User B opens invite link, accepts  
5. Both see couple `active`  
6. User B cannot create another couple  
7. Re-accept same invite is safe (idempotent)

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add apps/web
git commit -m "feat(web): couple creation, invite, and accept flows"
```

---

### Task 10: ADR + slice-1 definition of done

**Files:**
- Create: `docs/architecture/decisions/adr-001-supabase-auth-nestjs-api.md`
- Modify: `docs/superpowers/specs/2026-08-29-couple-space-platform-design.md` status note if desired (optional)

- [ ] **Step 1: Write ADR-001**

Capture: Supabase Auth + NestJS JWT verification; Drizzle on Supabase Postgres; why not heavy RLS as primary authz.

- [ ] **Step 2: Verify definition of done**

- [ ] Domain tests pass  
- [ ] API tests pass  
- [ ] Migrations apply cleanly  
- [ ] Manual E2E checklist in Task 9 passes  
- [ ] No session/community tables introduced  
- [ ] Audit events written for create/accept/revoke  

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add docs/architecture
git commit -m "docs: ADR-001 Supabase Auth with NestJS API"
```

---

## Plan self-review

**Spec coverage (slice 1):** formation, invite, email verification gate, activation with two members, membership uniqueness, audit, NestJS+Supabase+Drizzle, web-first — covered. Session engine / community explicitly out.

**Placeholders:** JWT email-verified claim mapping called out as “confirm against Supabase JWT fields” in Task 5 — implementer must verify against project JWT and document in ADR; not left as vague “handle auth”.

**Type consistency:** `AuthUser`, couple/invitation/membership statuses aligned with `@couple-space/domain`; HTTP paths consistent across Tasks 6–9.

**Follow-up plan (not this file):** Slice 2 — private conversation engine.
