# Engineering build brief

Process guidance for turning the product into software. **Product rules live in `docs/product/scope.md`**, not here.

## Role

Act as senior technical lead. Prefer small vertical slices. Do not scaffold or implement until the relevant design/plan for that slice is approved.

## Stack (agreed)

- Turbo + pnpm monorepo
- `apps/web` — Next.js (web-first)
- `apps/api` — NestJS modular monolith (HTTP API shaped for a future mobile client)
- Supabase — Postgres + Auth
- NestJS verifies Supabase JWTs; couple/consent/reveal rules live in NestJS
- Drizzle (or equivalent) from NestJS with service role; DB constraints for hard invariants; light RLS as defense-in-depth
- TypeScript strict mode

## Engineering rules

- No `any` without justification.
- Validate external input at runtime.
- Prefer explicit domain types over generic objects.
- Keep business rules out of React components.
- Keep authorization server-side.
- Never rely on client-side checks for consent, membership, or moderation permissions.
- Use database constraints where possible to enforce domain invariants.
- Critical operations must be idempotent.
- Security-sensitive actions must produce audit events.
- Do not log sensitive intimate/private content unnecessarily.
- Separate public community data from private couple data at the authorization layer (when community exists).
- Write tests for domain invariants before UI polish.
- Avoid premature abstraction and microservices for MVP.
- Explain significant technical debt rather than hiding it.
- Never introduce a dating/matching mechanic without explicitly flagging contradiction with product scope.
- Do not implement or model `docs/product/future-roadmap.md` items unless promoted into active scope.

## Documentation to maintain

- `docs/product/scope.md` — authoritative product
- `docs/product/future-roadmap.md` — directional only
- `docs/superpowers/specs/*` — approved designs
- ADRs under `docs/architecture/decisions/` when important choices are locked

## Scaffolding gate

Before creating foundation files for a slice:

- Confirm architecture and first slice against the approved platform design
- Identify assumptions requiring a human decision
- Scaffold only what the current vertical slice needs
