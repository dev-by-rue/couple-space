# Deploying the sandbox to Railway

One Railway project with three services: **Postgres**, **api** (Nest) and **web** (Next). Testers only ever see the web URL; the API stays on Railway's private network.

```
browser ──► web (public URL)
              │  /backend/*  (Next rewrite, same origin → cookies stay first-party)
              ▼
            api (private network only) ──► Postgres
```

Why the proxy: auth uses `SameSite=Lax` httpOnly cookies. Two different `*.up.railway.app` hosts are different _sites_, so the browser would drop the cookies on cross-site `fetch`. Routing API calls through the web origin avoids that without touching the auth code.

## 1. Create the project

1. In Railway: **New Project → Deploy from GitHub repo → `dev-by-rue/couple-space`**. This creates the first service, rename it **`api`**.
2. **+ New → Database → PostgreSQL** (keep the default name `Postgres`).
3. **+ New → GitHub Repo → same repo** again, rename it **`web`**.

The service names matter: the variable references below use `api` and `Postgres`.

## 2. Service settings

For **both** `api` and `web`, leave **Root Directory empty** (the build needs the pnpm workspace at the repo root) and set **Config-as-code → Railway config file**:

| Service | Config file              |
| ------- | ------------------------ |
| api     | `/apps/api/railway.json` |
| web     | `/apps/web/railway.json` |

Those files hold the build, start, pre-deploy and watch settings, so you don't need to set them in the UI. On every `api` deploy the pre-deploy step runs the Drizzle migrations and the catalogue seed. The seed is an upsert, so running it every time is safe.

Choose which branch each service deploys from under **Settings → Source**.

Networking:

- **web**: Settings → Networking → **Generate Domain**. This is the URL you share.
- **api**: don't generate a public domain. It's reached privately.

## 3. Variables

Paste these into each service's **Variables → Raw Editor**. The `${{…}}` references resolve inside Railway.

### api

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=8080
JWT_SECRET=<run: openssl rand -base64 48>
COOKIE_SECURE=true
ENABLE_DEV_AUTH_ENDPOINTS=false
WEB_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}

# Real SMTP so testers receive verification emails (see "Email" below)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<brevo SMTP login>
SMTP_PASS=<brevo SMTP key>
SMTP_FROM=<the sender address you verified in Brevo>

# Web push (P1-26). Generate once with
# `pnpm --filter @couple-space/api exec web-push generate-vapid-keys`.
# Never rotate on a live environment: existing subscriptions are tied to the public key.
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:<an address you read; push services use it for abuse reports>
```

`PORT=8080` is set explicitly so the web service can address the API on a known port. The API listens on `API_PORT`, falling back to `PORT`.

### web

```env
API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
NEXT_PUBLIC_API_URL=/backend

# Optional: welcome quote
NEXT_QUOTE_API_URL=https://api.api-ninjas.com/v2/randomquotes
NEXT_QUOTE_API_KEY=<api ninjas key>
```

Both `API_INTERNAL_URL` and `NEXT_PUBLIC_API_URL` are baked in at **build** time. After changing either, redeploy `web` (a restart isn't enough).

## 4. Email

Verification links are built from `WEB_ORIGIN`, so they point testers at the hosted web app. Ethereal only captures mail, so testers would never get the link. Any SMTP provider works; Brevo's free tier is the quickest for a sandbox because it only needs one verified sender address, not a whole domain. Resend needs a verified domain to send to anyone other than you.

## 5. Check it works

1. `api` deploy logs show the migrations, then `seeded N themes, M prompts`, then the healthcheck on `/health` passing.
2. Open the web URL, register, get the email, verify, and log in.
3. In devtools, the `cs_access` / `cs_refresh` cookies should be on the **web** domain, and API calls should go to `/backend/...`.

## Troubleshooting

| Symptom                                 | Likely cause                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Web calls go to `localhost:8080`        | `NEXT_PUBLIC_API_URL` wasn't set when `web` was built. Set it and redeploy.                                                   |
| `/backend/*` returns 404                | `API_INTERNAL_URL` wasn't set when `web` was built (it's declared in `turbo.json` `build.env`, so check the variable itself). |
| `/backend/*` returns 502 / ECONNREFUSED | `api` isn't up, or `PORT` on `api` doesn't match the port in `API_INTERNAL_URL`.                                              |
| `api` crashes on boot with a Zod error  | A required variable is missing, usually `JWT_SECRET` (it needs at least 32 characters) or `DATABASE_URL`.                     |
| Logged out immediately after login      | `COOKIE_SECURE=true` is fine over Railway's HTTPS. Check the browser is calling `/backend` and not the API host directly.     |

## Local development

Nothing changes. With `API_INTERNAL_URL` unset there's no rewrite, and the web app calls `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`) directly, as before.
