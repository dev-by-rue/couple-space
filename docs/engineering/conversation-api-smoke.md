# Manual smoke test — conversation API (two users)

**Purpose:** Prove the private conversation loop works at the API level, before any UI: soft lock (no partner answer until both submit) and **per-user Reveal** (one partner revealing does not reveal for the other).
**Plan:** `docs/superpowers/plans/2026-09-21-conversation-walking-skeleton.md` (Consolidated plan, step 2)
**Rules:** `docs/product/scope.md` → Core interaction loop

---

## 1. Prerequisites

- Local Postgres 15 running (`brew services list` → `postgresql@15 started`), `.env` `DATABASE_URL` → `127.0.0.1:5432`
- Migrations applied + prompts seeded:
  ```bash
  pnpm --filter @couple-space/database migrate
  pnpm --filter @couple-space/database seed
  ```
- API running on `http://localhost:8080` (`pnpm dev`)
- An **active** couple. Local test couple:

  | User | Email | Password |
  |---|---|---|
  | A | `ruebencee@gmail.com` | `Password1234` |
  | B | `partner@test.local` | `Password1234` |

  Missing? Recreate via §6.

---

## 2. Postman setup

Postman shares **one cookie jar per domain**, so two users logged in at once would overwrite each other. Use **Bearer tokens** instead (the API accepts both).

**Environment variables:** `baseUrl` = `http://localhost:8080`, plus empty `tokenA`, `tokenB`, `promptId`, `sessionId`.

**Turn off cookies for localhost:** Cookies → Manage cookies → remove `localhost`, or disable "Send cookies automatically" in the request settings — otherwise a stale cookie may authenticate as the wrong user.

**Save tokens automatically** — on each Login request, Scripts → Post-response:

```js
// Login A — use "tokenB" on Login B
pm.environment.set("tokenA", pm.response.json().accessToken);
```

Access tokens last 15 minutes. If you get `401` mid-run, re-send the two logins.

---

## 3. Endpoints

All conversation endpoints require `Authorization: Bearer {{tokenA}}` (or `tokenB`). Bodies are JSON (`Content-Type: application/json`).

| # | Name | Method + path | Body | Notes |
|---|---|---|---|---|
| 1 | Login A | `POST {{baseUrl}}/auth/login` | `{"email":"ruebencee@gmail.com","password":"Password1234"}` | Save `accessToken` → `tokenA` |
| 2 | Login B | `POST {{baseUrl}}/auth/login` | `{"email":"partner@test.local","password":"Password1234"}` | Save → `tokenB` |
| 3 | Couple (A) | `GET {{baseUrl}}/couples/me` | — | Expect `"status":"active"` |
| 4 | Themes (A) | `GET {{baseUrl}}/themes` | — | Copy `themes[0].prompts[0].id` → `promptId` |
| 5 | Create session (A) | `POST {{baseUrl}}/sessions` | `{"promptId":"{{promptId}}"}` | Copy `id` → `sessionId` |
| 6 | List sessions | `GET {{baseUrl}}/sessions` | — | Each item has the **viewer's** `phase` |
| 7 | Get session | `GET {{baseUrl}}/sessions/{{sessionId}}` | — | Duplicate as "Get session (A)" and "(B)" |
| 8 | Submit answer | `POST {{baseUrl}}/sessions/{{sessionId}}/responses` | `{"text":"..."}` | Once per user; immutable |
| 9 | Reveal | `POST {{baseUrl}}/sessions/{{sessionId}}/reveal` | — | Only after both submitted |

Suggested script for #4 and #5 so you don't copy ids by hand:

```js
// Themes
pm.environment.set("promptId", pm.response.json().themes[0].prompts[0].id);
// Create session
pm.environment.set("sessionId", pm.response.json().id);
```

---

## 4. Run sheet — what to check

After each action, send **Get session (A)** and **Get session (B)**. Use distinctive answers (e.g. `A-SECRET`, `B-SECRET`) so a leak is obvious.

| Step | Action | A: `phase` / texts | B: `phase` / texts |
|---|---|---|---|
| 0 | A creates session | `answering` / both `null` | `answering` / both `null` |
| 0b | B → Reveal | **`403 not_ready_to_reveal`** | |
| 1 | A submits | `waiting_for_partner` / own text, B `null` | `answering` / **A's text `null`** |
| 1b | A submits again | **`409 already_submitted`** | |
| 2 | B submits | `ready_to_reveal` / own text, **B `null`** | `ready_to_reveal` / own text, **A `null`** |
| 3 | A → Reveal | `revealed` / **both texts** | `ready_to_reveal` / **A still `null`** |
| 4 | B → Reveal | `revealed` / both | `revealed` / both |
| 5 | Get session, no auth header | **`401`** | |

**Pass =** every bold cell matches. The critical ones are rows 1–3: partner text must be `null` until *that viewer* has revealed.

Also expected (not bugs):
- You always see **your own** answer text once submitted.
- `partnerSubmitted: true` is visible before reveal — scope allows showing *that* the partner answered, never *what*.

---

## 5. curl equivalent

Cookie jars keep the two users separate:

```bash
U=http://localhost:8080; H='Content-Type: application/json'
curl -s -c /tmp/a.jar -X POST $U/auth/login -H "$H" -d '{"email":"ruebencee@gmail.com","password":"Password1234"}' >/dev/null
curl -s -c /tmp/b.jar -X POST $U/auth/login -H "$H" -d '{"email":"partner@test.local","password":"Password1234"}' >/dev/null
PID=$(curl -s -b /tmp/a.jar $U/themes | node -pe 'JSON.parse(require("fs").readFileSync(0)).themes[0].prompts[0].id')
SID=$(curl -s -b /tmp/a.jar -X POST $U/sessions -H "$H" -d "{\"promptId\":\"$PID\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s -b /tmp/a.jar -X POST $U/sessions/$SID/responses -H "$H" -d '{"text":"A-SECRET"}'
curl -s -b /tmp/b.jar $U/sessions/$SID   # A's text must be null
# ...continue with the run sheet
```

---

## 6. Recreating the test couple (fresh database)

`ENABLE_DEV_AUTH_ENDPOINTS=true` must be set in `.env` (enables `/auth/dev/verify`). Using cookie jars:

| Step | As | Request | Body |
|---|---|---|---|
| 1 | A | `POST /auth/register` | `{"email":"ruebencee@gmail.com","password":"Password1234","displayName":"Rueben","dateOfBirth":"1990-01-01"}` |
| 2 | B | `POST /auth/register` | `{"email":"partner@test.local","password":"Password1234","displayName":"Partner","dateOfBirth":"1990-01-01"}` |
| 3 | A, B | `POST /auth/dev/verify` | — |
| 4 | A | `POST /couples` | — → `coupleId` |
| 5 | A | `POST /couples/{coupleId}/invitations` | `{"email":"partner@test.local"}` → `token` |
| 6 | B | `POST /invitations/{token}/accept` | — → `"status":"active"` |

SMTP is unset locally, so no real email is sent.

---

## 7. Last run

**2026-10-09** — all rows passed (curl).
