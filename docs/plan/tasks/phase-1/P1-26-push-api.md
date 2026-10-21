# P1-26 · Push API

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Gate A · Decision: [Q23](../../03-product-decisions.md#q23) · After: [P1-25](P1-25-installable-app.md) · Next: [P1-27](P1-27-push-in-app.md)

**Goal:** the API stores each device's push subscription and pings your partner's devices when you start a
new conversation.

**Done when:**

- `POST /push/subscriptions` saves (or re-assigns) a device; `DELETE /push/subscriptions` removes it.
- Creating a **new** session pushes "New conversation · <name> started a new conversation" to every device
  the partner enabled. Returning an already-open session sends nothing.
- A subscription the push service reports as gone (404/410) is deleted.
- A push failure never fails or slows down `POST /sessions`.
- Domain and API tests pass; `pnpm check-types` is green.

You can build and test all of this before P1-27. The web side just calls these two endpoints.

---

## How web push works (one paragraph)

The browser gives each device a **subscription**: an `endpoint` URL on Google's, Apple's, Mozilla's or
Microsoft's push service, plus two keys. The API stores it. To send, the API encrypts the payload with those
keys, signs the request with its **VAPID** key pair (proving it's the same server the browser subscribed
to), and POSTs to the endpoint. The [`web-push`](https://www.npmjs.com/package/web-push) library does the
encryption and signing. No Firebase account and no new Railway service are needed.

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Port + adapter pattern | `apps/api/src/mail/` | `MailPort` + `MAIL` symbol + `createSmtpMail()`. Push copies this |
| Env schema | `apps/api/src/config/env.ts` | Optional values with safe defaults so unit tests load |
| Session creation | `ConversationsService.createSession` | Returns early for a reused open session, then inserts in a transaction |
| Mocked-DB service tests | `conversations.service.test.ts` | Chained `vi.fn()` mocks per `select` call |
| Shared request schemas | `packages/domain/src/schemas/` | Re-exported by Nest DTOs, like `create-invitation.schema.ts` |

---

## Steps

### Step 1 · Domain: subscription schema

New file `packages/domain/src/schemas/push-schemas.ts`:

```ts
import { z } from "zod";

/**
 * Hosts of the browser push services we accept endpoints from.
 *
 * @remarks
 * The API POSTs to whatever endpoint a client registers, so an open URL would
 * let anyone make the server call arbitrary hosts (SSRF). Chrome/Edge use FCM,
 * Safari uses Apple, Firefox uses Mozilla, and legacy Edge uses WNS.
 */
const PUSH_SERVICE_HOST =
  /^(?:[a-z0-9-]+\.)*(?:fcm\.googleapis\.com|android\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

/**
 * A browser push subscription, as `PushSubscription.toJSON()` returns it.
 *
 * @remarks
 * `expirationTime` is dropped: no browser sets it today.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .url({ protocol: /^https$/, hostname: PUSH_SERVICE_HOST })
    .max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const removePushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
});

export type RemovePushSubscriptionInput = z.infer<
  typeof removePushSubscriptionSchema
>;
```

New file `packages/domain/src/schemas/push-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pushSubscriptionSchema } from "./push-schemas.js";

const keys = { p256dh: "BNc…", auth: "tBH…" };

describe("pushSubscriptionSchema", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/QGuQ",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
      true,
    );
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://evil.example.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example.com/x",
    "https://localhost:8080/internal",
  ])("rejects %s", (endpoint) => {
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
      false,
    );
  });

  it("drops expirationTime", () => {
    const parsed = pushSubscriptionSchema.parse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      expirationTime: null,
      keys,
    });
    expect(parsed).not.toHaveProperty("expirationTime");
  });
});
```

### Step 2 · Domain: notification text

The lock-screen wording is a product rule ([Q23](../../03-product-decisions.md#q23)), so it lives in the
domain package, not in Nest.

New file `packages/domain/src/notifications/new-conversation-notification.ts`:

```ts
/** What the service worker needs to show one notification. */
export type PushNotification = {
  title: string;
  body: string;
  /** App path opened when the notification is tapped. */
  url: string;
  /** Same tag replaces an older notification instead of stacking. */
  tag: string;
};

/**
 * Builds the push sent to a partner when a conversation is started.
 *
 * @remarks
 * Shown on a lock screen, so it never includes the theme, prompt or any
 * answer text. The starter's name is fine: only their partner receives it.
 *
 * @param input - The starter's display name and the new session's id
 * @returns The notification payload
 */
export function newConversationNotification(input: {
  starterName: string;
  sessionId: string;
}): PushNotification {
  return {
    title: "New conversation",
    body: `${input.starterName} started a new conversation`,
    url: `/conversation/${input.sessionId}`,
    tag: `session-${input.sessionId}`,
  };
}
```

New file `packages/domain/src/notifications/new-conversation-notification.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newConversationNotification } from "./new-conversation-notification.js";

describe("newConversationNotification", () => {
  const notification = newConversationNotification({
    starterName: "Rue",
    sessionId: "s1",
  });

  it("names the starter and nothing else", () => {
    expect(notification).toEqual({
      title: "New conversation",
      body: "Rue started a new conversation",
      url: "/conversation/s1",
      tag: "session-s1",
    });
  });
});
```

Export both from `packages/domain/src/index.ts`:

```ts
export * from "./schemas/push-schemas.js";
export * from "./notifications/new-conversation-notification.js";
```

`notifications/` is a new area folder, alongside `sessions/` and `invitations/`.

### Step 3 · Database: `push_subscriptions`

New file `packages/database/src/schema/push-subscriptions.ts`:

```ts
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * One row per browser/device that turned notifications on.
 *
 * @remarks
 * `endpoint` is unique: if someone logs into another account on the same
 * device, the row moves to the new user instead of pinging both.
 * Deleted with the user (cascade) and when the push service reports it gone.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("push_subscriptions_user_id_idx").on(t.userId)],
);
```

Add to `packages/database/src/schema/index.ts`:

```ts
export * from "./push-subscriptions.js";
```

Then:

```bash
pnpm --filter @couple-space/database generate
```

Read the new `0009_*.sql`. It's a brand-new table, so unlike `0005` there are no existing rows to
backfill: it should be one `CREATE TABLE`, the FK, the unique constraint and the index. Nothing to
hand-edit. Run it with `pnpm --filter @couple-space/database migrate`, and add the table to
[`erd/current-schema.md`](../../erd/current-schema.md).

### Step 4 · Env: VAPID keys

```bash
pnpm --filter @couple-space/api add web-push
pnpm --filter @couple-space/api add -D @types/web-push
pnpm --filter @couple-space/api exec web-push generate-vapid-keys
```

In `apps/api/src/config/env.ts`, add to `envSchema` (after the SMTP block):

```ts
  // Web push. Leave unset locally to turn sending off. Never rotate them on a
  // live environment: every existing subscription is tied to the public key.
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:noreply@example.com"),
```

Put your generated pair in `apps/api/.env` (and `.env.example` with placeholder values). On Railway, set
all three on the **api** service. `VAPID_SUBJECT` should be a real `mailto:` you read: push services use
it to contact you about abuse. Add the three to the env list in
[`docs/deployment/railway.md`](../../../deployment/railway.md).

### Step 5 · Push port and `web-push` adapter

New file `apps/api/src/push/push.port.ts`:

```ts
export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** `gone` means the push service no longer knows this subscription. */
export type PushResult = "ok" | "gone";

export interface PushPort {
  send(target: PushTarget, payload: string): Promise<PushResult>;
}

export const PUSH = Symbol("PUSH");
```

New file `apps/api/src/push/web-push.push.ts`:

```ts
import webpush from "web-push";
import { loadEnv } from "../config/env.js";
import type { PushPort, PushTarget } from "./push.port.js";

/** How long the push service keeps an undelivered message (phone off). */
const TTL_SECONDS = 60 * 60 * 24;

/**
 * Sends web push with the `web-push` library and our VAPID keys.
 *
 * @remarks
 * Without VAPID keys (local dev, unit tests) sending is a no-op, so nothing
 * else needs to know whether push is configured.
 */
export function createWebPush(): PushPort {
  const env = loadEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { send: async () => "ok" };
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );

  return {
    async send(target: PushTarget, payload: string) {
      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          payload,
          { TTL: TTL_SECONDS, urgency: "normal" },
        );
        return "ok";
      } catch (error) {
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          return "gone";
        }
        throw error;
      }
    },
  };
}
```

`webpush.WebPushError` (not a named import) because `web-push` is CommonJS and the API is ESM.

### Step 6 · `PushService`

New file `apps/api/src/push/push.service.ts`:

```ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  newConversationNotification,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
} from "@couple-space/domain";
import { pushSubscriptions, users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import type { AuthUser } from "../auth/auth-user.types.js";
import { PUSH, type PushPort } from "./push.port.js";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(PUSH) private readonly push: PushPort,
  ) {}

  async subscribe(user: AuthUser, input: PushSubscriptionInput) {
    const values = {
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    };
    await this.db
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  }

  async unsubscribe(user: AuthUser, input: RemovePushSubscriptionInput) {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, input.endpoint),
          eq(pushSubscriptions.userId, user.id),
        ),
      );
  }

  /**
   * Pings the partner's devices that a conversation was started.
   *
   * @remarks
   * Never throws: callers fire and forget, so a push outage can't fail or slow
   * session creation. Logs counts only, never the payload.
   */
  async notifyNewConversation(input: {
    starterId: string;
    partnerIds: string[];
    sessionId: string;
  }): Promise<void> {
    if (input.partnerIds.length === 0) return;
    try {
      const [starter] = await this.db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, input.starterId))
        .limit(1);
      const notification = newConversationNotification({
        starterName: starter?.displayName ?? "Your partner",
        sessionId: input.sessionId,
      });
      await this.sendToUsers(input.partnerIds, JSON.stringify(notification));
    } catch (error) {
      this.logger.warn(`Push for session ${input.sessionId} failed: ${error}`);
    }
  }

  private async sendToUsers(userIds: string[], payload: string) {
    const targets = await this.db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    const results = await Promise.allSettled(
      targets.map((target) => this.push.send(target, payload)),
    );

    const gone = targets
      .filter((_, i) => {
        const result = results[i];
        return result.status === "fulfilled" && result.value === "gone";
      })
      .map((target) => target.endpoint);

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      this.logger.warn(`${failed} of ${targets.length} pushes failed`);
    }

    if (gone.length > 0) {
      await this.db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpoint, gone));
    }
  }
}
```

### Step 7 · Controller, DTOs and module

DTO re-exports, matching `couples/dto/create-invitation.schema.ts`. New file
`apps/api/src/push/dto/push-subscription.schema.ts`:

```ts
/**
 * Re-export shared push schemas from domain.
 * Nest keeps this path so controllers/services do not import package paths ad hoc.
 */
export {
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
} from "@couple-space/domain";
```

New file `apps/api/src/push/push.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { PushService } from "./push.service.js";
import {
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
} from "./dto/push-subscription.schema.js";

@Controller("push")
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post("subscriptions")
  @HttpCode(204)
  subscribe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = pushSubscriptionSchema.parse(body);
    return this.push.subscribe(user, input);
  }

  @Delete("subscriptions")
  @HttpCode(204)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = removePushSubscriptionSchema.parse(body);
    return this.push.unsubscribe(user, input);
  }
}
```

`DELETE` with a body is unusual but supported by Express and `fetch`. The endpoint is a long URL, so it
doesn't fit well in a path parameter.

New file `apps/api/src/push/push.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PushController } from "./push.controller.js";
import { PUSH } from "./push.port.js";
import { PushService } from "./push.service.js";
import { createWebPush } from "./web-push.push.js";

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [PushService, { provide: PUSH, useFactory: () => createWebPush() }],
  exports: [PushService],
})
export class PushModule {}
```

Add `PushModule` to `imports` in `apps/api/src/app.module.ts` (after `ConversationsModule`).

Unlike `MailModule` it isn't `@Global()`: only `ConversationsModule` uses it, so it's imported there
explicitly.

### Step 8 · Send on session creation

`apps/api/src/conversations/conversations.module.ts`, before → after:

```ts
  imports: [AuthModule],
```

```ts
  imports: [AuthModule, PushModule],
```

(with `import { PushModule } from "../push/push.module.js";`)

`apps/api/src/conversations/conversations.service.ts`: inject the service:

```ts
import { PushService } from "../push/push.service.js";
…
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly push: PushService,
  ) {}
```

At the end of `createSession`, before → after:

```ts
      return created;
    });

    return { id: session.id };
  }
```

```ts
      return created;
    });

    // Fire and forget: notifyNewConversation never throws.
    void this.push.notifyNewConversation({
      starterId: user.id,
      partnerIds: ctx.memberIds.filter((id) => id !== user.id),
      sessionId: session.id,
    });

    return { id: session.id };
  }
```

It's after the transaction, so a rolled-back insert never sends a push. The early
`if (open) return { id: open.id };` above it means a reused session sends nothing.

### Step 9 · Tests

**Existing tests need the new dependency.** In `conversations.service.test.ts`, every
`Test.createTestingModule` (three of them, one inside `serviceWith`) gets a fake `PushService`. Add near
the top:

```ts
import { PushService } from "../push/push.service.js";

const fakePush = () => ({ notifyNewConversation: vi.fn() });
```

and in each `providers` array:

```ts
        { provide: PushService, useValue: fakePush() },
```

**New tests for `createSession`.** Add inside `describe("ConversationsService")`:

```ts
  describe("createSession notifications", () => {
    const user = { id: "u1", email: "a@example.com", emailVerified: true };
    const prompt = {
      id: "a0000000-0000-4000-8000-000000000011",
      kind: "curated",
      retiredAt: null,
    };

    function mockDbFor(existingSessions: { id: string }[]) {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: "s-new" }]),
          })),
        })),
      };
      const mockDb = {
        select: vi.fn(),
        transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      };

      mockDb.select
        // membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { coupleId: "c1", userId: "u1", status: "active" },
              ]),
            })),
          })),
        })
        // couple
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "c1", status: "active" }]),
            })),
          })),
        })
        // members
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ userId: "u1" }, { userId: "u2" }]),
          })),
        })
        // prompt
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [prompt]),
            })),
          })),
        })
        // sessions on the same prompt
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => existingSessions),
          })),
        })
        // reveals (nobody has revealed, so any session is open)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => []),
          })),
        });

      return mockDb;
    }

    async function setup(existingSessions: { id: string }[]) {
      const push = fakePush();
      const module = await Test.createTestingModule({
        providers: [
          ConversationsService,
          { provide: DB, useValue: mockDbFor(existingSessions) },
          { provide: PushService, useValue: push },
        ],
      }).compile();
      return { service: module.get(ConversationsService), push };
    }

    it("pings the partner when a new session is created", async () => {
      const { service, push } = await setup([]);

      await expect(
        service.createSession(user, { promptId: prompt.id }),
      ).resolves.toEqual({ id: "s-new" });
      expect(push.notifyNewConversation).toHaveBeenCalledWith({
        starterId: "u1",
        partnerIds: ["u2"],
        sessionId: "s-new",
      });
    });

    it("sends nothing when the open session is reused", async () => {
      const { service, push } = await setup([{ id: "s1" }]);

      await service.createSession(user, { promptId: prompt.id });
      expect(push.notifyNewConversation).not.toHaveBeenCalled();
    });
  });
```

**New file `apps/api/src/push/push.service.test.ts`:**

```ts
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { DB } from "../db/db.module.js";
import { PUSH, type PushPort } from "./push.port.js";
import { PushService } from "./push.service.js";

const subscription = (endpoint: string) => ({
  id: endpoint,
  userId: "u2",
  endpoint,
  p256dh: "p",
  auth: "a",
  createdAt: new Date(),
});

function mockDbWith(subscriptions: ReturnType<typeof subscription>[]) {
  const deleteWhere = vi.fn(async () => undefined);
  const mockDb = {
    select: vi.fn(),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  mockDb.select
    // starter's display name
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ displayName: "Rue" }]),
        })),
      })),
    })
    // partner's subscriptions
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(async () => subscriptions),
      })),
    });
  return { mockDb, deleteWhere };
}

async function serviceWith(mockDb: object, push: PushPort) {
  const module = await Test.createTestingModule({
    providers: [
      PushService,
      { provide: DB, useValue: mockDb },
      { provide: PUSH, useValue: push },
    ],
  }).compile();
  return module.get(PushService);
}

const input = { starterId: "u1", partnerIds: ["u2"], sessionId: "s1" };

describe("PushService.notifyNewConversation", () => {
  it("sends the notification to every partner device", async () => {
    const { mockDb } = mockDbWith([
      subscription("https://fcm.googleapis.com/a"),
      subscription("https://web.push.apple.com/b"),
    ]);
    const push = { send: vi.fn(async () => "ok" as const) };
    const service = await serviceWith(mockDb, push);

    await service.notifyNewConversation(input);

    expect(push.send).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(push.send.mock.calls[0][1]);
    expect(payload).toEqual({
      title: "New conversation",
      body: "Rue started a new conversation",
      url: "/conversation/s1",
      tag: "session-s1",
    });
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("deletes subscriptions the push service says are gone", async () => {
    const { mockDb, deleteWhere } = mockDbWith([
      subscription("https://fcm.googleapis.com/live"),
      subscription("https://fcm.googleapis.com/dead"),
    ]);
    const push = {
      send: vi.fn(async (target: { endpoint: string }) =>
        target.endpoint.endsWith("dead") ? ("gone" as const) : ("ok" as const),
      ),
    };
    const service = await serviceWith(mockDb, push);

    await service.notifyNewConversation(input);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("never throws when sending fails", async () => {
    const { mockDb } = mockDbWith([subscription("https://fcm.googleapis.com/a")]);
    const push = { send: vi.fn(async () => Promise.reject(new Error("down"))) };
    const service = await serviceWith(mockDb, push);

    await expect(service.notifyNewConversation(input)).resolves.toBeUndefined();
  });

  it("never throws when the database fails", async () => {
    const mockDb = {
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    const push = { send: vi.fn() };
    const service = await serviceWith(mockDb, push);

    await expect(service.notifyNewConversation(input)).resolves.toBeUndefined();
    expect(push.send).not.toHaveBeenCalled();
  });

  it("does nothing without partners", async () => {
    const mockDb = { select: vi.fn() };
    const push = { send: vi.fn() };
    const service = await serviceWith(mockDb, push);

    await service.notifyNewConversation({ ...input, partnerIds: [] });

    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
```

The "gone" test only checks that one delete ran. Checking *which* endpoints were deleted would mean
inspecting Drizzle's SQL object. That's covered by the manual check below instead.

---

## Check

1. `pnpm --filter @couple-space/domain test` and `pnpm --filter @couple-space/api test` pass.
2. `pnpm check-types` passes.
3. A real push needs the service worker from P1-27, so the end-to-end check is there. For now, with VAPID
   keys in `apps/api/.env`, call `POST /push/subscriptions` with a fake body (`$TOKEN` is the
   `accessToken` from a login response):
   ```bash
   curl -i -X POST http://localhost:8080/push/subscriptions \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"endpoint":"https://fcm.googleapis.com/fcm/send/test","keys":{"p256dh":"x","auth":"y"}}'
   ```
   It returns `204` and a row appears in `push_subscriptions`. Then create a session as the partner: the
   API log shows `1 of 1 pushes failed` (the fake keys can't be encrypted to). That proves the send path
   runs, and session creation still succeeds.
4. Same `curl` with `"endpoint":"https://example.com/x"` returns `400`.

Commit: `feat(api): P1-26 web push subscriptions and new-conversation push`.
