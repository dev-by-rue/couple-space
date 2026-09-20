# Slice 1 Remaining Work — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Couple Space Slice 1: Nest-backed web auth UI, couple create/invite/accept APIs, couple web flows, and ADR/DoD — without Supabase Auth.

**Architecture:** Nest is the IdP (already shipped). Web uses httpOnly cookies via `credentials: 'include'`. Couple/invite authorization stays on Nest; domain helpers in `@couple-space/domain` gate accept/activate. Postgres via `@couple-space/database` (local or self-hosted).

**Tech Stack:** NestJS, Drizzle, Zod, Vitest, Next.js `apps/web`, existing auth (`AuthUser.id`, `JwtAuthGuard`, cookies `cs_access` / `cs_refresh`).

**Specs:**

- `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`
- `docs/superpowers/specs/2026-08-29-couple-space-platform-design.md` (auth sections superseded by Nest design)
- `docs/product/scope.md`

**History (do not execute remaining work from these):**

- `docs/superpowers/plans/2026-08-30-nest-owned-auth.md` — Tasks 1–8 done; 9–10 moved here
- `docs/superpowers/plans/2026-08-29-couple-formation.md` — Tasks 1–4 done; 5 & 8 superseded by Nest auth; 6–7 & 9–10 moved here

## Already complete (do not re-do)

- `@couple-space/domain` status unions + `canAcceptInvitation` / `canActivateCouple`
- `@couple-space/database` formation schema + Nest auth user/refresh_tokens (password_hash is **text**)
- Nest API: register/login/refresh/logout, dev verify, JWT guard, `GET /me`, audit helper
- Manual auth smoke: `docs/engineering/auth-manual-smoke.md`

## Global Constraints

- Authoritative product: `docs/product/scope.md` — private-first, couple-centric.
- Do not implement `docs/product/future-roadmap.md` items.
- Match existing API style: `AuthUser.id` (not `appUserId`); Express param name `response`; Zod `body: unknown` then `.parse`; package `@couple-space/database`.
- Heavily comment *why* in new code (cookies, idempotent accept, domain helpers).
- Authorization only on the server; never trust the client for membership.
- At most one **active** membership per user (partial unique index already exists).
- Activate only with exactly two verified active members (`canActivateCouple`).
- Invite accept is idempotent.
- Dev verify only when `ENABLE_DEV_AUTH_ENDPOINTS=true`.
- **Git commits:** only when the user explicitly asks.
- Prefer TDD for API services.

## File structure (remaining)

```
apps/web/
  lib/api.ts
  app/login/page.tsx
  app/signup/page.tsx
  app/(app)/layout.tsx
  app/(app)/couple/page.tsx
  app/(app)/invite/page.tsx
  app/invite/[token]/page.tsx
  app/page.tsx                     # redirect tweaks

apps/api/
  src/couples/couples.module.ts
  src/couples/couples.service.ts
  src/couples/couples.controller.ts
  src/couples/couples.service.test.ts
  src/couples/dto/*.ts
  src/app.module.ts                # import CouplesModule
  src/config/env.ts                # INVITE_TTL_HOURS, INVITE_RATE_LIMIT_PER_HOUR if missing
  src/users/users.service.ts       # optionally fill couple on GET /me later

docs/architecture/decisions/
  adr-001-nest-owned-auth-and-formation.md
```

---

### Task 1: Web — Nest auth client + login/signup

**Files:**

- Create: `apps/web/lib/api.ts`
- Create: `apps/web/app/signup/page.tsx`
- Create: `apps/web/app/login/page.tsx`
- Do **not** add `@supabase/*`

**Interfaces:**

- Produces: `apiFetch` with `credentials: 'include'`
- Signup: email, password, displayName, dateOfBirth → `POST /auth/register`
- Login: email, password → `POST /auth/login`

- [x] **Step 1: Create `apiFetch`**

```ts
// apps/web/lib/api.ts
/**
 * Web auth uses Nest httpOnly cookies (cs_access / cs_refresh).
 * Always include credentials so the browser sends cookies cross-origin to the API.
 * Do NOT store access tokens in localStorage for the web client.
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
  // 204 / empty bodies are rare here; auth endpoints return JSON.
  return res.json() as Promise<T>;
}
```

- [x] **Step 2: Signup page**

`apps/web/app/signup/page.tsx`:

- Fields: email, password, displayName, dateOfBirth (`YYYY-MM-DD`)
- Submit → `apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(...) })`
- If `process.env.NODE_ENV === 'development'` (or a `NEXT_PUBLIC_ENABLE_DEV_VERIFY` flag): call `apiFetch('/auth/dev/verify', { method: 'POST' })` and comment that a mailer replaces this
- Redirect to `/couple` (page may 404 until Task 4 — acceptable to redirect to `/` temporarily with a comment)

- [x] **Step 3: Login page**

`apps/web/app/login/page.tsx` → `POST /auth/login` → redirect `/couple` or `/`.

- [ ] **Step 4: Manual check**

Set `NEXT_PUBLIC_API_URL=http://localhost:8080` in `apps/web/.env.local`. Sign up → cookies set → Network tab shows `/me` or signup succeeds.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/web/lib/api.ts apps/web/app/login apps/web/app/signup
git commit -m "feat(web): nest auth login and signup"
```

---

### Task 2: API — create couple + create invitation

**Files:**

- Create: `apps/api/src/couples/`*
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/config/env.ts` — ensure `INVITE_TTL_HOURS`, `INVITE_RATE_LIMIT_PER_HOUR`

**Interfaces:**

- `POST /couples` (auth) → `{ coupleId, status: "forming" }`
- `POST /couples/:coupleId/invitations` body `{ email }` → `{ token, expiresAt }`
- `GET /couples/me` → current couple + memberships summary (or 404 if none)

**Conventions:** use `@CurrentUser() user: AuthUser` and `user.id`; Zod for bodies; Nest `TestingModule` like `auth.service.test.ts`.

- [x] **Step 1: Env for invites**

Add to `env.ts` if missing:

```ts
INVITE_TTL_HOURS: z.coerce.number().positive().default(72),
INVITE_RATE_LIMIT_PER_HOUR: z.coerce.number().positive().default(10),
```

Update `.env.example` to match.

- [x] **Step 2: Failing tests for `createCouple`**

Cases:

1. User with no active membership → couple `forming`, one active membership, audit `couple.created`
2. User with active membership → conflict (409)

- [x] **Step 3: Implement `createCouple` in a transaction**

```ts
await this.db.transaction(async (tx) => {
  // reject if active membership exists for user.id
  const [couple] = await tx
    .insert(couples)
    .values({ status: "forming" })
    .returning();
  await tx.insert(coupleMemberships).values({
    coupleId: couple.id,
    userId: user.id,
    status: "active",
  });
  await this.audit.append({
    actorUserId: user.id,
    action: "couple.created",
    entityType: "couple",
    entityId: couple.id,
  });
});
```

- [x] **Step 4: Failing tests for `createInvitation`**

1. Only active member of that couple can invite
2. Zod email
3. Token = high-entropy secret (`randomBytes` / `randomUUID`); store unique raw token (capability URL)
4. `expiresAt = now + INVITE_TTL_HOURS`
5. Rate limit: invites created by this user in last hour ≥ limit → 429
6. Audit `invitation.created` — **do not** log the token

- [x] **Step 5: Implement createInvitation + `GET /couples/me`**

Map domain errors: 403 / 409 / 429 / 400.

- [x] **Step 6: Wire `CouplesModule` into `AppModule`; run tests**

```bash
pnpm --filter @couple-space/api test
```

Expected: PASS

- [ ] **Step 7: Commit (only if user asked)**

```bash
git add apps/api
git commit -m "feat(api): create couple and partner invitations"
```

---

### Task 3: API — accept invitation → activate couple (idempotent)

**Files:**

- Modify: `apps/api/src/couples/couples.service.ts`
- Modify: `apps/api/src/couples/couples.controller.ts`
- Modify: `apps/api/src/couples/couples.service.test.ts`

**Interfaces:**

- `POST /invitations/:token/accept` → `{ coupleId, status: "active" }` (or current state if already active)
- `POST /invitations/:token/revoke` — inviter only; pending → revoked

- [x] **Step 1: Failing accept tests**

1. Happy path: forming + pending + verified invitee → membership, invite `accepted`, couple `active`; audit `invitation.accepted` + `couple.activated`
2. Unverified → 403 `email_unverified`
3. Wrong email → 403 `email_mismatch`
4. Invitee already in another couple → 409
5. Expired → 409/410
6. Double accept same user → idempotent success
7. Use `canAcceptInvitation` + `canActivateCouple` from `@couple-space/domain`

- [x] **Step 2: Implement accept in one transaction**

Lock invitation row when possible. Re-check status. Insert membership. Reload active memberships + `emailVerified`. If `canActivateCouple` ok → set couple `active`.

- [x] **Step 3: Implement revoke**

Pending → revoked; audit `invitation.revoked`.

- [x] **Step 4: Run tests**

```bash
pnpm --filter @couple-space/api test
```

Expected: PASS

- [x] **Step 5: Commit (only if user asked)**

```bash
git add apps/api
git commit -m "feat(api): accept invite and activate couple"
```

---

### Task 4: Web — couple dashboard, invite, accept

**Files:**

- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/(app)/couple/page.tsx`
- Create: `apps/web/app/(app)/invite/page.tsx` (optional “send invite” UI if not on couple page)
- Create: `apps/web/app/invite/[token]/page.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**

- Consumes: `POST /couples`, `POST /couples/:id/invitations`, `POST /invitations/:token/accept`, `GET /couples/me`
- All via `apiFetch` + cookies

- [x] **Step 1: App layout**

Require session: call `GET /me`; on 401 redirect to `/login`.

- [x] **Step 2: Couple page**

- No couple → “Create couple space” → `POST /couples` → show `forming`  
- Forming → invite form (email) → show link `{origin}/invite/{token}`  
- Active → “Couple active” + partner summary (no community chrome)  

- [x] **Step 3: Accept page `/invite/[token]`**

Require login; if `emailVerified` false, prompt to run dev verify (dev only) or show “verify email”. Accept → `POST /invitations/:token/accept` → redirect `/couple`.

- [x] **Step 4: End-to-end manual checklist**

1. User A signs up, verifies, creates couple
2. User A invites User B’s email
3. User B signs up with that email, verifies
4. User B opens invite link, accepts
5. Both see couple `active`
6. User B cannot create another couple
7. Re-accept same invite is safe

- [x] **Step 5: Commit (only if user asked)**

```bash
git add apps/web
git commit -m "feat(web): couple creation, invite, and accept flows"
```

---

### Task 5: ADR + Slice 1 definition of done

**Files:**

- Create: `docs/architecture/decisions/adr-001-nest-owned-auth-and-formation.md`
- Optional note on platform design auth section → Nest-owned auth design

- [x] **Step 1: Write ADR-001**

Capture:

- Nest-owned auth (why not Supabase Auth: IT / no local Supabase)
- Dual cookie + Bearer transport for web + future native
- Dev verify temporary; mailer follow-up
- Drizzle on Postgres; Nest owns couple/invite authz (not RLS-as-primary)
- Domain package for accept/activate invariants

- [x] **Step 2: Slice 1 DoD checklist**
- [x] Domain tests pass  
- [x] API tests pass (auth + couples)  
- [x] Migrations apply; `password_hash` is text  
- [x] Auth manual smoke green (`docs/engineering/auth-manual-smoke.md`)  
- [x] Web E2E checklist in Task 4 passes  
- [x] No session/community tables  
- [x] Audit events for auth + couple create/accept/revoke  
- [x] No `@supabase/`* auth packages in web  
- [x] **Step 3: Commit (only if user asked)**

```bash
git add docs/architecture
git commit -m "docs: ADR-001 nest-owned auth and couple formation"
```

---

## Plan self-review

**Coverage:** Remaining Nest auth web + formation couple API/UI + ADR updated for Nest (not Supabase).  
**Out of scope:** Platform onboarding docs pack, real mailer, native app, conversation engine.  
**Type consistency:** `AuthUser.id` = JWT `sub` = `users.id`; couple statuses from `@couple-space/domain`.