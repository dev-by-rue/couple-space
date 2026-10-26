# P1-18 · Error monitoring + logs

[← Phase 1](../board.md) · Size **S** · Decision: [Q17](../../product/decisions.md#q17) · After: [P1-17](P1-17-ci.md) · Next: [P1-20](P1-20-hardening.md)

**Goal:** Sentry on both apps, with answer text, passwords and tokens **scrubbed** before anything leaves
the process. Sentry is off when no DSN is set (local dev, CI).

**Done when:**

- `scrubEvent` is a pure, tested function that redacts sensitive keys anywhere in an event and strips
  tokens from URLs. Both apps use it in `beforeSend` / `beforeBreadcrumb`.
- The API reports unhandled errors (5xx), not expected 4xx ones.
- The web reports client and server errors. **Session Replay is off** (it records the screen, including
  answers).
- `sendDefaultPii: false` on both. No request bodies or cookies are sent.
- A deliberate test error shows up in Sentry with the body redacted.

### Decisions and flags

- **Sentry**, as the task suggests: there's a free tier and official Nest and Next SDKs. These are new
  dependencies (`@sentry/nestjs`, `@sentry/nextjs`), named in the task.
- **The scrubber lives in `@couple-space/domain`.** "Answers never reach error reports" is a Q17 privacy
  rule, and both apps need the same list. It doesn't import Sentry; it works on plain objects.
- **Deny by key, plus no bodies at all.** Request bodies are dropped entirely, and anything else that
  looks like content (`text`, `body`, `answer`…) is redacted wherever it appears. Belt and braces.
- **Use the wizard for Next, then edit.** `@sentry/nextjs` setup files change between versions. Run the
  wizard, then apply the edits in Step 4. **Say no to Session Replay** when it asks.
- **Region:** pick Sentry's **EU** data region when you create the org, to match L-5's EU data region.

---

## Step 1 · Domain: the scrubber

### `packages/domain/src/observability/scrub-event.ts` (new)
```ts
/** Keys whose values must never leave the process (Q17, E-7). Compared case-insensitively. */
export const SENSITIVE_KEYS = [
  "text",
  "body",
  "answer",
  "draft",
  "password",
  "currentpassword",
  "newpassword",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "cookie",
  "cookies",
  "authorization",
  "p256dh",
  "auth",
] as const;

const REDACTED = "[redacted]";
const sensitive = new Set<string>(SENSITIVE_KEYS);

/** Strips secrets from a URL or path: `?token=…` and `/invite/<token>`. */
export function scrubUrl(value: string): string {
  return value
    .replace(/([?&](?:token|code)=)[^&#\s]*/gi, `$1${REDACTED}`)
    .replace(/(\/invite\/)[^/?#\s]+/gi, `$1${REDACTED}`);
}

/**
 * Deep-redacts sensitive keys and scrubs URL-like strings. Returns a new
 * value; never mutates the input. Depth-limited so a cyclic object can't hang it.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === "string") return scrubUrl(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        sensitive.has(key.toLowerCase()) ? REDACTED : scrubValue(v, depth + 1),
      ]),
    );
  }
  return value;
}

type EventLike = {
  request?: { data?: unknown; cookies?: unknown; headers?: unknown; url?: string; query_string?: unknown };
  [key: string]: unknown;
};

/** For Sentry `beforeSend`: drop bodies and cookies outright, then deep-scrub the rest. */
export function scrubEvent<T extends EventLike>(event: T): T {
  const { request, ...rest } = event;
  const scrubbed = scrubValue(rest) as Omit<T, "request">;
  if (!request) return scrubbed as T;

  const { data: _data, cookies: _cookies, ...requestRest } = request;
  return {
    ...scrubbed,
    request: scrubValue(requestRest),
  } as T;
}
```
`auth` is on the list because push subscriptions have `keys.auth`. The side effect is that any field
literally called `auth` is redacted. That's acceptable.

### `packages/domain/src/observability/scrub-event.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { scrubEvent, scrubUrl, scrubValue } from "./scrub-event.js";

describe("scrubUrl", () => {
  it("removes tokens from query strings and invite paths", () => {
    expect(scrubUrl("/verify-email?token=abc&next=/couple")).toBe(
      "/verify-email?token=[redacted]&next=/couple",
    );
    expect(scrubUrl("https://x.app/invite/abc123")).toBe("https://x.app/invite/[redacted]");
  });
});

describe("scrubValue", () => {
  it("redacts answer text, passwords and tokens at any depth", () => {
    const result = scrubValue({
      sessionId: "s1",
      responses: [{ userId: "u1", text: "my secret answer" }],
      input: { currentPassword: "a", newPassword: "b" },
      Authorization: "Bearer x",
    });
    expect(JSON.stringify(result)).not.toMatch(/secret answer|Bearer/);
    expect(result).toMatchObject({ sessionId: "s1", responses: [{ userId: "u1", text: "[redacted]" }] });
  });

  it("doesn't hang on a cyclic object", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => scrubValue(a)).not.toThrow();
  });
});

describe("scrubEvent", () => {
  it("drops request bodies and cookies entirely", () => {
    const event = scrubEvent({
      request: { url: "/sessions/s1/responses", data: '{"text":"x"}', cookies: { cs_access: "y" } },
      extra: { body: "z" },
    });
    expect(event.request).toEqual({ url: "/sessions/s1/responses" });
    expect(event.extra).toEqual({ body: "[redacted]" });
  });
});
```

### `packages/domain/src/index.ts` (change) — add
```ts
export * from "./observability/scrub-event.js";
```

---

## Step 2 · API

```sh
pnpm --filter @couple-space/api add @sentry/nestjs
```

### `apps/api/src/config/env.ts` (change) — add
```ts
  // Error monitoring. Unset = off (local, CI).
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default("local"),
```

### `apps/api/src/instrument.ts` (new)
Sentry has to initialise before Nest loads, so this is its own file, imported first.
```ts
import * as Sentry from "@sentry/nestjs";
import { scrubEvent, scrubValue } from "@couple-space/domain";
import { loadEnv } from "./config/env.js";

const env = loadEnv();

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    // Q17: no IPs, cookies or bodies.
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubValue(breadcrumb) as typeof breadcrumb,
  });
}
```
`main.ts` loads `.env` with dotenv after its imports. Because `instrument.ts` reads env at import time,
move the dotenv call into `instrument.ts` (before `loadEnv()`), or start the API with
`node --import ./dist/instrument.js dist/main`. The first is simpler. Move these lines from `main.ts`
to the top of `instrument.ts`:
```ts
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
```

### `apps/api/src/main.ts` (change)
**Before**
```ts
import "reflect-metadata";
import { config } from "dotenv";
```
**After**
```ts
import "./instrument.js";
import "reflect-metadata";
```
(and delete the dotenv lines that moved.)

### `apps/api/src/app.module.ts` (change)
**Before**
```ts
import { Module } from "@nestjs/common";
```
**After**
```ts
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
```
**Before**
```ts
  imports: [
```
**After**
```ts
  imports: [
    SentryModule.forRoot(),
```
**Before**
```ts
  providers: [AppService],
```
**After**
```ts
  providers: [
    AppService,
    // Reports unhandled errors only; HttpExceptions (4xx with a reason) are expected.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
```
Check in your installed version that `SentryGlobalFilter` skips `HttpException`s below 500 (it does by
default in v8+). `ZodExceptionFilter` (registered with `useGlobalFilters`) still handles validation
errors. Without a DSN, `SentryModule` and the filter do nothing.

### Logs
Nest's `Logger` writes to stdout, and Railway keeps it. Grep for anything that could log content:
```sh
rg -n "logger\.(log|warn|error|debug)|console\.(log|warn|error)" apps/api/src
```
Every hit must log ids, reasons or counts, never `body`, `text`, `input` or a whole DTO. Today:
`push.service.ts` logs the session id and the error, and P1-10's mail log logs the domain and subject.
Both are fine.

---

## Step 3 · Web

```sh
pnpm --filter @couple-space/web dlx @sentry/wizard@latest -i nextjs
```
In the wizard: **Session Replay: no.** Tracing: no (or 0). Logs: no. The wizard writes
`instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`,
`app/global-error.tsx`, and wraps `next.config.ts` with `withSentryConfig`. Then edit:

### `apps/web/instrumentation-client.ts` (generated, then edit)
```ts
import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubValue } from "@couple-space/domain";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "local",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Never: Replay records the DOM, including answers on screen.
    integrations: [],
    beforeSend: (event) => scrubEvent(event),
    // Fetch breadcrumbs carry URLs (tokens) and console breadcrumbs carry anything.
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category === "console" ? null : (scrubValue(breadcrumb) as typeof breadcrumb),
  });
}
```
`integrations: []` removes the defaults that the wizard may add. If you want the default error
integrations back, use `integrations: (defaults) => defaults.filter((i) => i.name !== "Replay")`.

### `apps/web/sentry.server.config.ts` and `sentry.edge.config.ts` (generated, then edit)
Same `init`, with `process.env.SENTRY_DSN` (server-side, not `NEXT_PUBLIC_`) and the same `beforeSend` /
`beforeBreadcrumb`.

### `apps/web/next.config.ts` (generated wrapper)
Keep the P1-16 `headers()` and the `/backend` rewrite inside the object passed to `withSentryConfig`.
Leave out `tunnelRoute` for now. If you add it later, it's another route to exclude from the CSP.

### Avoid adding content to errors yourself
Don't `Sentry.setContext`/`setExtra` with session DTOs. `apiFetch` throws
`Error("API 409: {body}")`: the **response** body goes into the message. Today responses on error
paths are `{ reason }` objects, so that's safe. `scrubValue` runs on messages too, but it can't redact a
key inside a JSON *string*, so keep error responses free of content.

---

## Step 4 · Configuration

| Service | Variable | Value |
| --- | --- | --- |
| api | `SENTRY_DSN` | the Nest project's DSN |
| api | `SENTRY_ENVIRONMENT` | `sandbox` / `beta` |
| web | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | the Next project's DSN |
| web | `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `sandbox` / `beta` |
| web | `SENTRY_AUTH_TOKEN` (optional) | uploads source maps at build |

`NEXT_PUBLIC_*` values are baked in at build time: redeploy `web` after setting them (same as the push
key). Add the rows to `docs/deployment/railway.md` §3.

In the Sentry project settings, also turn on **Data Scrubber** and **Use Default Scrubbers**, and add
`text`, `body`, `answer` to "Additional Sensitive Fields". It's a server-side backup to the client
scrubber.

---

## Verification
1. `pnpm --filter @couple-space/domain test`, then `pnpm check-types && pnpm test`.
2. Temporarily add `@Get("debug/sentry") boom() { throw new Error("sentry test"); }` to `AppController`,
   deploy to the sandbox, call it → the event shows in Sentry with no cookies and no body. Remove it.
3. Temporarily throw in a client component's click handler that has a session in scope → the event has
   no answer text and no Replay attachment.
4. Submit an invalid answer (400) → **no** Sentry event.
5. Open `/verify-email?token=abc` and trigger an error there → the event's URL shows `token=[redacted]`.
