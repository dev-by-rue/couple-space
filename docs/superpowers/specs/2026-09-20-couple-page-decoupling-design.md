# Couple Page Decoupling — Design

**Date:** 2026-09-20  
**Status:** Approved for planning  
**Product source of truth:** `docs/product/scope.md`  
**Related:**
- `docs/superpowers/specs/2026-09-16-auth-forms-cleanup-design.md` (form / hook patterns)
- `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md`
- `docs/architecture/decisions/adr-001-nest-owned-auth-and-formation.md`

## 1. Goal

Decouple `/couple` (and lightly `/invite/[token]`) so pages orchestrate state, organisms own feature UI + mutations, molecules stay presentational, and invitation validation is shared via `@couple-space/domain` — without adding Next.js API routes or changing Nest couple endpoints.

## 2. Why

- `apps/web/app/(app)/couple/page.tsx` currently owns types, query, two mutations, invite form state, and three UI layouts in one file.
- Auth already split into domain schemas + `hooks/use-auth-mutations.ts` + form components; couple formation should follow the same boundaries.
- Atomic design: `components/ui` is the atom layer; higher couple UI should live in flat `molecules/` and `organisms/` rather than a feature dump folder.

## 3. Decisions locked

| Topic | Choice |
|---|---|
| Depth | Hooks + UI components (not hooks-only) |
| Invite accept page | Light refactor onto shared couple hooks / accept organism |
| Form polish | Align invite form with auth: `Field` / `Input` / RHF / zod |
| Invitation schema | Promote to `@couple-space/domain`; Nest DTO becomes thin re-export |
| Transport | Unchanged: `apiFetch` → Nest; **no** Next.js `app/api` BFF |
| Component taxonomy | Atomic design: atoms in `ui/`, flat `molecules/`, flat `organisms/` |
| Auth migration | Do **not** move `components/auth/*` into molecules/organisms in this work |

## 4. Scope

### In scope

- Add `packages/domain/src/invitation-schemas.ts` with `createInvitationSchema` (+ `CreateInvitationInput`); email style matches `loginSchema` (`trim` → `email` → `toLowerCase`); export from domain `index.ts`
- Domain unit test for invitation email normalize (same spirit as `auth-schemas.test.ts`)
- Nest `create-invitation.schema.ts` re-exports from domain (mirror `login.schema.ts`)
- `hooks/use-couple.ts` (also exports `CoupleMe` response type used by query + members list):
  - `useCoupleMeQuery` — `GET /couples/me`; 404 → `null`; other errors throw
  - `useCreateCoupleMutation` — `POST /couples`; invalidate `["couples", "me"]`
  - `useCreateInviteMutation` — variables `{ coupleId: string; email: string }` → `POST /couples/:coupleId/invitations`
  - `useAcceptInviteMutation` — variables `{ token: string }` → `POST /invitations/:token/accept`
- Molecules (flat under `components/molecules/`):
  - `couple-member-item` — one member row
  - `invite-link-display` — shareable invite URL block
- Organisms (flat under `components/organisms/`):
  - `create-couple-panel` — empty state + create CTA
  - `couple-members-list` — maps members → member items
  - `invite-partner-form` — RHF + domain schema + create-invite mutation + link display
  - `accept-invite-panel` — verification resend + accept CTA (uses existing `useResendVerificationMutation` + `useAcceptInviteMutation`)
- Thin `/couple` and `/invite/[token]` pages: loading / error / empty branching and redirects only
- Drop page-level shared `error` `useState`; each organism surfaces its own mutation / field errors

### Out of scope

- Next.js Route Handlers / BFF proxies
- New Nest couple endpoints or revoke-invite UI
- Visual redesign beyond Field/Input/RHF alignment
- Migrating login/register into molecules/organisms
- Changing couple product rules (still: create → invite → two verified members → active)

## 5. Architecture

```
@couple-space/domain     createInvitationSchema
        ↑                        ↑
   apps/api DTO re-export   apps/web RHF resolver
                                 ↑
                      hooks/use-couple.ts
                                 ↑
              organisms (forms / panels)
                                 ↑
              molecules (member row, invite link)
                                 ↑
              atoms: components/ui/*
                                 ↑
              app/(app)/couple  +  app/invite/[token]
```

**Wire protocol unchanged:** browser → `apiFetch` + `credentials: "include"` → Nest JWT cookie auth.

**Query key:** `["couples", "me"]` remains the couple cache key; create couple invalidates it.

**Invite link:** still built client-side as `${window.location.origin}/invite/${token}` after create-invite succeeds.

## 6. Atomic component map

| Layer | Path | Couple pieces |
|---|---|---|
| Atom | `components/ui/*` | Reuse `Button`, `Input`, `Field*`, `Label`; add atoms only if something generic is missing |
| Molecule | `components/molecules/*` | `couple-member-item`, `invite-link-display` |
| Organism | `components/organisms/*` | `create-couple-panel`, `couple-members-list`, `invite-partner-form`, `accept-invite-panel` |
| Page | `app/.../page.tsx` | State machine / redirects; compose organisms |

Hooks are not a design-system layer; organisms call them the way `LoginForm` calls `useLoginMutation`.

### Page composition

**`/couple`**
1. Pending → loading copy  
2. Query error → error copy  
3. `data === null` → `CreateCouplePanel`  
4. Else → status header + `CoupleMembersList` + (`active` message | `InvitePartnerForm`)

**`/invite/[token]`**
1. `me` pending / unauthenticated redirect / page shell stay on the page  
2. Body → `AcceptInvitePanel` (token + me summary + onAccepted navigate)

## 7. Errors

- Couple **query** failures render on the page.
- Create / invite / accept **mutation** failures render inside the owning organism.
- Field validation errors via RHF + `FieldError` on the invite form.
- `404` on `/couples/me` is an expected empty state inside `useCoupleMeQuery`, not an error UI.

## 8. Testing & verification

- Domain: invitation schema normalize tests.
- API: existing couples tests pass after DTO re-export (behavior unchanged).
- Web: no new E2E required for this refactor.
- Manual smoke: create couple → create invite link → open `/invite/[token]` → accept → couple shows active / members.

## 9. Success criteria

- Behavior parity with current couple + invite-accept flows.
- Pages are orchestration-only.
- Organisms own forms/mutations; molecules are presentational.
- Invitation validation is single-sourced in domain.
- No Next.js API routes introduced.

## 10. Non-goals reminder

Do not invent product rules. Couple formation remains as in `docs/product/scope.md`: invitation link + email verification gates, max one active couple, two-person MVP.
