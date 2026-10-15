# P0-8 · Clean the sandbox data

[← Phase 0](../phase-0-core-loop.md) · Size **S** · **Covered by [P0-10](P0-10-eu-region.md)** if you create a fresh EU database

**Goal:** remove the sessions created while `/conversation/[id]` was a 404, so the hub only shows real conversations.

Only follow this page if you're **keeping** the current database (for example, if you postpone P0-10).

---

## Steps

Open the database (Railway → `Postgres` → **Data → Query**, or `psql "$DATABASE_URL"`).

### Step 1 · See what would be removed

These are sessions where nobody has submitted anything:

```sql
SELECT s.id, s.created_at, p.title
FROM conversation_sessions s
JOIN prompts p ON p.id = s.prompt_id
WHERE NOT EXISTS (
  SELECT 1 FROM session_responses r
  WHERE r.session_id = s.id AND r.submitted_at IS NOT NULL
)
ORDER BY s.created_at;
```

### Step 2 · Delete them in one transaction

```sql
BEGIN;

CREATE TEMP TABLE orphan_sessions AS
SELECT s.id
FROM conversation_sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM session_responses r
  WHERE r.session_id = s.id AND r.submitted_at IS NOT NULL
);

DELETE FROM session_reveals   WHERE session_id IN (SELECT id FROM orphan_sessions);
DELETE FROM session_responses WHERE session_id IN (SELECT id FROM orphan_sessions);
DELETE FROM conversation_sessions WHERE id IN (SELECT id FROM orphan_sessions);

-- Check the counts look right, then:
COMMIT;   -- or ROLLBACK;
```

Reveals and responses go first because they reference the session (no `ON DELETE CASCADE`).

---

## Check

`/couple` only shows sessions where at least one of you has answered.
