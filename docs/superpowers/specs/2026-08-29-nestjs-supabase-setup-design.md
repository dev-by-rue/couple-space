# NestJS + Hosted Supabase Setup Runbook — Design

**Date:** 2026-08-29  
**Status:** Superseded in scope — deliverable narrowed to Postgres-only how-to (`docs/engineering/nestjs-supabase-setup.md`). JWT / formation schema deferred.  
**Product source of truth:** `docs/product/scope.md`  
**Platform design:** `docs/superpowers/specs/2026-08-29-couple-space-platform-design.md`  
**Implementation plan (code snippets):** `docs/superpowers/plans/2026-08-29-couple-formation.md` (Tasks 1, 3–5)

## 1. Goal

Produce a **human-facing setup runbook** so a developer with an existing **hosted** Supabase project can scaffold NestJS in this monorepo and prove:

1. The API boots with validated env.
2. Drizzle connects to Supabase Postgres (service connection).
3. NestJS verifies Supabase Auth JWTs and syncs a `users` row.

This cycle delivers **documentation only** — no application scaffolding is performed as part of this design.

## 2. Deliverable

| Item | Path |
|---|---|
| Runbook (primary) | `docs/engineering/nestjs-supabase-setup.md` |
| This design | `docs/superpowers/specs/2026-08-29-nestjs-supabase-setup-design.md` |

The runbook is a linear checklist. The couple-formation plan remains the source for long code bodies; the runbook adds dashboard key locations, hosted-Postgres caveats, ordered commands, and success checks. It links to Tasks 1 and 3–5 of the formation plan and inlines critical env, client, module, and smoke commands.

## 3. Audience and assumptions

- Reader: solo developer working in `couple-space`.
- Hosted Supabase project **already exists**; runbook starts at “copy keys from the dashboard.”
- No local Supabase CLI / Docker requirement.
- Monorepo already has `apps/web`, pnpm workspaces, Turbo; `apps/api` and `packages/*` do not exist yet.
- Stack matches platform design: NestJS verifies JWT; Drizzle uses DB URL with service-level access; authorization stays on the API.

## 4. Success criteria (“connected successfully”)

1. `GET /health` → `{"ok":true}` with `@couple-space/api` running on `API_PORT` (default 3001).
2. Formation migrations applied on hosted Postgres; tables visible (or proven via DB health).
3. `GET /health/db` runs `select 1` (or equivalent) so Postgres connectivity is proven without the dashboard.
4. `GET /me` with a valid `Authorization: Bearer <access_token>` → 200 and a synced app user id; second call returns the same id (idempotent upsert).
5. Missing or invalid token → 401.

## 5. Scope

### In

- Dashboard map for project URL, anon key, JWT secret, and Postgres connection strings.
- Root `.env` / `.env.example` wiring.
- Scaffold instructions for `packages/domain` (minimal, so workspace deps resolve), `packages/db`, and `apps/api`.
- Drizzle generate + migrate against hosted Postgres.
- Nest env validation (Zod), global `DbModule`, `/health`, `/health/db`.
- JWT guard (`jose` + `SUPABASE_JWT_SECRET`), `UsersService.ensureFromAuth`, protected `GET /me`.
- How to obtain an access token for smoke testing without requiring the full Next.js Auth UI.
- Verification commands and troubleshooting.

### Out

- Creating the Supabase project.
- Local Supabase (`supabase start`).
- Couple / invite / activate endpoints (formation Tasks 6+).
- Next.js Auth UI (Task 8) beyond token acquisition for smoke.
- Writing application code in the brainstorming/spec cycle (runbook text only until a separate plan/execution).

## 6. Architecture (unchanged)

```
apps/web (later) --JWT--> apps/api (NestJS)
                            |
                            | Drizzle (DATABASE_URL)
                            v
                     Hosted Supabase Postgres + Auth
```

Env vars (root `.env.example`):

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

API Zod schema validates at least: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `API_PORT`, `CORS_ORIGIN`, invite-related vars as in the formation plan.

**Connection string policy (explicit):**

- **Runtime (Nest / Drizzle client):** prefer Supabase **transaction pooler** URI; keep `postgres(connectionString, { prepare: false })` as in the formation plan.
- **Migrations (drizzle-kit):** may require **direct** or **session** mode URL if the transaction pooler rejects DDL; runbook must document using a separate `DATABASE_URL` (or `DIRECT_DATABASE_URL`) for migrate when needed, without putting either secret in the web app.

## 7. Runbook chapter outline

1. **Prerequisites** — Node/pnpm per repo; hosted project access; no Docker required.
2. **Collect secrets** — exact dashboard locations:
   - Project URL + anon key (Settings → API) — noted for later web; unused by API boot.
   - JWT Secret (Settings → API → JWT Secret) — **not** the anon or service_role key.
   - Database connection string(s) — pooler vs direct called out.
3. **Wire env** — gitignored root `.env`; `.env.example`; loading for Nest and drizzle-kit (`dotenv` as needed).
4. **`packages/domain`** — minimal package (status enums / Task 1) so `@couple-space/api` workspace dependency resolves.
5. **`packages/db`** — package, formation schema, `createDb`, generate, migrate; confirm tables.
6. **`apps/api`** — Nest 11 layout; prefer CommonJS for Nest if ESM friction; Zod `loadEnv`; global `DbModule`; `/health` + `/health/db`; rename `apps/web` to `@couple-space/web` if needed to avoid name clash.
7. **Auth layer** — Bearer JWT verify with `jose` (HS256 + `SUPABASE_JWT_SECRET`); `ensureFromAuth`; `GET /me` (couple field may be `null` until Task 6); token acquisition via Auth user in dashboard / Auth API.
8. **Verification & troubleshooting** — smoke sequence + failure table (below).
9. **Next step** — resume couple-formation plan at Task 6.

## 8. Verification and troubleshooting

### Smoke sequence

1. `pnpm --filter @couple-space/api dev` — no Zod parse errors.
2. `curl -s localhost:3001/health` → `{"ok":true}`.
3. `curl -s localhost:3001/health/db` → success payload proving `select 1` (or equivalent).
4. Obtain access token for a hosted Auth user.
5. `curl -s -H "Authorization: Bearer $TOKEN" localhost:3001/me` → 200 with stable user id on repeat.
6. Request without/invalid token → 401.

### Troubleshooting (must appear in runbook)

| Symptom | Likely cause | Fix direction |
|---|---|---|
| Zod fails on boot | Missing `.env` / wrong cwd | Load root `.env`; document dotenv for Nest and drizzle-kit |
| DB connect / SSL errors | Wrong URI or SSL mode | Use Supabase-provided URI; note SSL if required |
| Prepared-statement errors via pooler | Transaction pooler + prepared statements | Keep `prepare: false` |
| JWT 401 always | Wrong secret (e.g. anon key) | Use JWT Secret from API settings |
| Migrate fails | Pooler/DDL limits or wrong role | Use direct/session URL for migrations |

## 9. Security constraints

- Never commit `.env`.
- `DATABASE_URL`, DB password, and `SUPABASE_JWT_SECRET` are server-only (API / migrate tooling).
- Do not place those secrets in `apps/web` or any `NEXT_PUBLIC_*` var.
- This setup proves verify + user sync only; couple membership authorization remains future API work.
- Do not log intimate content; audit append is optional for this setup slice beyond what Task 5 requires for `/me` sync path.

## 10. Relationship to existing docs

| Doc | Role |
|---|---|
| `docs/product/scope.md` | Product rules (unchanged) |
| Platform design | Architecture authority |
| Couple-formation plan Tasks 1, 3–5 | Code-level steps and snippets |
| This design | Defines the runbook’s purpose, chapters, and success bar |
| `docs/engineering/nestjs-supabase-setup.md` | The runbook humans follow (to be written next) |

## 11. Out of scope for the runbook authoring plan

- Implementing Nest/Drizzle/Auth in the repo (separate execution after runbook exists, or by following the runbook manually).
- Local Supabase alternative path.
- Formation features past JWT + `/me`.

## Spec self-review

- Placeholders: none intentional; JWT email-verified claim nuance deferred to formation plan / later ADR as already noted there.
- Consistency: matches platform “Nest verifies JWT + Drizzle service DB” and hosted-only choice.
- Scope: single doc deliverable; suitable for one writing-plans pass to author the runbook.
- Ambiguity resolved: migrate may use direct URL vs runtime pooler — documented as required policy in §6.
