# P1-13 · Legal + trust pages, data export

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Content source: [L-1…L-5](../legal-and-business.md) · After: [P1-12](P1-12-account-deletion.md) · Next: [P1-14](P1-14-email-nudges.md)

**Goal:** public `/privacy`, `/terms` and `/how-privacy-works` pages linked from the landing page, the
register form and settings, plus `GET /me/export`, which downloads your own data as JSON.

**Done when:**

- The three pages render logged out and share a simple reading layout.
- "How your answers stay private" explains the reveal rules in plain English (written below; it's
  product copy, not legal text).
- Privacy and terms have the **structure** in place with clearly marked placeholders. The wording comes
  from L-5, which needs L-1…L-4 answered first. **I haven't written legal text.**
- Register says "By creating an account you agree to the Terms and Privacy policy", with links.
- `GET /me/export` returns your profile, memberships, your own answers (with prompt text) and your
  reveals. Settings has a "Download my data" button.

### Flags

- **L-3 may add an explicit consent checkbox at registration** (special category data). That's a legal
  outcome, not decided, so it isn't in this guide. If L-3 says yes, it's a `registerSchema` field
  (`consentSpecialCategory: z.literal(true)`) plus a stored `users.consented_at`. A small follow-up.
- **The export contains only your own data.** Your partner's answers are their personal data, so they're
  left out even when you've both revealed. Each answer includes its prompt text so it makes sense alone.
- **No CMS or MDX.** The pages are plain TSX, following the existing pages. If you'd rather keep legal
  text in Markdown, `@next/mdx` would be a new dependency; ask first.

---

## Step 1 · Shared layout

### `apps/web/app/(legal)/layout.tsx` (new)
A route group, so the URLs are `/privacy` etc. with no `(legal)` in them, and it sits outside `(app)`,
so there's no login.
```tsx
import Link from "next/link";
import { Logo } from "@/components/atoms/logo/logo";

type LegalLayoutProps = {
  children: React.ReactNode;
};

export default function LegalLayout({ children }: Readonly<LegalLayoutProps>) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Couple Space home">
          <Logo className="size-10" />
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/how-privacy-works" className="underline-offset-4 hover:underline">
            How privacy works
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
        </nav>
      </header>
      <main className="flex flex-col gap-6 text-base leading-relaxed [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground">
        {children}
      </main>
    </div>
  );
}
```
The `[&_h2]` selectors give prose styling without adding `@tailwindcss/typography`. If you'd like the
typography plugin instead, that's a new dependency.

### `apps/web/components/atoms/legal-placeholder/legal-placeholder.tsx` (new)
```tsx
type LegalPlaceholderProps = {
  /** What L-task the wording depends on, e.g. "L-1". */
  source: string;
  children: React.ReactNode;
};

/** Marks text that must be replaced before Gate B. Visible on purpose. */
export function LegalPlaceholder({ source, children }: Readonly<LegalPlaceholderProps>) {
  return (
    <p className="rounded-md border border-dashed border-destructive/50 p-3 text-sm text-destructive">
      To write ({source}): {children}
    </p>
  );
}
```
It's visible on purpose, so an unfinished page can't ship unnoticed. P1-23b (Gate B) has to grep for
`LegalPlaceholder` and find nothing.

---

## Step 2 · The pages

### `apps/web/app/(legal)/how-privacy-works/page.tsx` (new)
Written from the actual rules (`canViewerSeeAnswerText`, Q7, Q8, Q17, Q18, Q22). Keep it in step if a
rule changes.
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How your answers stay private · Couple Space",
};

export default function HowPrivacyWorksPage() {
  return (
    <>
      <h1>How your answers stay private</h1>
      <p>
        Couple Space is built so you can answer honestly before you know what
        your partner said. Here&apos;s exactly who can see what, and when.
      </p>

      <h2>While you&apos;re answering</h2>
      <ul>
        <li>Only you can see your answer, including drafts.</li>
        <li>Your partner can see that you&apos;ve answered, but not what you wrote.</li>
        <li>Once you submit, you can&apos;t edit it.</li>
      </ul>

      <h2>When you&apos;ve both answered</h2>
      <ul>
        <li>
          Nothing is shown automatically. Each of you taps <strong>Reveal</strong> when
          you&apos;re ready, and you only see your partner&apos;s answer after
          you&apos;ve tapped it yourself.
        </li>
        <li>
          If you&apos;re not ready, you don&apos;t have to reveal. You can also skip a
          conversation.
        </li>
      </ul>

      <h2>Follow-up questions</h2>
      <p>
        Follow-ups appear once you&apos;ve both revealed. They&apos;re answered the
        same blind way, but there&apos;s no reveal step: both answers appear as soon
        as you&apos;ve both submitted.
      </p>

      <h2>Who else can see your answers</h2>
      <ul>
        <li>Nobody outside your couple. There are no public profiles and no sharing.</li>
        <li>
          Answers are never written to our logs and are removed from error reports.
        </li>
        <li>
          Answers are stored encrypted at rest by our hosting provider. They
          aren&apos;t separately encrypted inside the app yet; we&apos;ll update this
          page if that changes.
        </li>
      </ul>

      <h2>If you leave or delete your account</h2>
      <ul>
        <li>
          If either of you leaves, your shared space closes for <strong>both</strong> of
          you. Neither of you can see past conversations, and they&apos;re permanently
          deleted after 30 days.
        </li>
        <li>
          If you delete your account, your answers are deleted straight away and the
          shared space closes.
        </li>
        <li>You can download a copy of your own answers from Settings at any time.</li>
      </ul>

      <h2>Notifications</h2>
      <p>
        Notifications never include a question or an answer, so nothing private shows
        on your lock screen.
      </p>
    </>
  );
}
```
Check the encryption paragraph against what's true when you ship (Q17), and the notifications paragraph
against P1-26's actual text ("<name> started a new conversation": no prompt text, so it's accurate).

### `apps/web/app/(legal)/privacy/page.tsx` (new, structure only)
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPlaceholder } from "@/components/atoms/legal-placeholder/legal-placeholder";

export const metadata: Metadata = { title: "Privacy policy · Couple Space" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>Last updated: <LegalPlaceholderInline /></p>

      <h2>Who we are</h2>
      <LegalPlaceholder source="L-1">
        Trading name and structure, contact address, and whether an ICO registration applies (L-2).
      </LegalPlaceholder>

      <h2>What we collect</h2>
      <ul>
        <li>Account: email, display name, date of birth, password (stored as a one-way hash).</li>
        <li>Your answers and drafts, and when you revealed.</li>
        <li>Device push subscriptions, if you turn notifications on.</li>
        <li>Security logs: sign-ins and account changes, without any answer content.</li>
      </ul>

      <h2>Why, and on what lawful basis</h2>
      <LegalPlaceholder source="L-3">
        Lawful basis for each item above, and the Article 9 condition for answers
        (likely explicit consent).
      </LegalPlaceholder>

      <h2>Where it&apos;s stored</h2>
      <LegalPlaceholder source="L-5">
        Hosting provider and the EU data region; any sub-processors (email: Brevo).
      </LegalPlaceholder>

      <h2>How long we keep it</h2>
      <ul>
        <li>Shared conversations: deleted 30 days after a couple space is closed.</li>
        <li>Your answers: deleted immediately when you delete your account.</li>
        <li>Security logs: kept, but they never contain answers.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can download your data from Settings, change your details, and delete your
        account at any time. See also{" "}
        <Link href="/how-privacy-works" className="underline underline-offset-4">
          how your answers stay private
        </Link>
        .
      </p>
      <LegalPlaceholder source="L-5">
        UK GDPR rights list, how to contact us, and the right to complain to the ICO.
      </LegalPlaceholder>
    </>
  );
}

function LegalPlaceholderInline() {
  return <span className="text-destructive">[date]</span>;
}
```
The facts in the lists (what's collected, retention) are accurate for this codebase after P1-11/P1-12.
Everything legal is a placeholder.

### `apps/web/app/(legal)/terms/page.tsx` (new, structure only)
```tsx
import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/atoms/legal-placeholder/legal-placeholder";

export const metadata: Metadata = { title: "Terms · Couple Space" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>

      <h2>Who can use Couple Space</h2>
      <p>You must be 18 or older. Each person may have one account.</p>

      <h2>Your content</h2>
      <LegalPlaceholder source="L-5">
        You own your answers; the licence we need to store and show them to your partner.
      </LegalPlaceholder>

      <h2>Acceptable use</h2>
      <LegalPlaceholder source="L-5">What isn&apos;t allowed, and what we can do about it.</LegalPlaceholder>

      <h2>The service</h2>
      <LegalPlaceholder source="L-1">
        Provided by [entity]; beta status; no guarantee of availability; liability limits.
      </LegalPlaceholder>

      <h2>Ending your account</h2>
      <p>
        You can leave your couple space or delete your account at any time from Settings.
      </p>

      <h2>Changes and contact</h2>
      <LegalPlaceholder source="L-1">How we notify changes; governing law; contact address.</LegalPlaceholder>
    </>
  );
}
```

---

## Step 3 · Links

### `apps/web/app/page.tsx` (change)
**Before**
```tsx
      </div>
    </main>
  );
}
```
**After**
```tsx
      </div>
      <footer className="flex gap-4 text-xs text-muted-foreground">
        <Link href="/how-privacy-works" className="underline-offset-4 hover:underline">
          How privacy works
        </Link>
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="underline-offset-4 hover:underline">
          Terms
        </Link>
      </footer>
    </main>
  );
}
```

### `apps/web/components/auth/register.form.tsx` (change)
**Before**
```tsx
        <Field>
          <Button
            type="submit"
            disabled={registerMutation.isPending}
```
**After**
```tsx
        <FieldDescription className="text-center text-xs">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy policy
          </Link>
          .
        </FieldDescription>

        <Field>
          <Button
            type="submit"
            disabled={registerMutation.isPending}
```

---

## Step 4 · Export API

### `apps/api/src/users/users.service.ts` (change) — add
Add `coupleMemberships`, `prompts`, `conversationSessions`, `sessionResponses` and `sessionReveals` to
the database import, and `isNotNull` + `and` to drizzle's.
```ts
  /**
   * The user's own data only. A partner's answers are their personal data,
   * so they're excluded even when revealed.
   */
  async exportMe(userId: string) {
    const me = await this.getMe(userId);

    const memberships = await this.db
      .select({
        coupleId: coupleMemberships.coupleId,
        status: coupleMemberships.status,
        joinedAt: coupleMemberships.createdAt,
        leftAt: coupleMemberships.leftAt,
      })
      .from(coupleMemberships)
      .where(eq(coupleMemberships.userId, userId));

    const answers = await this.db
      .select({
        sessionId: sessionResponses.sessionId,
        prompt: prompts.text,
        answer: sessionResponses.body,
        submittedAt: sessionResponses.submittedAt,
      })
      .from(sessionResponses)
      .innerJoin(conversationSessions, eq(conversationSessions.id, sessionResponses.sessionId))
      .innerJoin(prompts, eq(prompts.id, conversationSessions.promptId))
      .where(eq(sessionResponses.userId, userId));

    const reveals = await this.db
      .select({ sessionId: sessionReveals.sessionId, revealedAt: sessionReveals.revealedAt })
      .from(sessionReveals)
      .where(eq(sessionReveals.userId, userId));

    await this.audit.append({
      actorUserId: userId,
      action: "user.export",
      entityType: "user",
      entityId: userId,
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        email: me.email,
        displayName: me.displayName,
        dateOfBirth: me.dateOfBirth,
        emailVerified: me.emailVerified,
      },
      memberships,
      // Drafts are included (they're yours), marked by submittedAt: null.
      answers,
      reveals,
    };
  }
```

### `apps/api/src/users/users.controller.ts` (change) — add
```ts
  @Get("me/export")
  @UseGuards(JwtAuthGuard)
  async exportMe(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    return this.users.exportMe(user.id);
  }
```
`no-store` stops a shared or proxy cache keeping the answers.

### Test — `apps/api/src/users/users.service.test.ts` (change) — add
```ts
describe("UsersService.exportMe", () => {
  it("returns only the viewer's own rows and audits the export", async () => {
    const db = { select: vi.fn() };
    db.select
      .mockReturnValueOnce(queryResult([{ id: "u1", email: "a@example.com", emailVerified: true, displayName: "Sam", dateOfBirth: "1990-01-01" }]))
      .mockReturnValueOnce(queryResult([{ coupleId: "c1", status: "active", joinedAt: new Date(), leftAt: null }]))
      .mockReturnValueOnce(queryResult([{ sessionId: "s1", prompt: "Q?", answer: "Mine", submittedAt: new Date() }]))
      .mockReturnValueOnce(queryResult([]));
    const audit = { append: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: DB, useValue: db }, { provide: AuditService, useValue: audit }],
    }).compile();

    const result = await module.get(UsersService).exportMe("u1");

    expect(result.answers).toEqual([expect.objectContaining({ answer: "Mine" })]);
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "user.export" }));
  });
});
```
The "own rows only" guarantee is the `where userId = …` on each query. The test checks the shape; the
manual check below checks the filter against a real DB.

---

## Step 5 · Export button

### `apps/web/hooks/use-me.ts` (change) — add
```ts
/** Fetches GET /me/export and saves it as a file. No state: it's all in the mutation. */
export function useExportDataMutation() {
  return useMutation({
    mutationFn: async () => {
      const data = await apiFetch<unknown>("/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `couple-space-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}
```
This hook touches the DOM, which hooks don't usually do. The alternative is an `<a href="/backend/me/export" download>`,
but the cookie-based `apiFetch` base URL differs between local and hosted. Keeping it in `apiFetch` means
one code path.

### `apps/web/app/(app)/settings/page.tsx` (change)
A "Your data" card, before "Delete account":
```tsx
      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            A copy of your profile and your own answers, as a JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="self-start"
            disabled={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            {exportData.isPending ? "Preparing…" : "Download my data"}
          </Button>
          {exportData.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t prepare your download. Please try again.
            </p>
          ) : null}
          <Link href="/how-privacy-works" className="text-sm underline underline-offset-4">
            How your answers stay private
          </Link>
        </CardContent>
      </Card>
```
with `const exportData = useExportDataMutation();`.

---

## Verification
1. `pnpm check-types && pnpm test`.
2. Logged out: `/how-privacy-works`, `/privacy` and `/terms` load, and placeholders show in red dashed boxes.
3. Register page shows the agreement line with working links.
4. As A with answered sessions: Settings → Download my data → the JSON has A's answers with their prompt
   text, and **none** of B's text (search the file for one of B's answers).
5. `curl -I /me/export` → `Cache-Control: no-store`; one `user.export` audit row.
6. Before Gate B: `grep -r LegalPlaceholder apps/web/app` returns nothing.
