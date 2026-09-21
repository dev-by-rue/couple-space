# Couple Page Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple `/couple` and lightly refactor `/invite/[token]` into domain schema + hooks + flat molecules/organisms, without Next.js API routes.

**Architecture:** Promote `createInvitationSchema` to `@couple-space/domain`; Nest DTO re-exports it. Web uses `hooks/use-couple.ts` and atomic UI (`ui` atoms, flat `molecules` / `organisms`). Pages orchestrate only. Browser still calls Nest via `apiFetch`.

**Tech Stack:** Next.js (apps/web), NestJS (apps/api), React Query, RHF + Zod, `@couple-space/domain`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-couple-page-decoupling-design.md`

## Global Constraints

- No Next.js `app/api` BFF routes
- No Nest endpoint changes (DTO import path only)
- Atoms stay in `components/ui/`; molecules/organisms are flat (no `couple/` subfolders)
- Do not migrate `components/auth/*`
- Do not commit unless the user explicitly asks
- Behavior parity with current create / invite / accept flows

## File map

| Path | Action |
|---|---|
| `packages/domain/src/invitation-schemas.ts` | Create |
| `packages/domain/src/invitation-schemas.test.ts` | Create |
| `packages/domain/src/index.ts` | Export invitation schemas |
| `apps/api/src/couples/dto/create-invitation.schema.ts` | Re-export from domain |
| `apps/web/hooks/use-couple.ts` | Create |
| `apps/web/components/molecules/couple-member-item.tsx` | Create |
| `apps/web/components/molecules/invite-link-display.tsx` | Create |
| `apps/web/components/organisms/create-couple-panel.tsx` | Create |
| `apps/web/components/organisms/couple-members-list.tsx` | Create |
| `apps/web/components/organisms/invite-partner-form.tsx` | Create |
| `apps/web/components/organisms/accept-invite-panel.tsx` | Create |
| `apps/web/app/(app)/couple/page.tsx` | Thin orchestration |
| `apps/web/app/invite/[token]/page.tsx` | Thin + AcceptInvitePanel |

---

### Task 1: Domain invitation schema

**Files:**
- Create: `packages/domain/src/invitation-schemas.ts`
- Create: `packages/domain/src/invitation-schemas.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `apps/api/src/couples/dto/create-invitation.schema.ts`

**Interfaces:**
- Produces: `createInvitationSchema`, `CreateInvitationInput`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { createInvitationSchema } from "./invitation-schemas.js";

describe("createInvitationSchema", () => {
  it("accepts a valid email and normalizes it", () => {
    const parsed = createInvitationSchema.parse({
      email: "  Partner@Example.com ",
    });
    expect(parsed.email).toBe("partner@example.com");
  });

  it("rejects invalid email", () => {
    expect(() =>
      createInvitationSchema.parse({ email: "not-an-email" }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `cd packages/domain && npx vitest run src/invitation-schemas.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement schema + export + Nest re-export**

`invitation-schemas.ts` — match `loginSchema` email style:

```ts
import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
```

`index.ts`: `export * from "./invitation-schemas.js";`

Nest DTO:

```ts
/**
 * Re-export shared invitation schema from domain.
 * Nest keeps this path so controllers/services do not import package paths ad hoc.
 */
export {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@couple-space/domain";
```

- [ ] **Step 4: Run domain tests — expect pass**

Run: `cd packages/domain && npx vitest run src/invitation-schemas.test.ts`  
Expected: PASS

- [ ] **Step 5: Run API couple tests**

Run: `cd apps/api && npx vitest run src/couples/couples.service.test.ts`  
Expected: PASS (or project’s usual test command if different)

---

### Task 2: `use-couple` hooks

**Files:**
- Create: `apps/web/hooks/use-couple.ts`

**Interfaces:**
- Produces:
  - `CoupleMe` type
  - `useCoupleMeQuery()`
  - `useCreateCoupleMutation(options?)`
  - `useCreateInviteMutation(options?)` — vars `{ coupleId: string; email: string }`
  - `useAcceptInviteMutation(options?)` — vars `{ token: string }`
- Consumes: `apiFetch`, `@tanstack/react-query`

- [ ] **Step 1: Implement hooks** (mirror `use-auth-mutations.ts` option-spreading pattern)

- `useCoupleMeQuery`: queryKey `["couples", "me"]`; on Error with message including `"404"` return `null`
- `useCreateCoupleMutation`: `POST /couples`; default `onSuccess` invalidates `["couples", "me"]` (compose with caller `onSuccess` if provided)
- `useCreateInviteMutation`: `POST /couples/${coupleId}/invitations` body `{ email }`
- `useAcceptInviteMutation`: `POST /invitations/${token}/accept`

- [ ] **Step 2: Typecheck web (or rely on later page compile)**

Run: `cd apps/web && npx tsc --noEmit` (if configured)  
Expected: no errors related to `use-couple.ts`

---

### Task 3: Molecules

**Files:**
- Create: `apps/web/components/molecules/couple-member-item.tsx`
- Create: `apps/web/components/molecules/invite-link-display.tsx`

**Interfaces:**
- Produces:
  - `CoupleMemberItem({ displayName, email, emailVerified })`
  - `InviteLinkDisplay({ href })`

- [ ] **Step 1: Implement presentational molecules** (no hooks)

Member item: `{displayName} ({email})` + optional ` — unverified`  
Invite link: “Share this link: …” with `break-all` muted box (match current page styling)

---

### Task 4: Organisms

**Files:**
- Create: `apps/web/components/organisms/create-couple-panel.tsx`
- Create: `apps/web/components/organisms/couple-members-list.tsx`
- Create: `apps/web/components/organisms/invite-partner-form.tsx`
- Create: `apps/web/components/organisms/accept-invite-panel.tsx`

**Interfaces:**
- Consumes: hooks from Task 2, molecules from Task 3, ui atoms, `createInvitationSchema`, `useResendVerificationMutation`
- Produces:
  - `CreateCouplePanel()`
  - `CoupleMembersList({ members: CoupleMe["members"] })`
  - `InvitePartnerForm({ coupleId: string })`
  - `AcceptInvitePanel({ token, email, emailVerified, onAccepted, onVerifiedRefresh })`

- [ ] **Step 1: CreateCouplePanel** — heading/copy from current empty state; `useCreateCoupleMutation`; show mutation error; Button create

- [ ] **Step 2: CoupleMembersList** — map to `CoupleMemberItem`

- [ ] **Step 3: InvitePartnerForm** — RHF + zodResolver(`createInvitationSchema`); Field/Input like login; `useCreateInviteMutation`; on success set invite link via `InviteLinkDisplay`; show mutation error

- [ ] **Step 4: AcceptInvitePanel** — move verification resend + accept button/error UI from invite page; `useAcceptInviteMutation` with `onSuccess: onAccepted`; resend uses `useResendVerificationMutation` and calls `onVerifiedRefresh` when `alreadyVerified`

---

### Task 5: Thin pages

**Files:**
- Modify: `apps/web/app/(app)/couple/page.tsx`
- Modify: `apps/web/app/invite/[token]/page.tsx`

- [ ] **Step 1: Rewrite couple page** — `useCoupleMeQuery` only; branch pending / error / null→CreateCouplePanel / else header + CoupleMembersList + active copy or InvitePartnerForm

- [ ] **Step 2: Rewrite invite page** — keep me query + unauth redirect; render `AcceptInvitePanel` with token, email, emailVerified, `onAccepted={() => router.replace("/couple")}`, `onVerifiedRefresh={() => me.refetch()}`

- [ ] **Step 3: Verify**

Run domain tests + API couples tests again.  
Smoke mentally: imports resolve; no leftover local mutations on couple page.

---

## Spec coverage checklist

- [x] Domain schema + Nest re-export → Task 1
- [x] Hooks → Task 2
- [x] Molecules → Task 3
- [x] Organisms → Task 4
- [x] Thin pages + invite light refactor → Task 5
- [x] No BFF / no auth migrate → Global Constraints
