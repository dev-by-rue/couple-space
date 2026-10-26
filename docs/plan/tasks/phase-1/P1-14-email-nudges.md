# P1-14 · Email nudges (optional)

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Optional · After: [P1-13](P1-13-legal-trust-pages.md) · Next: [P1-17](P1-17-ci.md)

**Builds on P1-4** (settings page) **and P1-10** (working SMTP, mail failure logging).

> The task says to revisit this **after push (P1-25…27) ships**. Push is live. Use this guide only if
> Gate A shows that push isn't enough (for example, a partner who never installs the app).

**Goal:** two optional emails, "Partner answered" and "Ready to reveal", that contain **no prompt or
answer text**. Each user turns them on or off in Settings (`users.email_notifications`).

**Done when:**

- `users.email_notifications boolean not null default false`.
- **Partner answered:** when the first answer of a main session arrives, the partner gets an email
  (if they've opted in). This is the same moment the existing push fires.
- **Ready to reveal:** when the second answer arrives, the **first** answerer gets an email (if opted in).
- Sending never fails or slows down `POST /sessions/:id/responses`; failures are logged without content.
- Follow-up (child) sessions send nothing. Push does cover follow-ups (P1-31 Part B); emails stay
  main-session-only (owner, 2026-10-26). Whether emails ship at all is still open.
- `PATCH /me/preferences { emailNotifications }` and a Settings switch.
- Domain tests prove the email text can't contain prompt or answer text.

### ⚠️ Decisions to confirm

1. **Opt-in (default off).** Emails about an intimate app land in shared inboxes. Proposed default:
   `false`. Opt-out would mean `default(true)` plus a migration note.
2. **The email names the partner** ("Alex answered"), like the push does. The subject line is generic:
   "Something's waiting for you in Couple Space".
3. **No throttle beyond the natural one.** Each email is sent once per session per event (first submit,
   second submit), so a couple can't get more than 2 emails per conversation.
4. **No unsubscribe link with a token** for now; the email links to Settings. A one-click
   unsubscribe (RFC 8058) would need a signed token. Add it if Brevo deliverability asks for it.

---

## Step 1 · Domain: the email text

### `packages/domain/src/notifications/nudge-emails.ts` (new, same style as `new-conversation-notification.ts`)
```ts
/** A rendered email. Text and HTML carry the same words. */
export type NudgeEmail = {
  subject: string;
  text: string;
  html: string;
};

/** Generic on purpose: subjects show in inbox previews and on lock screens. */
const SUBJECT = "Something's waiting for you in Couple Space";

function render(lines: string[], link: string, settingsLink: string): Omit<NudgeEmail, "subject"> {
  const footer = `You're getting this because email nudges are on. Turn them off in Settings: ${settingsLink}`;
  return {
    text: [...lines, "", link, "", footer].join("\n"),
    html: [
      ...lines.map((l) => `<p>${escapeHtml(l)}</p>`),
      `<p><a href="${link}">Open Couple Space</a></p>`,
      `<p style="color:#666;font-size:12px">You're getting this because email nudges are on. <a href="${settingsLink}">Turn them off in Settings</a>.</p>`,
    ].join(""),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Sent to the partner when the first answer arrives.
 *
 * @remarks
 * Takes no prompt or answer input at all, so it can't leak them. The
 * partner's display name is escaped: it's user-controlled.
 */
export function partnerAnsweredEmail(input: {
  partnerName: string;
  webOrigin: string;
  sessionId: string;
}): NudgeEmail {
  return {
    subject: SUBJECT,
    ...render(
      [`${input.partnerName} answered a conversation.`, "Your answer stays private until you've both answered."],
      `${input.webOrigin}/conversation/${input.sessionId}`,
      `${input.webOrigin}/settings`,
    ),
  };
}

/** Sent to the first answerer when the second answer arrives. */
export function readyToRevealEmail(input: {
  partnerName: string;
  webOrigin: string;
  sessionId: string;
}): NudgeEmail {
  return {
    subject: SUBJECT,
    ...render(
      [`${input.partnerName} has answered too.`, "You can both reveal whenever you're ready."],
      `${input.webOrigin}/conversation/${input.sessionId}`,
      `${input.webOrigin}/settings`,
    ),
  };
}
```

### `packages/domain/src/notifications/nudge-emails.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { partnerAnsweredEmail, readyToRevealEmail } from "./nudge-emails.js";

const input = { partnerName: "Alex", webOrigin: "https://app.example", sessionId: "s1" };

describe.each([
  ["partnerAnsweredEmail", partnerAnsweredEmail],
  ["readyToRevealEmail", readyToRevealEmail],
])("%s", (_name, build) => {
  it("uses the generic subject", () => {
    expect(build(input).subject).toBe("Something's waiting for you in Couple Space");
  });

  it("links to the conversation and to settings", () => {
    const email = build(input);
    expect(email.text).toContain("https://app.example/conversation/s1");
    expect(email.text).toContain("https://app.example/settings");
  });

  it("escapes the partner's name in HTML", () => {
    const email = build({ ...input, partnerName: "<b>Al</b>" });
    expect(email.html).not.toContain("<b>Al</b>");
    expect(email.html).toContain("&lt;b&gt;Al&lt;/b&gt;");
  });
});
```
The "no prompt or answer text" guarantee comes from the **signatures**: neither function accepts that
data. That's stronger than a test searching for a string.

### `packages/domain/src/index.ts` (change) — add
```ts
export * from "./notifications/nudge-emails.js";
```

### `packages/domain/src/schemas/auth-schemas.ts` (change) — add
```ts
export const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
```

---

## Step 2 · Database

### `packages/database/src/schema/users.ts` (change)
**Before**
```ts
    dateOfBirth: date("date_of_birth").notNull(),
```
**After**
```ts
    dateOfBirth: date("date_of_birth").notNull(),
    /** P1-14: opt-in "partner answered" / "ready to reveal" emails. */
    emailNotifications: boolean("email_notifications").notNull().default(false),
```
**Migration:** `ADD COLUMN … boolean DEFAULT false NOT NULL` is safe on a table with rows (Postgres fills
the default). Read it to confirm it has the `DEFAULT`.

---

## Step 3 · API

### `apps/api/src/mail/nudge-mail.service.ts` (new)
```ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { partnerAnsweredEmail, readyToRevealEmail } from "@couple-space/domain";
import { users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { loadEnv } from "../config/env.js";
import { MAIL, type MailPort } from "./mail.port.js";

/** P1-14 nudges. Fire and forget: never throws, so callers can `void` it. */
@Injectable()
export class NudgeMailService {
  private readonly logger = new Logger(NudgeMailService.name);
  private readonly webOrigin = loadEnv().WEB_ORIGIN;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MAIL) private readonly mail: MailPort,
  ) {}

  async notifySubmitted(input: {
    sessionId: string;
    submitterId: string;
    partnerId: string;
    /** True when this submit completed the pair. */
    bothSubmitted: boolean;
  }): Promise<void> {
    try {
      const rows = await this.db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          emailNotifications: users.emailNotifications,
        })
        .from(users)
        .where(inArray(users.id, [input.submitterId, input.partnerId]));
      const submitter = rows.find((r) => r.id === input.submitterId);
      const partner = rows.find((r) => r.id === input.partnerId);
      if (!submitter || !partner || !partner.emailNotifications) return;

      // First answer: tell the partner. Second answer: tell the first answerer,
      // who is the "partner" from the second submitter's point of view.
      const build = input.bothSubmitted ? readyToRevealEmail : partnerAnsweredEmail;
      const email = build({
        partnerName: submitter.displayName,
        webOrigin: this.webOrigin,
        sessionId: input.sessionId,
      });
      await this.mail.sendMail({ to: partner.email, ...email });
    } catch (error) {
      // SmtpMail already logs the failure without content (P1-10).
      this.logger.warn(`Nudge for session ${input.sessionId} not sent`);
    }
  }
}
```
Register it in `MailModule` (`providers` and `exports`). `MailModule` is `@Global()`, so
`ConversationsService` can inject it. The `try/catch` is the same fire-and-forget contract as
`PushService.notifyNewConversation`.

### `apps/api/src/conversations/conversations.service.ts` (change)
**Constructor**: add `private readonly nudges: NudgeMailService,` (and add a `{ provide: NudgeMailService,
useValue: { notifySubmitted: vi.fn() } }` to every testing module in `conversations.service.test.ts`).

**`submitResponse`, before** (after P1-8)
```ts
    // Follow-ups don't push: the "new conversation" text would be wrong (see guide).
    if (isFirstToSubmit && ctx.session.parentSessionId == null) {
      // Fire and forget: notifyNewConversation never throws.
      void this.push.notifyNewConversation({
        starterId: user.id,
        partnerIds: ctx.memberIds.filter((id) => id !== user.id),
        sessionId,
      });
    }
```
**After**
```ts
    const isMainSession = ctx.session.parentSessionId == null;
    const partnerId = ctx.memberIds.find((id) => id !== user.id);

    // Follow-ups don't push or email: the wording would be wrong (P1-8).
    if (isFirstToSubmit && isMainSession) {
      // Fire and forget: notifyNewConversation never throws.
      void this.push.notifyNewConversation({
        starterId: user.id,
        partnerIds: ctx.memberIds.filter((id) => id !== user.id),
        sessionId,
      });
    }
    if (isMainSession && partnerId) {
      // Fire and forget: notifySubmitted never throws.
      void this.nudges.notifySubmitted({
        sessionId,
        submitterId: user.id,
        partnerId,
        bothSubmitted: !isFirstToSubmit,
      });
    }
```
`!isFirstToSubmit` is right in a two-person couple: if someone else had already submitted, this submit
completes the pair.

### Test — `conversations.service.test.ts` (change)
In the `submitResponse notifications` describe, add:
```ts
  it("emails ready-to-reveal when the second answer arrives", async () => {
    // Arrange as the existing "second submit" case (partner already submitted).
    // …
    expect(nudges.notifySubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ bothSubmitted: true, submitterId: "user-1" }),
    );
  });

  it("sends no nudge for a follow-up", async () => {
    // Session row with parentSessionId: "s0".
    // …
    expect(nudges.notifySubmitted).not.toHaveBeenCalled();
  });
```
Copy the arrange steps from the existing push cases in that describe; they set up the same selects.

### `apps/api/src/mail/nudge-mail.service.test.ts` (new)
```ts
import { Test } from "@nestjs/testing";
import { DB } from "../db/db.module.js";
import { MAIL } from "./mail.port.js";
import { NudgeMailService } from "./nudge-mail.service.js";
import { queryResult } from "../../test/factories.js";

describe("NudgeMailService", () => {
  async function build(rows: Array<Record<string, unknown>>, mail = { sendMail: vi.fn() }) {
    process.env.DATABASE_URL ??= "postgres://nudge-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";
    const db = { select: vi.fn(() => queryResult(rows)) };
    const module = await Test.createTestingModule({
      providers: [NudgeMailService, { provide: DB, useValue: db }, { provide: MAIL, useValue: mail }],
    }).compile();
    return { service: module.get(NudgeMailService), mail };
  }

  const submitter = { id: "u1", email: "a@x.com", displayName: "Ana", emailNotifications: false };
  const partner = { id: "u2", email: "b@x.com", displayName: "Ben", emailNotifications: true };

  it("emails an opted-in partner", async () => {
    const { service, mail } = await build([submitter, partner]);
    await service.notifySubmitted({ sessionId: "s1", submitterId: "u1", partnerId: "u2", bothSubmitted: false });
    expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "b@x.com" }));
  });

  it("sends nothing to a partner who hasn't opted in", async () => {
    const { service, mail } = await build([submitter, { ...partner, emailNotifications: false }]);
    await service.notifySubmitted({ sessionId: "s1", submitterId: "u1", partnerId: "u2", bothSubmitted: false });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it("never throws when SMTP fails", async () => {
    const mail = { sendMail: vi.fn().mockRejectedValue(new Error("down")) };
    const { service } = await build([submitter, partner], mail);
    await expect(
      service.notifySubmitted({ sessionId: "s1", submitterId: "u1", partnerId: "u2", bothSubmitted: true }),
    ).resolves.toBeUndefined();
  });
});
```

### Preferences endpoint
`apps/api/src/users/dto/update-preferences.schema.ts` re-exports `updatePreferencesSchema`
(same as the other DTOs). In `UsersService`:
```ts
  async updatePreferences(userId: string, input: UpdatePreferencesInput) {
    await this.db
      .update(users)
      .set({ emailNotifications: input.emailNotifications, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return this.getMe(userId);
  }
```
and add `emailNotifications: row.emailNotifications` to the object `getMe` returns. In `UsersController`:
```ts
  @Patch("me/preferences")
  @UseGuards(JwtAuthGuard)
  updatePreferences(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.users.updatePreferences(user.id, updatePreferencesSchema.parse(body));
  }
```

---

## Step 4 · Web

### `apps/web/hooks/use-me.ts` (change)
Add `emailNotifications: boolean;` to `Me`, then:
```ts
export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePreferencesInput) =>
      apiFetch<Me>("/me/preferences", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (me) => queryClient.setQueryData(ME_QUERY_KEY, me),
  });
}
```

### `apps/web/app/(app)/settings/page.tsx` (change)
A "Notifications" card. The checkbox is uncontrolled and the server value is the source of truth, so
there's no form and no state:
```tsx
      <Card>
        <CardHeader>
          <CardTitle>Email nudges</CardTitle>
          <CardDescription>
            An email when your partner answers, and when you can both reveal.
            Emails never include questions or answers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              // key resets the uncontrolled input when the server value changes.
              key={String(me.data.emailNotifications)}
              defaultChecked={me.data.emailNotifications}
              disabled={updatePreferences.isPending}
              onChange={(event) =>
                updatePreferences.mutate({ emailNotifications: event.target.checked })
              }
            />
            Send me email nudges
          </label>
          {updatePreferences.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t save that. Please try again.
            </p>
          ) : null}
        </CardContent>
      </Card>
```
There's no `Switch`/`Checkbox` in `components/ui` yet. Use a native checkbox, or add the shadcn Base UI
`switch` (a new primitive, so your call).

---

## Verification
1. `generate` → read → `migrate`. `pnpm check-types && pnpm test`.
2. With Ethereal: B turns nudges on. A answers a new conversation → B gets "Ana answered a conversation"
   with a link and no question text.
3. B answers → A gets nothing (A is opted out). A opts in and repeats with a new session → A gets "ready to reveal".
4. Follow-up answers → no email.
5. Break SMTP → answering still works instantly, and the log shows `[Mail] send failed …` with no body.
