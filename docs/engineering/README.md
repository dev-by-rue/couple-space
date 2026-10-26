# Engineering

[Scope](../product/scope.md) · [Decisions](../product/decisions.md) · [Board](../plan/board.md)

How the product is built. Product rules live in [`scope.md`](../product/scope.md), not here. Code
conventions are in the root `CLAUDE.md` and `apps/web/CLAUDE.md`.

## Stack

| Part | Choice |
| --- | --- |
| Repo | Turbo + pnpm monorepo, TypeScript strict |
| Web | `apps/web`: Next.js, React Query, React Hook Form + Zod, Base UI / shadcn |
| API | `apps/api`: NestJS modular monolith. Owns auth ([ADR-001](../product/decisions.md#adr-001)), every business rule and every authorization check |
| Domain | `packages/domain`: pure TypeScript rules and Zod schemas shared by the API and the web |
| Database | `packages/database`: Drizzle schema, migrations and the catalogue seed, on Postgres |
| Hosting | Railway in an EU region: Postgres, `api` on the private network, `web` proxying `/backend/*` ([deployment](../deployment/railway.md)) |
| Notifications | Web push from Nest; an installable web app, no native app ([Q23](../product/decisions.md#q23)) |
| Tests | Vitest in `domain`, `database`, `api` and `apps/web/lib` |

## Rules

- No `any` without a reason. Validate external input at runtime. Prefer explicit domain types.
- Business rules and redaction live in `packages/domain` and Nest, never in React components.
  Never rely on the client for consent, membership or moderation checks.
- Use database constraints for hard invariants. Make critical operations idempotent.
- Security-sensitive actions write an audit event. Audit metadata is ids and enums only, never answer or
  prompt text ([E-7](../product/decisions.md#e-7)). Never log intimate content.
- Test domain invariants before UI polish. No microservices or premature abstraction.
- Explain technical debt rather than hiding it. Flag anything that drifts toward the scope's non-goals.
- Don't build or model [roadmap](../product/roadmap.md) items until they're promoted into `scope.md`.

## Docs layout

| Path | What it's for |
| --- | --- |
| `docs/product/scope.md` | What the product does today (authoritative) |
| `docs/product/decisions.md` | Why: Q (product), E (data model), O (owner), ADR (architecture). Append, don't rewrite |
| `docs/product/roadmap.md` | Future ideas, directional only |
| `docs/plan/board.md` | Every open task, its order and gate; done list; progress log |
| `docs/plan/guides/` | Full-code guides for tasks not yet merged. **Delete a guide when its task merges** |
| `docs/engineering/` | This file, manual smoke tests, the Postman collection |
| `docs/deployment/railway.md` | Deploying and operating the Railway environments |

## Manual checks

- [`auth-manual-smoke.md`](auth-manual-smoke.md): register, verify, cookie and Bearer sessions, refresh, logout.
- [`conversation-api-smoke.md`](conversation-api-smoke.md): the conversation API and the two-browser loop.
- [`postman/couple-space.postman_collection.json`](postman/couple-space.postman_collection.json): the same calls for Postman.
