# P1-9 · 18+ age gate

[← Phase 1](../board.md) · Size **S** · Decision: [Q9](../../product/decisions.md#q9) · After: [P1-5](P1-5-password-reset.md) · Next: [P1-15](P1-15-rate-limiting.md)

**Goal:** you must be 18 or older to register. The check runs on the server; the web shows the same
message before submitting.

**Done when:**

- `isAtLeastAge(dateOfBirth, 18, today)` is a pure domain function with tests for the birthday edge cases.
- `registerSchema` rejects anyone under 18, and dates that don't exist or are in the future. Because the
  Nest DTO re-exports that schema, the server check comes for free.
- The register form explains the rule and shows the error under the date field.

### Notes

- **No reason code needed.** `ZodExceptionFilter` already returns `400 { reason: "validation_failed", errors: [...] }`
  with the issue message, so the web form shows the same text the server would.
- **Existing accounts aren't re-checked.** Q9 says "at registration". Say so if you want a backfill check.
- **Dates are calendar dates (`YYYY-MM-DD`), compared in UTC.** Someone born on 2008-10-24 can
  register from 2026-10-24 UTC. Being a few hours early or late in some time zones is fine.
- **29 February birthdays:** they turn 18 on 1 March in non-leap years (the rule used in England and
  Wales). Written down here so it's a decision, not an accident.

---

## Step 1 · Domain function

### `packages/domain/src/users/age.ts` (new — new `users/` area, alongside `sessions/` and `invitations/`)
```ts
export const MINIMUM_AGE = 18;

/** Parses `YYYY-MM-DD` into UTC parts, or null if the date doesn't exist (e.g. 2023-02-30). */
export function parseIsoDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * True when someone born on `dateOfBirth` is at least `age` years old on `today` (UTC).
 * A 29 Feb birthday counts as 1 Mar in non-leap years.
 */
export function isAtLeastAge(
  dateOfBirth: string,
  age: number,
  today: Date = new Date(),
): boolean {
  const dob = parseIsoDate(dateOfBirth);
  if (!dob) return false;

  // Date.UTC rolls 29 Feb into 1 Mar when the target year isn't a leap year.
  const birthday = Date.UTC(dob.year + age, dob.month - 1, dob.day);
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return todayUtc >= birthday;
}
```

### `packages/domain/src/users/age.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { isAtLeastAge, parseIsoDate } from "./age.js";

const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("parseIsoDate", () => {
  it("parses a real date", () => {
    expect(parseIsoDate("1990-01-15")).toEqual({ year: 1990, month: 1, day: 15 });
  });

  it.each(["2023-02-30", "2023-13-01", "15-01-1990", ""])("rejects %s", (value) => {
    expect(parseIsoDate(value)).toBeNull();
  });
});

describe("isAtLeastAge", () => {
  it("is false the day before the 18th birthday", () => {
    expect(isAtLeastAge("2008-10-24", 18, on("2026-10-23"))).toBe(false);
  });

  it("is true on the 18th birthday", () => {
    expect(isAtLeastAge("2008-10-24", 18, on("2026-10-24"))).toBe(true);
  });

  it("treats a 29 Feb birthday as 1 Mar in a non-leap year", () => {
    expect(isAtLeastAge("2008-02-29", 18, on("2026-02-28"))).toBe(false);
    expect(isAtLeastAge("2008-02-29", 18, on("2026-03-01"))).toBe(true);
  });

  it("uses the UTC date, not local time", () => {
    // 23:30 UTC on the day before is still "not yet".
    expect(isAtLeastAge("2008-10-24", 18, new Date("2026-10-23T23:30:00Z"))).toBe(false);
  });

  it("is false for an invalid date", () => {
    expect(isAtLeastAge("2008-02-30", 18, on("2030-01-01"))).toBe(false);
  });
});
```

### `packages/domain/src/index.ts` (change) — add
```ts
export * from "./users/age.js";
```

---

## Step 2 · Register schema

### `packages/domain/src/schemas/auth-schemas.ts` (change)
**Before** (after P1-4)
```ts
export const registerSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
  password: passwordSchema,
  displayName: displayNameSchema,
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
});
```
**After**
```ts
import { isAtLeastAge, MINIMUM_AGE, parseIsoDate } from "../users/age.js";

export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
  .refine((v) => parseIsoDate(v) !== null, "enter a real date")
  // Q9: 18+ only. Runs on the server too, via the Nest DTO re-export.
  .refine(
    (v) => isAtLeastAge(v, MINIMUM_AGE),
    `you must be ${MINIMUM_AGE} or older to use Couple Space`,
  );

export const registerSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
  password: passwordSchema,
  displayName: displayNameSchema,
  dateOfBirth: dateOfBirthSchema,
});
```
(Put the import at the top with the `zod` import.) Also update the comment above `registerSchema`: delete
"Age-gate policy using DOB is explicitly out of Slice 1 — collect only."

A future date fails the 18+ check, so it doesn't need its own rule.

### `packages/domain/src/schemas/auth-schemas.test.ts` (change)
The existing `valid` payload uses `1990-01-15`, so it still passes. Add inside `describe("registerSchema")`:
```ts
  it("rejects someone under 18", () => {
    const today = new Date();
    const seventeen = `${today.getUTCFullYear() - 17}-01-01`;
    expect(() =>
      registerSchema.parse({ ...valid, dateOfBirth: seventeen }),
    ).toThrow(/18 or older/);
  });

  it("rejects a date that doesn't exist", () => {
    expect(() =>
      registerSchema.parse({ ...valid, dateOfBirth: "1990-02-30" }),
    ).toThrow(/real date/);
  });
```
The schema uses the real `new Date()`, so these tests pick ages far from the boundary. The exact
boundary is tested in `age.test.ts`, where `today` is passed in.

---

## Step 3 · API

Nothing to write: `apps/api/src/auth/dto/register.schema.ts` re-exports `registerSchema`, and
`AuthController.register` calls `registerSchema.parse(body)`.

### `apps/api/src/auth/auth.controller.test.ts` or an e2e test (optional)
If you have a controller/e2e test for register, add one case: a 17-year-old's DOB → 400 and no insert.
If there isn't one, the domain tests cover the rule; don't add a new test style for one case.

---

## Step 4 · Web register form

### `apps/web/components/auth/register.form.tsx` (change)
**Before**
```tsx
          <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
          <Input
            id="dateOfBirth"
            type="date"
            aria-invalid={!!form.formState.errors.dateOfBirth || undefined}
            {...form.register("dateOfBirth")}
          />
          <FieldError>{form.formState.errors.dateOfBirth?.message}</FieldError>
```
**After**
```tsx
          <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
          <Input
            id="dateOfBirth"
            type="date"
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            aria-invalid={!!form.formState.errors.dateOfBirth || undefined}
            {...form.register("dateOfBirth")}
          />
          <FieldDescription>
            Couple Space is for adults. You need to be 18 or older.
          </FieldDescription>
          <FieldError>{form.formState.errors.dateOfBirth?.message}</FieldError>
```
`FieldDescription` is already imported. `max` stops the date picker offering future dates; the schema
still does the real check.

---

## Verification
1. `pnpm --filter @couple-space/domain test`, then `pnpm check-types && pnpm test`.
2. Register with a DOB 17 years ago → the error shows under the field; there's no network request (check
   the Network tab).
3. `curl -X POST /auth/register` with the same DOB → 400 and no new `users` row.
4. Register with a DOB of exactly 18 years ago today → success.
