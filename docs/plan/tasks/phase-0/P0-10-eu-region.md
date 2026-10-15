# P0-10 · Move Railway to an EU region

[← Phase 0](../phase-0-core-loop.md) · Size **S** · Do this **first** · Owner answer: [O-2](../../04-owner-answers.md#o-2) · Also covers [P0-8](P0-8-clean-sandbox.md)

**Goal:** all three Railway services (`Postgres`, `api`, `web`) run in an EU region before anyone's real
answers are stored.

**Done when:**
- `Postgres`, `api` and `web` each show an EU region in Railway.
- The web URL works end to end (register, couple, start, answer).
- `docs/deployment/railway.md` records the region.

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Railway setup | [`docs/deployment/railway.md`](../../../deployment/railway.md) | Service names, variables and config-as-code |
| Pre-deploy | `apps/api/railway.json` | Runs migrations + the catalogue seed on every `api` deploy, so a fresh DB is self-populating |
| Variable references | `DATABASE_URL=${{Postgres.DATABASE_URL}}` | Resolves to whichever service is named `Postgres` |

No code changes.

---

## Steps

Railway's UI changes often. If a label below doesn't match, check Railway's docs for "regions".

### Step 1 · Move `api` and `web`

For each of `api` and `web`: **Settings → Deploy → Regions** (it may be labelled "Region" or "Replicas"),
choose an EU region (e.g. EU West / Amsterdam) and redeploy. They're stateless, so nothing is lost.

### Step 2 · Replace `Postgres` with a fresh EU database

A database has a volume, and moving a volume between regions isn't always a one-click change. The data is
throwaway test data, so the simplest, safest path is a fresh database:

1. Rename the old service from `Postgres` to `Postgres-old` (so variable references stop pointing at it).
2. **+ New → Database → PostgreSQL**, name it exactly `Postgres`, and set its region to the same EU region.
3. Check `api` → Variables: `DATABASE_URL` still reads `${{Postgres.DATABASE_URL}}` and now resolves to the new service.
4. Redeploy `api`. Pre-deploy runs all migrations and the seed on the empty database.
5. Smoke test (below). Once it works, delete `Postgres-old`. That also removes the orphan sessions ([P0-8](P0-8-clean-sandbox.md)).

> You'll need to register again: accounts lived in the old database.

### Step 3 · Record it

Add to `docs/deployment/railway.md` under "1. Create the project":

```md
**Region:** all services run in **EU West (Amsterdam)**. Keep any new service in the same region: user
data must stay in the EU (owner decision O-2, `docs/plan/04-owner-answers.md`).
```

---

## Check

1. Each service's settings show the EU region.
2. Open the web URL → register two accounts → create a couple → accept the invite → `/start` shows the 6 themes (the seed ran).
3. `api` deploy logs show the migrations and the seed running against the new database.
