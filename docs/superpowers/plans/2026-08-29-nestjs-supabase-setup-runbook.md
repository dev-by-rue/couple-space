# NestJS + Hosted Supabase Setup Runbook — Implementation Plan

> **Superseded:** The human how-to is now `docs/engineering/nestjs-supabase-setup.md` (NestJS + Postgres smoke only). Do not execute this agent plan as written.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author `docs/engineering/nestjs-supabase-setup.md` — a human-facing checklist to scaffold NestJS in this monorepo and prove hosted Supabase Postgres + JWT connectivity (no application code in this plan).

**Architecture:** Documentation-only deliverable. The runbook extracts and adapts Tasks 1 and 3–5 of the couple-formation plan for a developer with an existing hosted Supabase project: dashboard key map → env → `packages/domain` + `packages/db` → `apps/api` → JWT `/me` smoke tests.

**Tech Stack:** Markdown runbook; references NestJS 11, Drizzle, `postgres`.js, `jose`, Zod, pnpm + Turbo, hosted Supabase (Auth + Postgres).

**Spec:** `docs/superpowers/specs/2026-08-29-nestjs-supabase-setup-design.md`  
**Code snippet source:** `docs/superpowers/plans/2026-08-29-couple-formation.md` (Tasks 1, 3–5)  
**Product:** `docs/product/scope.md`

## Global Constraints

- Deliver **documentation only** — do not create `apps/api`, `packages/*`, or run Nest/Drizzle as part of this plan.
- Authoritative product: `docs/product/scope.md` — private-first, couple-centric.
- Stay aligned with platform design: Nest verifies Supabase JWTs; Drizzle uses `DATABASE_URL`; no secrets in `apps/web`.
- Hosted Supabase only; do not document `supabase start` / local CLI as a path.
- Runtime DB: prefer transaction pooler + `prepare: false`. Migrations: allow direct/session URL via `DIRECT_DATABASE_URL` when pooler rejects DDL.
- **Git commits:** only when the user explicitly asks. Skip commit steps during execution unless told to commit.
- Prefer linking to formation-plan task sections for long schema bodies; inline env, client, module, guard responsibilities, and all curl/smoke commands.

---

## File structure (create/modify)

```
docs/engineering/nestjs-supabase-setup.md   # primary runbook (create)
docs/engineering/build-brief.md             # add one-line link under Documentation (modify)
```

No application source files.

---

### Task 1: Write runbook — prerequisites through env wiring

**Files:**
- Create: `docs/engineering/nestjs-supabase-setup.md`

**Interfaces:**
- Produces: Runbook file with title, purpose, success criteria, prerequisites, dashboard secrets, env chapters

- [ ] **Step 1: Create the runbook file with front matter and early chapters**

Write `docs/engineering/nestjs-supabase-setup.md` with exactly the content below (later tasks append; do not leave placeholders).

````markdown
# NestJS + hosted Supabase setup

Human checklist to scaffold the NestJS API in this monorepo and prove connectivity to an **existing hosted** Supabase project (Postgres + Auth JWT).

**Design:** `docs/superpowers/specs/2026-08-29-nestjs-supabase-setup-design.md`  
**Code-level steps / snippets:** `docs/superpowers/plans/2026-08-29-couple-formation.md` (Tasks 1, 3–5)  
**Product:** `docs/product/scope.md`

## Purpose

After following this runbook you will have:

1. Root env vars pointing at your hosted project
2. `@couple-space/domain` and `@couple-space/db` packages
3. `@couple-space/api` (NestJS 11) with Drizzle DB module
4. Supabase JWT verification and `GET /me` user sync

This runbook does **not** cover couple/invite endpoints (resume formation plan at Task 6) or the Next.js Auth UI (Task 8).

## Success criteria

| Check | Expected |
|---|---|
| `GET /health` | `{"ok":true}` on `API_PORT` (default `3001`) |
| Migrations | Formation tables exist on hosted Postgres |
| `GET /health/db` | Proves `select 1` (or equivalent) against Supabase Postgres |
| `GET /me` + valid Bearer token | `200` with app user id; second call same id |
| `GET /me` without/invalid token | `401` |

## Prerequisites

- Access to your **hosted** Supabase project (dashboard)
- Node.js and **pnpm** matching this repo (`package.json` → `devEngines.packageManager`)
- Repo root is a pnpm + Turbo monorepo with `apps/web` already present
- Docker / Supabase CLI **not** required

## 1. Collect secrets from the Supabase dashboard

Open your project in the [Supabase dashboard](https://supabase.com/dashboard).

### 1.1 Project URL and anon key (for later web; record now)

**Path:** Project Settings → **API**

| Value | Env var | Used by |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Web (later); not required for API boot |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web (later); **never** use as JWT secret |

### 1.2 JWT secret (required for Nest)

**Path:** Project Settings → **API** → **JWT Secret**

| Value | Env var | Notes |
|---|---|---|
| JWT Secret | `SUPABASE_JWT_SECRET` | HS256 secret Nest uses with `jose`. **Not** the `anon` key. **Not** the `service_role` key. |

### 1.3 Database connection strings

**Path:** Project Settings → **Database** → Connection string / connection pooling

| Use | Prefer | Env var |
|---|---|---|
| Nest runtime (Drizzle `postgres` client) | **Transaction pooler** URI | `DATABASE_URL` |
| Drizzle migrations (`drizzle-kit migrate`) | **Direct** or **Session** mode if pooler rejects DDL | `DIRECT_DATABASE_URL` (optional; fall back to `DATABASE_URL` if migrate works on pooler) |

Copy the URI including password. Do not commit it.

**Runtime rule:** the DB client must use `postgres(connectionString, { prepare: false })` so the transaction pooler does not break on prepared statements (see formation plan Task 3 `createDb`).

## 2. Wire environment files

### 2.1 Create root `.env.example` (committed)

At repo root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=
# Optional: use for drizzle-kit migrate if transaction pooler rejects DDL
DIRECT_DATABASE_URL=

# API
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
INVITE_TTL_HOURS=72
INVITE_RATE_LIMIT_PER_HOUR=10
```

### 2.2 Create root `.env` (gitignored)

Copy `.env.example` → `.env` and paste real values from §1.

Confirm `.env` is listed in `.gitignore` (do not commit secrets).

### 2.3 Loading env in tools

- **Nest API:** load root `.env` before `loadEnv()` (e.g. `dotenv` in `main.ts` with path to repo root, or export vars in the shell when running `pnpm --filter @couple-space/api dev`).
- **drizzle-kit:** run from `packages/db` with `DATABASE_URL` or `DIRECT_DATABASE_URL` set (dotenv in `drizzle.config.ts` or export from a trusted local shell).

For migrate, prefer:

```bash
export DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"
```

so a direct URL wins when set.
````

- [ ] **Step 2: Verify early chapters exist**

Run:

```bash
test -f docs/engineering/nestjs-supabase-setup.md && \
  rg -n "^## Purpose|^## Success criteria|^## Prerequisites|^## 1\. Collect secrets|^## 2\. Wire environment" docs/engineering/nestjs-supabase-setup.md
```

Expected: file exists; all five headings match.

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add docs/engineering/nestjs-supabase-setup.md
git commit -m "$(cat <<'EOF'
docs: start NestJS hosted Supabase setup runbook

EOF
)"
```

Skip this step unless the user explicitly requested a commit.

---

### Task 2: Append domain + db + Nest API scaffold chapters

**Files:**
- Modify: `docs/engineering/nestjs-supabase-setup.md`

**Interfaces:**
- Consumes: Runbook from Task 1
- Produces: Chapters 3–5 covering packages and Nest boot/`/health`

- [ ] **Step 1: Append packages and API chapters**

Append the following to `docs/engineering/nestjs-supabase-setup.md` (after the env chapter):

````markdown

## 3. Scaffold `@couple-space/domain` (minimal)

The API package depends on `@couple-space/domain`. Create it first so `pnpm install` resolves workspace deps.

Follow **Task 1** in `docs/superpowers/plans/2026-08-29-couple-formation.md`:

- Create `packages/domain/package.json` (`name`: `@couple-space/domain`)
- Add `tsconfig.json`, `vitest.config.ts`
- Add status enums (`couple-status`, `invitation-status`, `membership-status`) and barrel `src/index.ts`

Then from repo root:

```bash
pnpm install
pnpm --filter @couple-space/domain check-types
```

Expected: types check clean.

## 4. Scaffold `@couple-space/db` + migrate hosted Postgres

Follow **Task 3** in the couple-formation plan for full schema file bodies.

### 4.1 Package and client

- Create `packages/db` with deps `drizzle-orm`, `postgres`; devDeps `drizzle-kit`, `typescript`, `dotenv`
- Implement `createDb`:

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

- Define formation tables only: `users`, `couples`, `couple_memberships`, `couple_invitations`, `audit_events` (exact columns in formation plan Task 3)
- `drizzle.config.ts` reads `process.env.DATABASE_URL` (or `DIRECT_DATABASE_URL` if you point migrate at direct)

### 4.2 Generate and migrate

```bash
cd packages/db
# Prefer direct URL for DDL when needed:
export DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"
pnpm generate
pnpm migrate
```

Expected:

- SQL under `packages/db/drizzle/` including the partial unique index on active memberships
- Tables visible in Supabase **Table Editor** or SQL editor

If migrate fails against the transaction pooler, set `DIRECT_DATABASE_URL` to the direct/session string and retry with the export above.

## 5. Scaffold NestJS `apps/api`

Follow **Task 4** in the couple-formation plan for package.json and module layout.

### 5.1 Package

- Create `apps/api` as `@couple-space/api` with Nest 11, `zod`, `jose`, workspace deps `@couple-space/db` and `@couple-space/domain`
- Ensure `apps/web/package.json` `"name": "@couple-space/web"` (avoid workspace name clash)
- Prefer **CommonJS for Nest** if ESM import friction appears (`"module": "commonjs"` in `apps/api/tsconfig.json`; omit `.js` suffixes inside `apps/api` only)

### 5.2 Env validation

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

### 5.3 DB module + bootstrap

- Global `DbModule` providing `DB` token via `createDb(loadEnv().DATABASE_URL)`
- `main.ts`: `loadEnv()`, CORS from `CORS_ORIGIN`, listen on `API_PORT`

### 5.4 Health routes

- `GET /health` → `{ ok: true }`
- `GET /health/db` → run a trivial query (`select 1`) and return `{ ok: true, db: true }` on success; fail the request if DB is unreachable

Register controllers on `AppModule`.

### 5.5 Boot smoke

```bash
pnpm install
pnpm --filter @couple-space/api dev
curl -s localhost:3001/health
curl -s localhost:3001/health/db
```

Expected: `{"ok":true}` and a DB-ok payload. Zod must not throw on boot.
````

- [ ] **Step 2: Verify chapters 3–5**

Run:

```bash
rg -n "^## 3\. Scaffold|^## 4\. Scaffold|^## 5\. Scaffold NestJS|GET /health/db|prepare: false" docs/engineering/nestjs-supabase-setup.md
```

Expected: headings and both health/db and `prepare: false` present.

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add docs/engineering/nestjs-supabase-setup.md
git commit -m "$(cat <<'EOF'
docs: add domain, db, and Nest chapters to Supabase setup runbook

EOF
)"
```

Skip unless the user explicitly requested a commit.

---

### Task 3: Append auth, verification, troubleshooting, and next steps

**Files:**
- Modify: `docs/engineering/nestjs-supabase-setup.md`

**Interfaces:**
- Consumes: Runbook through §5
- Produces: Complete runbook including auth smoke and troubleshooting

- [ ] **Step 1: Append auth and closing chapters**

Append:

````markdown

## 6. Supabase JWT guard + `GET /me`

Follow **Task 5** in the couple-formation plan for tests and full service code.

### 6.1 Responsibilities

1. Read `Authorization: Bearer <access_token>`
2. Verify with `jose` `jwtVerify` using `SUPABASE_JWT_SECRET` (HS256)
3. Derive `email` and email-verified flag from token claims (see formation plan Task 5 for claim notes; document the chosen claim in an ADR later if needed)
4. `UsersService.ensureFromAuth` upserts the `users` row keyed by `auth_user_id`
5. Expose `@CurrentUser()` / attach `AuthUser`: `{ authUserId, appUserId, email, emailVerified }`

### 6.2 Protected route

`GET /me` returns at least:

```json
{ "id": "<appUserId>", "email": "...", "emailVerified": true, "couple": null }
```

(`couple` stays `null` until formation Task 6.)

### 6.3 Obtain an access token (no web UI required)

Pick one:

1. **Dashboard:** Authentication → Users → add user; sign in via Supabase Auth HTTP API (`/auth/v1/token?grant_type=password`) using Project URL + anon key; copy `access_token` from the JSON response.
2. **Existing session:** if you already signed up in another client, copy the access token from that session.

Do not paste tokens into git or screenshots that get committed.

### 6.4 Auth smoke

```bash
export TOKEN='<access_token>'
curl -s -H "Authorization: Bearer $TOKEN" localhost:3001/me
curl -s -H "Authorization: Bearer $TOKEN" localhost:3001/me
curl -s localhost:3001/me
curl -s -H "Authorization: Bearer not-a-jwt" localhost:3001/me
```

Expected:

- First two calls: `200`, same `id`
- Missing / invalid token: `401`

## 7. Verification checklist (end-to-end)

- [ ] `.env` filled; `.env.example` committed without secrets
- [ ] `pnpm --filter @couple-space/domain check-types` passes
- [ ] `pnpm generate` + `pnpm migrate` in `packages/db` applied on hosted Postgres
- [ ] `pnpm --filter @couple-space/api dev` boots without Zod errors
- [ ] `curl -s localhost:3001/health` → `{"ok":true}`
- [ ] `curl -s localhost:3001/health/db` → DB ok
- [ ] `curl` `/me` with real token → stable user id; without token → `401`

When all boxes pass, Nest is successfully connected to hosted Supabase for this repo’s architecture.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Zod fails on boot | Missing `.env` or process not loading it | Export vars or load root `.env` before `loadEnv()` |
| DB connect / SSL errors | Wrong URI or SSL requirements | Use the URI from Supabase Database settings; keep password URL-encoded |
| Prepared-statement / pooler errors | Transaction pooler + prepared statements | Keep `postgres(..., { prepare: false })` |
| JWT always `401` | Using anon or service_role key as secret | Set `SUPABASE_JWT_SECRET` to **JWT Secret** under API settings |
| `migrate` fails | Transaction pooler / DDL limits | Set `DIRECT_DATABASE_URL` to direct or session mode; export it as `DATABASE_URL` for migrate |
| Workspace package not found | Domain/db not created or install skipped | Create packages per §§3–4; run `pnpm install` from root |
| Nest ESM / `.js` import errors | Module format mismatch | Prefer CommonJS in `apps/api`; drop `.js` suffixes inside the API app only |

## 9. Security reminders

- Never commit `.env`, JWT secret, DB password, or access tokens
- `DATABASE_URL` / `DIRECT_DATABASE_URL` / `SUPABASE_JWT_SECRET` are **server-only** — never `NEXT_PUBLIC_*`
- Web will use anon key later; API uses JWT secret + DB URL
- This setup proves verify + user sync only — couple authorization stays on future Nest endpoints

## 10. Next steps

Resume **Task 6** in `docs/superpowers/plans/2026-08-29-couple-formation.md` (create couple + invitation). Web Auth UI is Task 8.
````

- [ ] **Step 2: Spec coverage gate**

Run:

```bash
rg -n "^## 6\.|^## 7\.|^## 8\.|^## 9\.|^## 10\.|SUPABASE_JWT_SECRET|DIRECT_DATABASE_URL|Authorization: Bearer" docs/engineering/nestjs-supabase-setup.md
```

Expected: chapters 6–10 present; JWT secret, direct URL, and Bearer smoke documented.

Manually confirm the runbook maps to the design spec:

| Spec requirement | Runbook section |
|---|---|
| Hosted-only, project exists | Purpose + §1 |
| Env example + secrets | §1–§2 |
| domain + db + api | §3–§5 |
| `/health` + `/health/db` | §5.4–§5.5, §7 |
| JWT + `/me` | §6 |
| Troubleshooting + security | §8–§9 |
| Next → Task 6 | §10 |

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add docs/engineering/nestjs-supabase-setup.md
git commit -m "$(cat <<'EOF'
docs: complete NestJS hosted Supabase setup runbook

EOF
)"
```

Skip unless the user explicitly requested a commit.

---

### Task 4: Link runbook from engineering build brief

**Files:**
- Modify: `docs/engineering/build-brief.md`

**Interfaces:**
- Consumes: Completed runbook path
- Produces: Discoverable link under Documentation

- [ ] **Step 1: Add documentation bullet**

In `docs/engineering/build-brief.md`, under the **Documentation to maintain** list, add this bullet after the existing ADR bullet (keep other bullets unchanged):

```markdown
- `docs/engineering/nestjs-supabase-setup.md` — hosted Supabase + NestJS setup checklist (Postgres + JWT smoke)
```

- [ ] **Step 2: Verify link target exists**

Run:

```bash
rg -n "nestjs-supabase-setup" docs/engineering/build-brief.md && test -f docs/engineering/nestjs-supabase-setup.md
```

Expected: match in build-brief; runbook file exists.

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add docs/engineering/build-brief.md docs/engineering/nestjs-supabase-setup.md
git commit -m "$(cat <<'EOF'
docs: link NestJS Supabase setup runbook from build brief

EOF
)"
```

Skip unless the user explicitly requested a commit.

---

## Plan self-review

1. **Spec coverage:** Goal, deliverable path, hosted-only, env vars, pooler vs direct, domain/db/api chapters, health + health/db, JWT `/me`, troubleshooting table, security, next steps, build-brief link — each has a task/section.
2. **Placeholders:** None; formation plan referenced for long schema bodies by design.
3. **Consistency:** `DIRECT_DATABASE_URL` optional; runtime `DATABASE_URL` + `prepare: false`; commit steps gated on user request per repo rules.
4. **Fencing:** Embedded runbook bodies use four-backtick outer fences so inner triple-backtick examples stay intact.
