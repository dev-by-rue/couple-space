# P1-16 · Security headers

[← Phase 1](../board.md) · Size **S** · After: [P1-15](P1-15-rate-limiting.md) · Next: [P1-10](P1-10-real-email-verification.md)

**Goal:** standard security headers on both apps: `helmet` on Nest and `headers()` in `next.config.ts`.
No CSP yet (the task says it can come later).

**Done when:**

- API responses carry helmet's defaults, and CORS with cookies still works.
- Every web page sends `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`, and `Strict-Transport-Security` in production.
- The service worker (`/sw.js`) keeps its existing headers, and push still works.

### Notes

- **`Referrer-Policy: no-referrer` on the web.** Invite links (`/invite/<token>`), verify links and reset
  links carry secrets in the URL. `strict-origin-when-cross-origin` already hides the path from other
  sites; `no-referrer` also hides the origin. Either is fine. I chose the stricter one.
- **HSTS is production-only.** Sending it from `localhost` makes the browser force HTTPS for localhost.
- **`Permissions-Policy` leaves `notifications` alone**; it isn't a Permissions-Policy feature, so push
  isn't affected.
- **Next and the `/backend` rewrite:** API responses that go through the proxy get the Nest (helmet)
  headers, not the Next ones. That's fine; they're JSON.

---

## Step 1 · API

```sh
pnpm --filter @couple-space/api add helmet
```

### `apps/api/src/main.ts` (change)
**Before**
```ts
import cookieParser from "cookie-parser";
...
  app.use(cookieParser());
```
**After**
```ts
import cookieParser from "cookie-parser";
import helmet from "helmet";
...
  // JSON-only API: helmet's defaults (including its strict CSP) are safe here.
  app.use(helmet());
  app.use(cookieParser());
```
Order: helmet before CORS (`enableCors` is called after it already). Helmet's
`Cross-Origin-Resource-Policy: same-origin` doesn't block `fetch` with CORS: CORP applies to no-cors
loads (images, scripts), and CORS responses are allowed. Check local dev, where web (`:3000`) calls the
API (`:8080`) directly; if anything breaks, set
`helmet({ crossOriginResourcePolicy: { policy: "same-site" } })`.

### `apps/api/test/security-headers.e2e-spec.ts` (new)
```ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import helmet from "helmet";
import request from "supertest";
import { AppModule } from "./../src/app.module.js";

describe("Security headers (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(helmet());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("sets helmet's headers and hides x-powered-by", async () => {
    const res = await request(app.getHttpServer()).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
```
This repeats `app.use(helmet())` because e2e tests don't run `main.ts`. If that duplication bothers you,
pull the setup into `configureApp(app, env)` in `src/app.setup.ts` and call it from both. That's a new
file, but it also fixes the e2e app missing `ZodExceptionFilter` and `cookieParser`.

---

## Step 2 · Web

### `apps/web/next.config.ts` (change)
**Before**
```ts
const apiInternalUrl = process.env.API_INTERNAL_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
```
**After**
```ts
const apiInternalUrl = process.env.API_INTERNAL_URL?.replace(/\/$/, "");

const isProduction = process.env.NODE_ENV === "production";

/**
 * Baseline headers for every page. CSP comes later (P1-16 follow-up).
 * no-referrer: invite / verify / reset URLs carry tokens in the path.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
```
The `/sw.js` entry stays as it is. Next merges headers from every matching rule, so `/sw.js` gets both.

Leave out `preload` on HSTS unless you mean to submit the domain to the preload list; it's hard to undo.

---

## Verification
1. `pnpm check-types && pnpm test` and the new e2e test.
2. `curl -sI http://localhost:8080/health` → helmet headers, no `X-Powered-By`.
3. `pnpm --filter @couple-space/web build && pnpm --filter @couple-space/web start`, then `curl -sI http://localhost:3000/login` →
   the five headers (HSTS too, because `start` runs production mode).
4. In the browser: log in, start a conversation, and turn notifications on and off. No console errors
   about blocked resources. `curl -sI /sw.js` still shows `no-cache`.
5. After deploying, run the sandbox URL through securityheaders.com. Expect A-, losing points only for CSP.
