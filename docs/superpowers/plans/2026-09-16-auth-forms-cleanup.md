# Auth Forms Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Nest-backed login/register through branded RHF forms with shared domain Zod schemas, one mutation hooks file, and `/register` as the only signup route.

**Architecture:** Move `loginSchema` / `registerSchema` into `@couple-space/domain`. Nest DTOs re-export them. Web uses React Hook Form + Zod resolver and React Query mutations from `apps/web/hooks/use-auth-mutations.ts`. Pages own the two-column shell and `onAuthenticated` redirect; forms own fields and submit.

**Tech Stack:** Zod 4, `@couple-space/domain`, NestJS DTOs, Next.js `apps/web`, React Hook Form, `@hookform/resolvers`, TanStack React Query, existing `apiFetch` + httpOnly cookies.

## Global Constraints

- Product: `docs/product/scope.md` — private-first, couple-centric; do not invent age-gate rules beyond collecting `dateOfBirth`.
- Spec: `docs/superpowers/specs/2026-09-16-auth-forms-cleanup-design.md`.
- Auth contract: `docs/superpowers/specs/2026-08-30-nest-owned-auth-design.md` — register body `{ email, password, displayName, dateOfBirth }`; no OAuth; no password reset; no tokens in `localStorage`.
- Keep temporary `POST /auth/dev/verify` after register when `NODE_ENV === "development"` only.
- Mutations live in **one** file: `apps/web/hooks/use-auth-mutations.ts`.
- Canonical signup URL is `/register`; delete `/signup`.
- **Git commits:** only when the user explicitly asks (do not auto-commit).
- Prefer TDD for domain schema moves; comment *why* on cookie/`dev/verify`/shared-schema boundaries.

## File structure

```
packages/domain/src/
  auth-schemas.ts                 # loginSchema, registerSchema + types
  auth-schemas.test.ts            # password / DOB / email rules
  index.ts                        # re-export auth schemas

apps/api/src/auth/dto/
  login.schema.ts                 # re-export from domain
  register.schema.ts              # re-export from domain

apps/web/
  hooks/use-auth-mutations.ts     # useLoginMutation, useRegisterMutation
  components/auth/login.form.tsx  # RHF login
  components/auth/register.form.tsx
  app/login/page.tsx              # shell + LoginForm
  app/register/page.tsx           # shell + RegisterForm
  app/signup/                    # DELETE
  app/page.tsx                    # /signup → /register
  app/invite/[token]/page.tsx    # /signup → /register
  package.json                    # RHF deps + @couple-space/domain
```

---

### Task 1: Shared auth schemas in `@couple-space/domain`

**Files:**
- Create: `packages/domain/src/auth-schemas.ts`
- Create: `packages/domain/src/auth-schemas.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/package.json` (add `zod` dependency matching API `^4.5.1`)
- Modify: `apps/api/src/auth/dto/login.schema.ts`
- Modify: `apps/api/src/auth/dto/register.schema.ts`

**Interfaces:**
- Produces: `loginSchema`, `registerSchema`, `LoginInput`, `RegisterInput` from `@couple-space/domain`
- Consumes: existing Nest `.parse(body)` call sites unchanged via DTO re-exports

- [ ] **Step 1: Add zod to domain and write failing tests**

From repo root:

```bash
pnpm --filter @couple-space/domain add zod@^4.5.1
```

Create `packages/domain/src/auth-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth-schemas.js";

describe("registerSchema", () => {
  const valid = {
    email: "  Alex@Example.com ",
    password: "Password1234",
    displayName: "Alex",
    dateOfBirth: "1990-01-15",
  };

  it("accepts a valid payload and normalizes email", () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe("alex@example.com");
    expect(parsed.displayName).toBe("Alex");
  });

  it("rejects short passwords", () => {
    expect(() =>
      registerSchema.parse({ ...valid, password: "Short1A" }),
    ).toThrow();
  });

  it("rejects passwords missing complexity", () => {
    expect(() =>
      registerSchema.parse({ ...valid, password: "passwordpassword" }),
    ).toThrow();
  });

  it("rejects bad dateOfBirth formats", () => {
    expect(() =>
      registerSchema.parse({ ...valid, dateOfBirth: "15-01-1990" }),
    ).toThrow();
  });
});

describe("loginSchema", () => {
  it("normalizes email", () => {
    const parsed = loginSchema.parse({
      email: "Pat@Example.com",
      password: "x",
    });
    expect(parsed.email).toBe("pat@example.com");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
pnpm --filter @couple-space/domain test
```

Expected: FAIL resolving `./auth-schemas.js` or equivalent.

- [ ] **Step 3: Implement schemas (move rules from Nest DTOs verbatim)**

Create `packages/domain/src/auth-schemas.ts`:

```ts
import { z } from "zod";

/**
 * Shared auth request shapes for Nest DTOs and web RHF.
 * Keep password policy and profile fields identical on client and server
 * so validation drift cannot open an accept-then-reject gap.
 */
export const loginSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password policy: min 12 + upper/lower/digit.
 * Product profile: displayName + dateOfBirth required at signup.
 * Age-gate policy using DOB is explicitly out of Slice 1 — collect only.
 */
export const registerSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z
    .string()
    .min(12)
    .regex(/[a-z]/, "password needs a lowercase letter")
    .regex(/[A-Z]/, "password needs an uppercase letter")
    .regex(/[0-9]/, "password needs a digit"),
  displayName: z.string().trim().min(1).max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

Update `packages/domain/src/index.ts`:

```ts
export * from "./couple-status.js";
export * from "./invitation-status.js";
export * from "./membership-status.js";
export * from "./can-accept-invitation.js";
export * from "./can-activate-couple.js";
export * from "./auth-schemas.js";
```

- [ ] **Step 4: Run domain tests — expect PASS**

```bash
pnpm --filter @couple-space/domain test
pnpm --filter @couple-space/domain build
```

Expected: PASS; `dist/` includes auth schema types.

- [ ] **Step 5: Thin Nest DTO re-exports**

Replace `apps/api/src/auth/dto/login.schema.ts` with:

```ts
/**
 * Re-export shared login schema from domain.
 * Nest keeps this path so controllers/services do not import package paths ad hoc.
 */
export {
  loginSchema,
  type LoginInput,
} from "@couple-space/domain";
```

Replace `apps/api/src/auth/dto/register.schema.ts` with:

```ts
/**
 * Re-export shared register schema from domain.
 * Single source of truth for password policy + profile fields.
 */
export {
  registerSchema,
  type RegisterInput,
} from "@couple-space/domain";
```

- [ ] **Step 6: Run API auth tests**

```bash
pnpm --filter @couple-space/api test
```

Expected: PASS (imports resolve via DTO re-exports).

- [ ] **Step 7: Commit (only if user asked)**

```bash
git add packages/domain apps/api/src/auth/dto
git commit -m "$(cat <<'EOF'
refactor(domain): share login and register Zod schemas

EOF
)"
```

---

### Task 2: Web deps + `use-auth-mutations.ts`

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Create: `apps/web/hooks/use-auth-mutations.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/api`; `LoginInput` / `RegisterInput` from `@couple-space/domain`
- Produces:
  - `useLoginMutation(options?: UseMutationOptions<unknown, Error, LoginInput>)`
  - `useRegisterMutation(options?: UseMutationOptions<unknown, Error, RegisterInput>)` — register then optional `dev/verify`

- [ ] **Step 1: Install web dependencies**

```bash
pnpm --filter @couple-space/web add @couple-space/domain react-hook-form @hookform/resolvers zod@^4.5.1
```

- [ ] **Step 2: Create mutation hooks**

Create `apps/web/hooks/use-auth-mutations.ts`:

```ts
"use client";

import {
  useMutation,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { LoginInput, RegisterInput } from "@couple-space/domain";
import { apiFetch } from "@/lib/api";

/**
 * Nest sets httpOnly cs_access / cs_refresh on success.
 * Web must never put access tokens in localStorage — apiFetch uses credentials: "include".
 */
export function useLoginMutation(
  options?: UseMutationOptions<unknown, Error, LoginInput>,
) {
  return useMutation({
    ...options,
    mutationFn: (body: LoginInput) =>
      apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

/**
 * Register then, in development only, call POST /auth/dev/verify.
 * TEMPORARY: stands in for "click link in verification email".
 * Replace with a real mailer + verify-token flow later.
 */
export function useRegisterMutation(
  options?: UseMutationOptions<unknown, Error, RegisterInput>,
) {
  return useMutation({
    ...options,
    mutationFn: async (body: RegisterInput) => {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (process.env.NODE_ENV === "development") {
        await apiFetch("/auth/dev/verify", { method: "POST" });
      }
    },
  });
}
```

- [ ] **Step 3: Typecheck web (hooks only must compile)**

```bash
pnpm --filter @couple-space/web exec tsc --noEmit
```

Expected: PASS, or only pre-existing errors unrelated to this file. Fix any errors from missing domain types / exports.

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml apps/web/hooks/use-auth-mutations.ts
git commit -m "$(cat <<'EOF'
feat(web): add shared auth mutation hooks

EOF
)"
```

(If the lockfile lives only at repo root, stage that path instead.)

---

### Task 3: RHF `LoginForm` and `RegisterForm`

**Files:**
- Modify: `apps/web/components/auth/login.form.tsx`
- Modify: `apps/web/components/auth/register.form.tsx`

**Interfaces:**
- Consumes: `useLoginMutation` / `useRegisterMutation`; `loginSchema` / `registerSchema` from `@couple-space/domain`; `withNextQuery` from `@/lib/auth-redirect`
- Produces:
  - `LoginForm({ onAuthenticated, next, className? })`
  - `RegisterForm({ onAuthenticated, next, className? })`
  - `next` is the sanitized path used only for cross-links (`withNextQuery`); redirect itself is `onAuthenticated`

- [ ] **Step 1: Rewrite `login.form.tsx`**

Replace the file with:

```tsx
"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@couple-space/domain";
import { cn } from "@/lib/utils";
import { withNextQuery } from "@/lib/auth-redirect";
import { useLoginMutation } from "@/hooks/use-auth-mutations";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type LoginFormProps = {
  onAuthenticated: () => void;
  /** Sanitized post-auth path — used for register link `next` query only. */
  next: string;
  className?: string;
};

export function LoginForm({
  onAuthenticated,
  next,
  className,
}: LoginFormProps) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const login = useLoginMutation({
    onSuccess: () => onAuthenticated(),
  });

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={form.handleSubmit((values) => login.mutate(values))}
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Log in to Couple Space</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email and password to continue.
          </p>
        </div>

        <Field data-invalid={!!form.formState.errors.email || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!form.formState.errors.email || undefined}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.password || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password || undefined}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        {login.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {login.error.message}
          </p>
        ) : null}

        <Field>
          <Button type="submit" disabled={login.isPending} className="w-full">
            {login.isPending ? "Signing in…" : "Log in"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Don&apos;t have an account?{" "}
          <Link
            href={withNextQuery("/register", next)}
            className="underline underline-offset-4"
          >
            Create an account
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite `register.form.tsx`**

```tsx
"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "@couple-space/domain";
import { cn } from "@/lib/utils";
import { withNextQuery } from "@/lib/auth-redirect";
import { useRegisterMutation } from "@/hooks/use-auth-mutations";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type RegisterFormProps = {
  onAuthenticated: () => void;
  /** Sanitized post-auth path — used for login link `next` query only. */
  next: string;
  className?: string;
};

export function RegisterForm({
  onAuthenticated,
  next,
  className,
}: RegisterFormProps) {
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      dateOfBirth: "",
    },
  });

  const registerMutation = useRegisterMutation({
    onSuccess: () => onAuthenticated(),
  });

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={form.handleSubmit((values) => registerMutation.mutate(values))}
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Join Couple Space with your email and profile details.
          </p>
        </div>

        <Field data-invalid={!!form.formState.errors.displayName || undefined}>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            id="displayName"
            autoComplete="nickname"
            aria-invalid={!!form.formState.errors.displayName || undefined}
            {...form.register("displayName")}
          />
          <FieldError>{form.formState.errors.displayName?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.email || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!form.formState.errors.email || undefined}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.password || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.password || undefined}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.dateOfBirth || undefined}>
          <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
          <Input
            id="dateOfBirth"
            type="date"
            aria-invalid={!!form.formState.errors.dateOfBirth || undefined}
            {...form.register("dateOfBirth")}
          />
          <FieldError>{form.formState.errors.dateOfBirth?.message}</FieldError>
        </Field>

        {registerMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {registerMutation.error.message}
          </p>
        ) : null}

        <Field>
          <Button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full"
          >
            {registerMutation.isPending ? "Creating…" : "Sign up"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Already have an account?{" "}
          <Link
            href={withNextQuery("/login", next)}
            className="underline underline-offset-4"
          >
            Log in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
```

**Do not include:** forgot-password links, `FieldSeparator` / “Or continue with”, `#` hrefs, Login CTA on register, or missing `displayName` / `dateOfBirth`.

- [ ] **Step 3: Typecheck forms**

```bash
pnpm --filter @couple-space/web exec tsc --noEmit
```

Expected: PASS for these files. If `zodResolver(loginSchema)` type-errors on Zod 4 transforms, use `zodResolver(loginSchema)` with `useForm<LoginInput>` as written; if the resolver requires input type, switch to `z.input<typeof loginSchema>` for `useForm` generics and keep mutate with parsed values from `handleSubmit` (resolver still outputs schema output). Prefer the smallest fix that typechecks.

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add apps/web/components/auth
git commit -m "$(cat <<'EOF'
feat(web): wire login and register forms with RHF

EOF
)"
```

---

### Task 4: Pages, route cleanup, link retargets

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/register/page.tsx`
- Delete: `apps/web/app/signup/page.tsx` (and directory)
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/invite/[token]/page.tsx`

**Interfaces:**
- Consumes: `LoginForm` / `RegisterForm`; `safeNextPath` from `@/lib/auth-redirect`
- Produces: working `/login` and `/register`; no `/signup`

- [ ] **Step 1: Replace `login/page.tsx`**

Remove all commented-out blocks. Use:

```tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";
import { LoginForm } from "@/components/auth/login.form";
import { safeNextPath } from "@/lib/auth-redirect";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Couple Space
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm
              next={next}
              onAuthenticated={() => router.push(next)}
            />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        {/* Decorative plane for the auth shell; brand imagery can replace later. */}
        <img
          src="/placeholder.svg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center p-6 text-sm">
          Loading…
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Replace `register/page.tsx`**

Same shell as login, but `RegisterForm` and export name `RegisterPage`:

```tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";
import { RegisterForm } from "@/components/auth/register.form";
import { safeNextPath } from "@/lib/auth-redirect";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Couple Space
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <RegisterForm
              next={next}
              onAuthenticated={() => router.push(next)}
            />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          src="/placeholder.svg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center p-6 text-sm">
          Loading…
        </main>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
```

- [ ] **Step 3: Delete signup and retarget links**

```bash
rm apps/web/app/signup/page.tsx
rmdir apps/web/app/signup 2>/dev/null || true
```

In `apps/web/app/page.tsx`, change `/signup` to `/register`:

```tsx
<Button variant="outline" render={<Link href="/register" />}>
  Sign up
</Button>
```

In `apps/web/app/invite/[token]/page.tsx`, change the unauthenticated redirect:

```ts
redirect(`/register?next=${encodeURIComponent(`/invite/${token}`)}`);
```

Also update the comment above it to say “register” not “signup”.

- [ ] **Step 4: Grep for leftover `/signup` in apps/web**

```bash
rg "/signup" apps/web --glob '!**/node_modules/**'
```

Expected: no matches under `apps/web` source (docs may still mention historical `/signup`).

- [ ] **Step 5: Typecheck web**

```bash
pnpm --filter @couple-space/web exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add apps/web/app
git commit -m "$(cat <<'EOF'
feat(web): canonical /register auth pages; remove /signup

EOF
)"
```

---

### Task 5: Manual verification

**Files:** none (manual)

**Interfaces:**
- Consumes: running API (`ENABLE_DEV_AUTH_ENDPOINTS=true`) + web with `NEXT_PUBLIC_API_URL`

- [ ] **Step 1: Confirm env**

- API: `ENABLE_DEV_AUTH_ENDPOINTS=true`, CORS allows web origin
- Web: `NEXT_PUBLIC_API_URL=http://localhost:8080` (or your API URL)

- [ ] **Step 2: Register path**

1. Open `/register`
2. Submit valid displayName, email, password (≥12 with complexity), DOB
3. Network: `POST /auth/register` then `POST /auth/dev/verify` (dev)
4. Cookies `cs_access` / `cs_refresh` set
5. Lands on `/couple` (default) or `next`

- [ ] **Step 3: Login path**

1. Log out if needed (`POST /auth/logout` or clear cookies)
2. `/login` with same credentials → `/couple`

- [ ] **Step 4: Route cleanup**

1. `/signup` → 404
2. Unauthenticated `/invite/{token}` → `/register?next=...`
3. Cross-links between login/register preserve `next`

- [ ] **Step 5: Note Slice 1 gaps still open**

Do **not** mark full Slice 1 DoD complete from this alone. Still open (per design §9):

- `docs/engineering/auth-manual-smoke.md` full checklist
- Invite E2E (A invite B → accept → active)
- Real mailer replacing `dev/verify`

- [ ] **Step 6: Commit (only if user asked)** — usually nothing if verification-only

---

## Plan self-review

**Spec coverage:** Shared domain schemas (Task 1); single `use-auth-mutations.ts` (Task 2); RHF forms without OAuth/forgot-password (Task 3); `/register` + delete `/signup` + link retargets (Task 4); `dev/verify` kept (Task 2); page `onAuthenticated` ownership (Task 4); Slice 1 gaps called out (Task 5).

**Placeholders:** None intentional. Commit steps gated on user ask.

**Type consistency:** `LoginInput` / `RegisterInput` from domain; form props `onAuthenticated` + `next`; hooks accept those input types.
