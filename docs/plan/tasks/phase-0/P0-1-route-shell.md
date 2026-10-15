# P0-1 · `/conversation/[id]` route shell

[← Phase 0](../phase-0-core-loop.md) · Size **S** · Depends on: nothing · Next: [P0-2](P0-2-answering-state.md)

**Goal:** clicking a prompt (or a hub card) lands on a real page that shows the prompt, instead of a 404.

**Done when:**
- `/conversation/<real id>` shows a back link, the prompt title and text, and a placeholder for the viewer's state.
- `/conversation/<someone else's id>` and `/conversation/nonsense` show "Conversation not found" with a link back to `/couple`.
- While it loads, you see a skeleton rather than a blank page.

---

## What already exists (reuse, don't rebuild)

| Thing | Where | Notes |
| --- | --- | --- |
| Session data | `hooks/use-sessions.ts` → `useSessionQuery(id)` | Returns `SessionDetailDto`: `prompt`, `phase`, `partnerSubmitted`, `responses[]` |
| Viewer id | `hooks/use-me.ts` → `useMeQuery()` | `me.data.id` tells you which response is yours |
| Login gate | `app/(app)/layout.tsx` | Anything under `app/(app)/` already requires login + verified email |
| Not-found page | `components/organisms/redirect-to/redirect-to.tsx` | Title, message and a link |
| Skeleton atom | `components/ui/skeleton.tsx` | Used by `ConversationLoader` |
| Button styles | `buttonVariants` from `components/ui/button.tsx` | Use on a `Link` for the back link (same pattern as `StartConversation`) |

## From the prototype

`between-us-source/src/routes/conversation.$id.tsx` → `ConversationPage`, and `PageSkeleton` in
`between-us-source/src/components/couple-space.tsx`.

```tsx
// prototype: back link + header (TanStack Router, mock data)
<Button variant="ghost" className="-ml-3 h-11" onClick={() => navigate({ to: "/" })}>
  <ArrowLeft />
  Your space
</Button>
<header className="mt-8 border-b border-border pb-8">
  <p className="text-xs font-semibold uppercase text-accent-foreground">Tonight's question</p>
  <h1 className="mt-3 max-w-2xl font-display text-3xl leading-snug sm:text-4xl">
    {session.prompt.text}
  </h1>
  <p className="mt-4 text-sm text-muted-foreground">{session.prompt.title}</p>
</header>
```

**What changes and why:**
- `navigate()` → a Next `Link` to `/couple`. It's a real link, so middle-click and the browser's back button work.
- `useCouplePrototype()` → `useSessionQuery(id)` + `useMeQuery()`. The prototype's mock context is never extracted.
- `PageShell` (`max-w-[720px]`) → `max-w-3xl` (768px), as the extraction map says.
- `font-display` (Newsreader) is dropped. The brand default stays Figtree (extraction decision).
- `rounded-card` / `shadow-soft` card styling → the `rounded-lg ring-1 ring-foreground/10` look your `ConversationCard` already uses.

---

## Steps

### Step 1 · API: reject ids that aren't UUIDs

Today `GET /sessions/nonsense` reaches Postgres and fails with a 500, because the `id` column is a `uuid`.
Validate it at the controller so bad links get a clean 400.

`apps/api/src/conversations/conversations.controller.ts`: import `ParseUUIDPipe` and use it on every `:id` param.

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
```

```ts
  @Get("sessions/:id")
  getSession(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.conversations.getSession(user, id);
  }

  @Post("sessions/:id/responses")
  submitResponse(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const input = submitResponseSchema.parse(body);
    return this.conversations.submitResponse(user, id, input);
  }

  @Post("sessions/:id/reveal")
  revealSession(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.conversations.revealSession(user, id);
  }
```

### Step 2 · Web: read the status out of `apiFetch` errors

`apiFetch` throws `Error("API 404: {...}")`. Add one helper so pages don't string-match. It's used again in
P0-2 and P0-5.

Create `apps/web/lib/api-error.ts`:

```ts
/**
 * Reads the HTTP status out of an error thrown by `apiFetch`.
 *
 * @param error - Anything caught from a query or mutation
 * @returns The status code, or `undefined` if it isn't an API error (e.g. offline)
 */
export function apiErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;
  const match = /^API (\d{3}):/.exec(error.message);
  return match ? Number(match[1]) : undefined;
}

/**
 * Reads Nest's `reason` code (e.g. `already_submitted`) out of an `apiFetch` error.
 *
 * @remarks
 * Nest exceptions in this API are thrown as `new XException({ reason })`, so the
 * response body is `{ "reason": "..." }`.
 *
 * @param error - Anything caught from a query or mutation
 * @returns The reason code, or `undefined` if there isn't one
 */
export function apiErrorReason(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const body = error.message.replace(/^API \d{3}: /, "");
  try {
    const parsed = JSON.parse(body) as { reason?: unknown };
    return typeof parsed.reason === "string" ? parsed.reason : undefined;
  } catch {
    return undefined;
  }
}
```

### Step 3 · Skeleton (from the prototype's `PageSkeleton detail`)

Create `apps/web/components/molecules/session-page-skeleton/session-page-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for the conversation page while the session loads.
 *
 * @remarks
 * Rendered as an `<output>` (implicit `status` role), the same pattern as
 * `ConversationLoader`, so screen readers announce it once.
 */
export function SessionPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <output aria-label="Loading conversation" className="flex flex-col gap-8">
        <Skeleton aria-hidden="true" className="h-8 w-48 rounded-md" />
        <div className="flex flex-col gap-3 border-b border-border pb-8">
          <Skeleton aria-hidden="true" className="h-3 w-28 rounded-md" />
          <Skeleton aria-hidden="true" className="h-9 w-full rounded-md" />
          <Skeleton aria-hidden="true" className="h-9 w-2/3 rounded-md" />
        </div>
        <Skeleton aria-hidden="true" className="h-56 w-full rounded-lg" />
      </output>
    </main>
  );
}
```

### Step 4 · Prompt header (from the prototype's inline `<header>`)

Create `apps/web/components/molecules/session-prompt-header/session-prompt-header.tsx`:

```tsx
import type { SessionDetailDto } from "@/hooks/use-sessions";

type SessionPromptHeaderProps = {
  /** The prompt from `GET /sessions/:id`. */
  prompt: SessionDetailDto["prompt"];
};

export function SessionPromptHeader({
  prompt,
}: Readonly<SessionPromptHeaderProps>) {
  return (
    <header className="border-b border-border pb-8">
      <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
        {prompt.title}
      </p>
      <h1 className="mt-3 text-3xl leading-snug sm:text-4xl">{prompt.text}</h1>
      {prompt.description ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {prompt.description}
        </p>
      ) : null}
    </header>
  );
}
```

### Step 5 · The page

Create `apps/web/app/(app)/conversation/[id]/page.tsx`. The four `<p>` placeholders get replaced in
P0-2, P0-3 and P0-5.

> Next 16: read route params in client pages with `useParams()`. The `params` *prop* is a Promise in this
> version (see `apps/web/AGENTS.md` and your start-page guide).

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useMeQuery } from "@/hooks/use-me";
import { useSessionQuery } from "@/hooks/use-sessions";
import { apiErrorStatus } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { RedirectTo } from "@/components/organisms/redirect-to/redirect-to";
import { SessionPageSkeleton } from "@/components/molecules/session-page-skeleton/session-page-skeleton";
import { SessionPromptHeader } from "@/components/molecules/session-prompt-header/session-prompt-header";

/** Statuses that mean "this isn't a conversation you can open". */
const NOT_FOUND_STATUSES = new Set([400, 403, 404]);

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMeQuery();
  const session = useSessionQuery(id);

  if (session.isPending || me.isPending) return <SessionPageSkeleton />;

  if (session.isError) {
    const notFound = NOT_FOUND_STATUSES.has(apiErrorStatus(session.error) ?? 0);
    return (
      <RedirectTo
        pageTitle={notFound ? "Conversation not found" : "Something went wrong"}
        pageMessage={
          notFound
            ? "This conversation doesn't exist or isn't part of your space."
            : "We couldn't load this conversation. Please try again in a moment."
        }
        redirectTo="/couple"
      />
    );
  }

  // The (app) layout already redirects when /me fails.
  if (!me.data) return null;

  const { data } = session;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 p-6">
      <Link
        href="/couple"
        className={cn(buttonVariants({ variant: "ghost" }), "-ml-2.5 self-start")}
      >
        <ArrowLeftIcon aria-hidden="true" />
        Back to conversations
      </Link>

      <SessionPromptHeader prompt={data.prompt} />

      {data.phase === "answering" && <p>Answer form (P0-2)</p>}
      {data.phase === "waiting_for_partner" && <p>Waiting (P0-3)</p>}
      {data.phase === "ready_to_reveal" && <p>Reveal button (P0-5)</p>}
      {data.phase === "revealed" && <p>Both answers (P0-5)</p>}
    </main>
  );
}
```

---

## Check

1. `pnpm dev`, log in, go to `/start`, pick a theme and a prompt. You land on the new page, not a 404.
2. From `/couple`, click any existing card. Same page, same prompt.
3. Visit `/conversation/nonsense`: "Conversation not found" with a link back. (Before Step 1 this was a 500.)
4. Visit `/conversation/00000000-0000-0000-0000-000000000000`: "Conversation not found".
5. Throttle the network in dev tools: the skeleton shows while it loads.
6. Type-check: `pnpm --filter @couple-space/web exec tsc --noEmit` and `pnpm --filter @couple-space/api exec tsc --noEmit` show no errors in the files you touched. (`pnpm check-types` only covers `domain` and `database`. The existing `LayoutProps` and `supertest/types` errors are [H-14](../housekeeping.md#code).)

## Pitfalls

- Call every hook **before** the early returns. P0-2 and P0-5 add mutation hooks at the top of this page.
- Don't fetch `/couples/me` for the partner's name. `responses[]` already carries `displayName` for both members.
