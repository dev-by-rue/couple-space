# P1-15 · Rate limiting

[← Phase 1](../board.md) · Size **S** · After: [P1-9](P1-9-age-gate.md) · Next: [P1-16](P1-16-security-headers.md)

**Builds on P1-5:** `forgot-password` and `reset-password` exist.

**Goal:** slow down password guessing, account spamming and invite-token guessing per IP, with
`@nestjs/throttler`.

**Done when:**

- `login`, `register`, `forgot-password`, `reset-password`, `resend-verification` and
  `invitations/:token/accept` return `429 { reason: "rate_limited" }` after their limit.
- Every other route is unlimited (the guard is opt-in, not global).
- Behind Railway and the Next `/backend` rewrite, the limit is keyed on the **user's** IP, not the proxy's.
- An e2e test proves the 429.

### Decisions to confirm

| Route | Limit (per IP) | Why |
| --- | --- | --- |
| `POST /auth/login` | 10 / 15 min | Password guessing. Couples share a home IP, so not lower. |
| `POST /auth/register` | 5 / hour | Account spam |
| `POST /auth/forgot-password` | 5 / hour | Email spam to a victim's inbox |
| `POST /auth/reset-password` | 10 / hour | Token guessing (already 256-bit, so this is belt and braces) |
| `POST /auth/resend-verification` | 5 / hour | Already has a per-user DB limit; this adds a per-IP limit |
| `POST /invitations/:token/accept` | 10 / hour | Token guessing |

These numbers are my suggestion, not a product rule. Change them in one place (`throttle.ts`).

### Flag: the IP behind two proxies

Production traffic goes browser → Railway edge → Next (`/backend` rewrite) → Railway → Nest. Without
`trust proxy`, every request looks like it comes from the Next server, so **one person hitting the limit
locks out everyone**. Set `trust proxy` and check that `X-Forwarded-For` arrives (verification step 4). If
Next's rewrite doesn't forward the header, P1-15 has to wait for a fix there.

The store is in memory. That's fine for one API instance. With more than one replica, each instance
keeps its own count; switch to a Redis store then.

---

## Step 1 · Install
```sh
pnpm --filter @couple-space/api add @nestjs/throttler
```
This adds a dependency;
the task names it explicitly.

## Step 2 · `apps/api/src/common/throttle.ts` (new)
```ts
import { applyDecorators, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RateLimitGuard } from "./rate-limit.guard.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Per-IP limits for the routes P1-15 protects. One place to tune them. */
export const RATE_LIMITS = {
  login: { limit: 10, ttl: 15 * MINUTE },
  register: { limit: 5, ttl: HOUR },
  forgotPassword: { limit: 5, ttl: HOUR },
  resetPassword: { limit: 10, ttl: HOUR },
  resendVerification: { limit: 5, ttl: HOUR },
  acceptInvite: { limit: 10, ttl: HOUR },
} as const;

/** Opt-in rate limit: `@RateLimit("login")`. Routes without it are never throttled. */
export function RateLimit(name: keyof typeof RATE_LIMITS) {
  return applyDecorators(
    Throttle({ default: RATE_LIMITS[name] }),
    UseGuards(RateLimitGuard),
  );
}
```

## Step 3 · `apps/api/src/common/rate-limit.guard.ts` (new)
```ts
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/** ThrottlerGuard with the app's `{ reason }` error shape. */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(): Promise<void> {
    throw new HttpException({ reason: "rate_limited" }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
```
Check the signature of `throwThrottlingException` in your installed version (it takes
`(context, throttlerLimitDetail)` in v6). The override can ignore both arguments.

## Step 4 · `apps/api/src/app.module.ts` (change)
**Before**
```ts
import { Module } from "@nestjs/common";
```
**After**
```ts
import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
```
**Before**
```ts
  imports: [
    DbModule,
```
**After**
```ts
  imports: [
    // Default is overridden per route by @RateLimit; there's no global guard.
    ThrottlerModule.forRoot([{ name: "default", limit: 100, ttl: 60_000 }]),
    DbModule,
```

## Step 5 · `apps/api/src/main.ts` (change)
**Before**
```ts
import { NestFactory } from "@nestjs/core";
...
  const app = await NestFactory.create(AppModule);
```
**After**
```ts
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
...
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Railway edge + the Next /backend rewrite: take the client IP from X-Forwarded-For.
  // A number means "trust that many hops", so clients can't spoof extra entries.
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
```

### `apps/api/src/config/env.ts` (change) — add
```ts
  // 0 locally. 2 behind Railway + the Next rewrite. Check req.ip after deploying.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
```
Add `TRUST_PROXY_HOPS=2` to the Railway API service and to `.env.example` with that comment.

## Step 6 · Decorate the routes

### `apps/api/src/auth/auth.controller.ts` (change)
Add `import { RateLimit } from "../common/throttle.js";`, then put one decorator above each `@Post`:
```ts
  @Post("register")
  @RateLimit("register")
  async register(
```
```ts
  @Post("login")
  @RateLimit("login")
  async login(
```
```ts
  @Post("forgot-password")
  @RateLimit("forgotPassword")
  @HttpCode(200)
  async forgotPassword(
```
```ts
  @Post("reset-password")
  @RateLimit("resetPassword")
  @HttpCode(200)
  async resetPassword(
```
```ts
  @Post("resend-verification")
  @RateLimit("resendVerification")
  @UseGuards(JwtAuthGuard)
  async resendVerification(
```

### `apps/api/src/couples/couples.controller.ts` (change)
```ts
  @Post("invitations/:token/accept")
  @RateLimit("acceptInvite")
  acceptInvitation(
```

## Step 7 · Web message

### `apps/web/lib/auth-errors.ts` (change) — add
```ts
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
```
`friendlyAuthErrorMessage` matches on the reason inside the error body, so login, register and both
reset forms pick this up. The accept-invite panel uses its own error text; check it shows something
sensible for a 429.

## Step 8 · Test

### `apps/api/test/rate-limit.e2e-spec.ts` (new, same setup as `app.e2e-spec.ts`)
```ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "./../src/app.module.js";
import { RATE_LIMITS } from "./../src/common/throttle.js";

describe("Rate limiting (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 429 rate_limited after the login limit", async () => {
    const body = { email: "nobody@example.com", password: "wrong" };
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) {
      await request(app.getHttpServer()).post("/auth/login").send(body).expect(401);
    }
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send(body)
      .expect(429);
    expect(res.body.reason).toBe("rate_limited");
  });

  it("does not limit unprotected routes", async () => {
    for (let i = 0; i < 30; i++) {
      await request(app.getHttpServer()).get("/").expect(200);
    }
  });
});
```
`createNestApplication` here doesn't install `ZodExceptionFilter`, but the login body is valid, so that
doesn't matter. Each test gets a new app, so the in-memory counters reset.

---

## Verification
1. `pnpm --filter @couple-space/api test:e2e` against the local DB, then `pnpm check-types && pnpm test`.
2. Locally: 11 bad logins in a row → the 11th shows "Too many attempts…".
3. Log in normally from another browser profile → still limited, because it's the same IP. Expected.
4. **After deploying to the sandbox:** temporarily log `req.ip` in one route (or check Railway logs) and
   confirm it's your public IP, not a `10.x`/`100.x` internal address. If it's internal, adjust
   `TRUST_PROXY_HOPS`. Remove the log after.
