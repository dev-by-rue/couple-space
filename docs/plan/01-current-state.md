# 01 · Current state

[← Plan index](README.md) · Snapshot taken 2026-10-14 on `main` @ `a4507ede`. Update it when a gate is reached.

## Works today (local + Railway)

| Area | Status | Where |
| --- | --- | --- |
| Register / login / refresh / logout (API) | ✅ | `apps/api/src/auth` |
| Email verification (bypassed on Railway by `SANDBOX_AUTO_VERIFY`) | ✅ | `auth.service.ts`, `config/env.ts` |
| Create couple, invite partner, accept/revoke invite | ✅ | `apps/api/src/couples`, `/couple`, `/invite/[token]` |
| `/couple` hub: members, welcome banner, Start CTA, sorted conversation list | ✅ | `app/(app)/couple/page.tsx` |
| Themes + curated prompts (6 × 3, seeded every deploy) | ✅ | `packages/database/seed` |
| `/start` → `/start/[slug]` → pick prompt → `POST /sessions` | ✅ | `app/(app)/start` |
| Session API: get (redacted), submit (immutable), per-user reveal | ✅ API only | `apps/api/src/conversations` |
| Domain rules: viewer phase, answer visibility (+ tests) | ✅ | `packages/domain` |

## Why you can't go further

Picking a prompt creates a session and calls `router.push('/conversation/{id}')`, **but there is no
`/conversation/[id]` route in `apps/web`**, so you land on a 404. The hub cards link there too.

Everything that page needs already exists: the hooks `useSessionQuery`, `useSubmitResponseMutation` and
`useRevealSessionMutation`, and the API behind them. **The most valuable next task is that page**:
[Phase 0](tasks/phase-0-core-loop.md).

Side effects you'll see on Railway right now:

- Every prompt click creates a real session row, so there are probably orphan sessions in the hub.
- The prompt card isn't disabled while the mutation is pending, so a double-click creates two sessions.

## Not built at all

Logout button / app header, follow-ups (guided discussion), custom prompts, session completion,
password reset, account/couple settings, leaving a couple, legal pages, CI, monitoring, community,
moderation.
