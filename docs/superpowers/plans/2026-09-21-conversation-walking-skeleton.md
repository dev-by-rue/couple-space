# Conversation Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Primary audience:** Human implementer (senior FE). Nest/domain tasks are included so the web contract is final-shaped. Do not commit unless the user explicitly asks.

**Goal:** Ship the private conversation walking skeleton: active `/couple` hub → curated `/start` → session answer → wait → per-user **Reveal** → truthful hub statuses, with Nest-owned soft-lock and redaction.

**Architecture:** Domain pure functions decide viewer phase and whether answer text is visible. Drizzle tables store sessions, responses, and per-user reveals. Nest exposes catalog + session APIs that redact by viewer. Web is thin React Query + atomic UI under existing `apps/web` conventions (no Lovable copy, no auto-reveal).

**Tech Stack:** pnpm/turbo, NestJS, Drizzle (`@couple-space/database`), `@couple-space/domain` + Vitest, Next.js App Router, React Query, shadcn/Base UI atoms, Tailwind v4 tokens.

**Specs:** `docs/extraction/01-prototype-audit.md`, `02-extraction-map.md`, `03-requirements.md` (FR-01, 05–07, 12–18), `04-tickets.md` (T0 ★). Product: `docs/product/scope.md` (promote per-user Reveal before or with Task 1).

**Out of this plan (follow-on plans):** T1 invite-pending polish, T2 multi-theme, T3 custom propose/accept, T4 anonymous partner prompts, T5 optional follow-ups, T6 hardening pass.

## Consolidated plan (2026-10-09) — start here

Tasks 1–6 are done (domain, schema, Nest API, hooks). What remains, page by page. Build each page's components as that page needs them (Task 7 file list = reference, prototype = visuals only).

**Local dev:** Homebrew `postgresql@15` on `127.0.0.1:5432` (not Supabase). Test couple (active): `ruebencee@gmail.com` / `partner@test.local`, both `Password1234`. Use a normal + private window to be both partners.

1. [x] **Local DB ready** — migrations 0000–0004 applied, curated prompts seeded, active test couple created via the API.
2. [x] **API smoke (two users)** — passed 2026-10-09. Repeatable steps (Postman + curl): `docs/engineering/conversation-api-smoke.md`.
3. [x] **`/couple` hub** (done 2026-10-11; error/empty copy still placeholder) — one session list sorted by what needs you (Answer privately → Reveal → Waiting for partner → View answers). Card = prompt title + status pill + one CTA. Empty state. Start only when couple is `active`.
4. [ ] **`/start`** — 📘 step-by-step guide with progress log: [`2026-10-11-start-page-guide.md`](2026-10-11-start-page-guide.md). Summary: `/start` lists all themes (closed) → `/start/[slug]` (readable, e.g. `/start/dreams-and-plans`) shows that theme + its prompts (3-across desktop, stacked mobile) + "← All themes". Curated only. Picking a prompt creates the session (`POST /sessions`) and routes to `/conversation/[id]`.
5. [ ] **`/conversation/[id]`** — one page, four viewer states:

   | Viewer state | Shows |
   |---|---|
   | Not answered | Prompt, "can't be changed after submitting" note, textarea, Submit → confirm dialog |
   | Answered, partner hasn't | **Waiting on {partner}** — "Your answer is saved and can't be changed. {partner} can't see it. Once {partner} has answered, you'll both get a Reveal button — open the answers whenever you're ready." |
   | Both answered, not revealed | **Reveal** button, no answer text |
   | Revealed | Both answers |

6. [ ] **Two-browser smoke** of the full loop (Task 8 Step 4).

**Reveal table (what each partner sees via `GET /sessions/:id`):**

| Step | A sees | B sees |
|---|---|---|
| A starts + submits | Own answer, waiting | Session exists, "Answer privately" — none of A's answer |
| B submits | Reveal button, no text | Reveal button, no text |
| A reveals | Both answers | Still only Reveal button |
| B reveals | Both answers | Both answers |

**Decided for T0:** unlimited concurrent sessions; no skip/decline; one sorted hub list (not sections) — all deliberately simple and easy to refactor after real-couple feedback.

**Parked (decide + promote to `scope.md` before T3):**
- Session cap per couple and the rule for "completed".
- Skip/decline: suggested — always allowed, optional **preset** reason (no free text: avoids pressure and a DM-like channel).
- Update docs that still say Supabase (build brief, setup runbook, platform spec) to local Postgres.

## Global Constraints

- Behaviour from `scope.md` + extraction FRs — prototype is visual only
- No throwaway behaviour: no auto-reveal, no “Reveal together”, no `CouplePrototypeProvider`
- No Next.js `app/api` BFF — browser calls Nest via `apiFetch` + cookies
- Atoms in `components/ui/` (add via apps/web shadcn); molecules/organisms flat
- Do not copy `between-us-source/src/components/ui/`*
- Keep default Figtree brand tokens; waiting may add semantic CSS vars only if needed for UI
- Business rules and redaction in Nest/domain — never trust the client for soft-lock
- Do not commit unless the user explicitly asks
- MVP two-person couples; prefer membership rows in queries (no hard-coded partner_a columns)

## File map


| Path                                                    | Action                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/product/scope.md`                                 | Update reveal + note deferred partner-prompt model for later tickets                                                                                                      |
| `packages/domain/src/session-viewer-phase.ts`           | Create — viewer status enum + pure fn                                                                                                                                     |
| `packages/domain/src/session-answer-visibility.ts`      | Create — can viewer see a member’s answer text                                                                                                                            |
| `packages/domain/src/session-viewer-phase.test.ts`      | Create                                                                                                                                                                    |
| `packages/domain/src/session-answer-visibility.test.ts` | Create                                                                                                                                                                    |
| `packages/domain/src/index.ts`                          | Export new modules                                                                                                                                                        |
| `packages/database/src/schema/prompt-themes.ts`         | Create                                                                                                                                                                    |
| `packages/database/src/schema/prompts.ts`               | Create                                                                                                                                                                    |
| `packages/database/src/schema/conversation-sessions.ts` | Create                                                                                                                                                                    |
| `packages/database/src/schema/session-responses.ts`     | Create                                                                                                                                                                    |
| `packages/database/src/schema/session-reveals.ts`       | Create                                                                                                                                                                    |
| `packages/database/src/schema/index.ts`                 | Export                                                                                                                                                                    |
| `packages/database` migration                           | Generate/apply via existing drizzle workflow                                                                                                                              |
| Seed curated themes/prompts                             | SQL seed or Nest bootstrap seed (one place)                                                                                                                               |
| `apps/api/src/conversations/*`                          | Module, controller, service, DTOs                                                                                                                                         |
| `apps/api/src/app.module.ts`                            | Register ConversationsModule                                                                                                                                              |
| `apps/web` shadcn atoms                                 | Add textarea, dialog, tabs, tooltip, skeleton, collapsible as needed                                                                                                      |
| `apps/web/hooks/use-themes.ts`                          | Create                                                                                                                                                                    |
| `apps/web/hooks/use-sessions.ts`                        | Create                                                                                                                                                                    |
| `apps/web/lib/session-status-label.ts`                  | Create — map phase → UI copy                                                                                                                                              |
| `apps/web/components/molecules/*`                       | conversation-card, status-pill, theme-card, prompt-list-item, session-waiting, session-reveal-button, answer-card, couple-page-skeleton, how-it-works-steps (optional T0) |
| `apps/web/components/organisms/*`                       | session-answer-form, session-reveal-panel; adapt couple hub pieces                                                                                                        |
| `apps/web/app/(app)/couple/page.tsx`                    | Active hub: Start + list                                                                                                                                                  |
| `apps/web/app/(app)/start/page.tsx`                     | Create — curated only                                                                                                                                                     |
| `apps/web/app/(app)/conversation/[id]/page.tsx`         | Create                                                                                                                                                                    |


---

### Task 1: Promote product scope (docs)

**Files:**

- Modify: `docs/product/scope.md`

**Interfaces:**

- Produces: Written product rules that match FR-15–17 (per-user Reveal after both submitted)

- [x] **Step 1: Update Reveal section**

Replace the Reveal bullet under Core interaction loop so it matches decisions:

```markdown
- **Reveal:** Soft lock. A partner may submit and wait. Waiting UI may show that the partner has not answered yet. **No partner answer content** until both have submitted. After both have submitted, **each partner reveals for themselves** (Nest-owned per-user reveal). One partner revealing does not reveal for the other.
```

Keep guided discussion text for later tickets; add a one-line note that partner-added questions in MVP will evolve toward an anonymous `/start` catalog (details in `docs/extraction/03-requirements.md`) and must be promoted fully before T3/T4.

- [x] **Step 2: Resolve / annotate open questions**

Under Open product questions:

- Mark custom-prompt acceptance as **decided for extraction wave**: accept/discard, cap 3 (implementation in later plan).
- Leave concurrent sessions / completion / dissolution as open.

- [x] **Step 3: Stop** — do not commit unless asked.

---

### Task 2: Domain — viewer phase + answer visibility

**Files:**

- Create: `packages/domain/src/session-viewer-phase.ts`
- Create: `packages/domain/src/session-viewer-phase.test.ts`
- Create: `packages/domain/src/session-answer-visibility.ts`
- Create: `packages/domain/src/session-answer-visibility.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**

- Produces:
  - `SessionViewerPhase = "answering" | "waiting_for_partner" | "ready_to_reveal" | "revealed"`
  - `sessionViewerPhase(input): SessionViewerPhase`
  - `canViewerSeeAnswerText(input): boolean`

- [x] **Step 1: Write failing tests**

`session-viewer-phase.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sessionViewerPhase } from "./session-viewer-phase.js";

const members = ["u1", "u2"] as const;

describe("sessionViewerPhase", () => {
  it("answering when viewer has not submitted", () => {
    expect(
      sessionViewerPhase({
        viewerId: "u1",
        memberIds: [...members],
        responses: [
          { userId: "u1", submitted: false },
          { userId: "u2", submitted: false },
        ],
        revealedUserIds: [],
      }),
    ).toBe("answering");
  });

  it("waiting_for_partner when viewer submitted and partner has not", () => {
    expect(
      sessionViewerPhase({
        viewerId: "u1",
        memberIds: [...members],
        responses: [
          { userId: "u1", submitted: true },
          { userId: "u2", submitted: false },
        ],
        revealedUserIds: [],
      }),
    ).toBe("waiting_for_partner");
  });

  it("ready_to_reveal when both submitted and viewer has not revealed", () => {
    expect(
      sessionViewerPhase({
        viewerId: "u1",
        memberIds: [...members],
        responses: [
          { userId: "u1", submitted: true },
          { userId: "u2", submitted: true },
        ],
        revealedUserIds: [],
      }),
    ).toBe("ready_to_reveal");
  });

  it("revealed when viewer has revealed", () => {
    expect(
      sessionViewerPhase({
        viewerId: "u1",
        memberIds: [...members],
        responses: [
          { userId: "u1", submitted: true },
          { userId: "u2", submitted: true },
        ],
        revealedUserIds: ["u1"],
      }),
    ).toBe("revealed");
  });

  it("ready_to_reveal for u2 when only u1 has revealed", () => {
    expect(
      sessionViewerPhase({
        viewerId: "u2",
        memberIds: [...members],
        responses: [
          { userId: "u1", submitted: true },
          { userId: "u2", submitted: true },
        ],
        revealedUserIds: ["u1"],
      }),
    ).toBe("ready_to_reveal");
  });
});
```

`session-answer-visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canViewerSeeAnswerText } from "./session-answer-visibility.js";

describe("canViewerSeeAnswerText", () => {
  it("allows viewer to see their own submitted answer before reveal", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u1",
        authorSubmitted: true,
        bothSubmitted: false,
        viewerHasRevealed: false,
      }),
    ).toBe(true);
  });

  it("hides partner text until both submitted and viewer revealed", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u2",
        authorSubmitted: true,
        bothSubmitted: true,
        viewerHasRevealed: false,
      }),
    ).toBe(false);
  });

  it("shows partner text when both submitted and viewer revealed", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u2",
        authorSubmitted: true,
        bothSubmitted: true,
        viewerHasRevealed: true,
      }),
    ).toBe(true);
  });

  it("hides unsubmitted author text", () => {
    expect(
      canViewerSeeAnswerText({
        viewerId: "u1",
        answerAuthorId: "u1",
        authorSubmitted: false,
        bothSubmitted: false,
        viewerHasRevealed: false,
      }),
    ).toBe(false);
  });
});
```

- [x] **Step 2: Run tests — expect fail**

Run: `cd packages/domain && pnpm exec vitest run src/session-viewer-phase.test.ts src/session-answer-visibility.test.ts`  
Expected: FAIL (modules not found)

- [x] **Step 3: Implement**

`session-viewer-phase.ts`:

```ts
export type SessionViewerPhase =
  | "answering"
  | "waiting_for_partner"
  | "ready_to_reveal"
  | "revealed";

export type SessionViewerPhaseInput = {
  viewerId: string;
  memberIds: string[];
  responses: Array<{ userId: string; submitted: boolean }>;
  revealedUserIds: string[];
};

export function sessionViewerPhase(
  input: SessionViewerPhaseInput,
): SessionViewerPhase {
  const byUser = new Map(input.responses.map((r) => [r.userId, r.submitted]));
  const viewerSubmitted = byUser.get(input.viewerId) === true;
  const bothSubmitted = input.memberIds.every((id) => byUser.get(id) === true);
  const viewerRevealed = input.revealedUserIds.includes(input.viewerId);

  if (!viewerSubmitted) return "answering";
  if (!bothSubmitted) return "waiting_for_partner";
  if (!viewerRevealed) return "ready_to_reveal";
  return "revealed";
}
```

`session-answer-visibility.ts`:

```ts
export type AnswerVisibilityInput = {
  viewerId: string;
  answerAuthorId: string;
  authorSubmitted: boolean;
  bothSubmitted: boolean;
  viewerHasRevealed: boolean;
};

/** Own submitted answers are visible to the author; partner text needs both submit + viewer reveal. */
export function canViewerSeeAnswerText(input: AnswerVisibilityInput): boolean {
  if (!input.authorSubmitted) return false;
  if (input.answerAuthorId === input.viewerId) return true;
  return input.bothSubmitted && input.viewerHasRevealed;
}
```

Export from `index.ts`.

- [x] **Step 4: Run tests — expect pass**

Run: `cd packages/domain && pnpm exec vitest run src/session-viewer-phase.test.ts src/session-answer-visibility.test.ts`  
Expected: PASS

- [x] **Step 5: Stop** — commit only if asked.

---

### Task 3: Database schema + curated seed

**Files:**

- Create: `packages/database/src/schema/prompt-themes.ts`
- Create: `packages/database/src/schema/prompts.ts`
- Create: `packages/database/src/schema/conversation-sessions.ts`
- Create: `packages/database/src/schema/session-responses.ts`
- Create: `packages/database/src/schema/session-reveals.ts`
- Modify: `packages/database/src/schema/index.ts`
- Migration + seed (follow repo drizzle scripts in `packages/database`)

**Interfaces:**

- Produces tables: `prompt_themes`, `prompts`, `conversation_sessions`, `session_responses`, `session_reveals`
- `prompts.kind` for T0: `"curated"` only (keep column ready for `"custom"` later — do not implement custom flow)

- [x] **Step 1: Add schema files**

Match existing drizzle style (`uuid`, `text`, `timestamp withTimezone`, FKs to `couples` / `users`).

`prompt-themes.ts` — `id`, `title`, `description`, `symbol`, `sortOrder`, timestamps.

`prompts.ts` — `id`, `themeId` → themes, `title`, `description`, `text`, `kind` text not null default `curated`, `sortOrder`, timestamps. (No author yet in T0.)

`conversation-sessions.ts` — `id`, `coupleId` → couples, `promptId` → prompts, `createdAt`, `updatedAt`.

`session-responses.ts` — unique `(sessionId, userId)`; `body` text not null default `''`; `submittedAt` timestamptz nullable (null = not submitted).

`session-reveals.ts` — unique `(sessionId, userId)`; `revealedAt` timestamptz not null.

- [x] **Step 2: Export from schema index; generate + apply migration**

Run from `packages/database` (with DB env loaded as you do for other migrations):

```bash
pnpm generate
pnpm migrate
pnpm build
```

Expected: migration applies cleanly against local Supabase/Postgres; package build succeeds.

- [x] **Step 3: Seed ≥1 theme and ≥1 curated prompt**

Minimal seed so `/start` is not empty (can expand copy from prototype `mocks/data.ts` themes later). Prefer a checked-in SQL seed or a one-shot seed script owned by database package — pick one approach and document the command in the PR description.

- [x] **Step 4: Stop** — commit only if asked.

---

### Task 4: Nest ConversationsModule (API)

**Files:**

- Create: `apps/api/src/conversations/conversations.module.ts`
- Create: `apps/api/src/conversations/conversations.controller.ts`
- Create: `apps/api/src/conversations/conversations.service.ts`
- Create: `apps/api/src/conversations/conversations.service.test.ts` (redaction + reveal + immutable submit)
- Create: `apps/api/src/conversations/dto/create-session.schema.ts` — zod `{ promptId: z.string().uuid() }`
- Create: `apps/api/src/conversations/dto/submit-response.schema.ts` — zod `{ text: z.string().trim().min(1).max(10000) }`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: domain `sessionViewerPhase`, `canViewerSeeAnswerText`; Db tables from Task 3; `JwtAuthGuard` + `CurrentUser`
- Produces HTTP (cookie auth):
  - `GET /themes` → `{ themes: Array<{ id, title, description, symbol, prompts: Array<{ id, title, description, text }> }> }`
  - `GET /sessions` → list for viewer’s couple: `{ sessions: Array<{ id, promptTitle, promptText, phase: SessionViewerPhase, updatedAt }> }`
  - `POST /sessions` body `{ promptId }` → `{ id }` (couple must be `active`)
  - `GET /sessions/:id` → detail DTO below
  - `POST /sessions/:id/responses` body `{ text }` → detail DTO
  - `POST /sessions/:id/reveal` → detail DTO

Detail DTO shape:

```ts
type SessionDetailDto = {
  id: string;
  prompt: { id: string; title: string; description: string; text: string; kind: "curated" };
  phase: SessionViewerPhase;
  partnerSubmitted: boolean;
  responses: Array<{
    userId: string;
    displayName: string;
    submitted: boolean;
    /** null when redacted */
    text: string | null;
  }>;
};
```

- [x] **Step 1: Write service tests for invariants** (mock Db or use test DB per existing couples.service.test patterns)

Cover:

1. Submit twice → conflict / idempotent reject (immutable)
2. GET detail before partner submit → partner `text` is `null`, `partnerSubmitted` false
3. Both submitted, no reveal → partner `text` null, `phase === "ready_to_reveal"`
4. After reveal for u1 → u1 sees partner text; simulate u2 GET → partner text still null for u2 until u2 reveals
5. `POST /sessions` when couple not `active` → forbidden

- [x] **Step 2: Run tests — expect fail**

Run: `cd apps/api && pnpm exec vitest run src/conversations/conversations.service.test.ts`  
Expected: FAIL

- [x] **Step 3: Implement module**

Authorization checklist in service:

- Resolve viewer’s active membership + couple
- Session must belong to that couple
- Only active couple can create sessions
- On create: insert session + empty response rows for each active membership
- On submit: set `body` + `submittedAt` only if `submittedAt` was null
- On reveal: insert reveal row only if both members have `submittedAt`; reject otherwise
- Map responses through `canViewerSeeAnswerText` before returning

Wire controller with `@UseGuards(JwtAuthGuard)` like `CouplesController`.

- [x] **Step 4: Run tests — expect pass**

- [x] **Step 5: Manual smoke with two users** (curl or existing smoke doc style) — create session, submit both, reveal one, confirm redaction

- [x] **Step 6: Stop** — commit only if asked.

---

### Task 5: Web atoms required by session UI

**Files:**

- Add under `apps/web/components/ui/` via project shadcn (Base UI / existing `components.json`): `textarea`, `dialog`, `skeleton` (and `tabs`/`tooltip`/`collapsible` only if you use them in T0 hub/start)

**Interfaces:**

- Produces: importable `@/components/ui/textarea`, `dialog`, `skeleton`, …

- [x] **Step 1: Add only missing primitives** with the repo’s shadcn CLI / established pattern — do **not** copy from `between-us-source`.
- [x] **Step 2: Verify Story-free compile**

Run: `cd apps/web && pnpm exec tsc --noEmit` (or `pnpm lint`)  
Expected: clean for new ui files

- [x] **Step 3: Stop**

---

### Task 6: Web hooks + status labels

**Files:**

- Create: `apps/web/hooks/use-themes.ts`
- Create: `apps/web/hooks/use-sessions.ts`
- Create: `apps/web/lib/session-status-label.ts`

**Interfaces:**

- Consumes: `apiFetch`, Nest DTOs from Task 4
- Produces:
  - `useThemesQuery()`
  - `useSessionsQuery()`
  - `useSessionQuery(id)`
  - `useCreateSessionMutation()`
  - `useSubmitResponseMutation()`
  - `useRevealSessionMutation()`
  - `sessionStatusLabel(phase): string` — e.g. answering → “Your turn”; waiting → “Waiting together”; ready_to_reveal → “Ready to reveal”; revealed → “Revealed”

- [x] **Step 1: Implement hooks** mirroring `hooks/use-couple.ts` (query keys `["themes"]`, `["sessions"]`, `["sessions", id]`; invalidate list+detail on mutations)

Example mutation sketch:

```ts
export function useRevealSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SessionDetailDto>(`/sessions/${id}/reveal`, { method: "POST" }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["sessions"] });
      await qc.setQueryData(["sessions", data.id], data);
    },
  });
}
```

- [x] **Step 2: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`  
Expected: PASS for new hooks (pages may still be missing)

- [x] **Step 3: Stop**

---

### Task 7: Web molecules/organisms for hub + start + session

**Files (create):**

- `apps/web/components/molecules/conversation-status-pill.tsx`
- `apps/web/components/molecules/conversation-card.tsx`
- `apps/web/components/molecules/theme-card.tsx`
- `apps/web/components/molecules/prompt-list-item.tsx`
- `apps/web/components/molecules/session-waiting.tsx`
- `apps/web/components/molecules/session-reveal-button.tsx`
- `apps/web/components/molecules/answer-card.tsx`
- `apps/web/components/molecules/couple-page-skeleton.tsx`
- `apps/web/components/organisms/session-answer-form.tsx`
- `apps/web/components/organisms/session-reveal-panel.tsx`

**Interfaces:**

- Consumes: hooks types, ui atoms, `sessionStatusLabel`
- Produces presentational components with props only (no `apiFetch` inside molecules)

Copy rules:

- CTA on card: “Answer privately” | “View waiting space” | “Reveal” | “View answers” — **never** “Reveal together”
- Waiting copy: answers reveal when **you** choose Reveal after both have submitted
- Visual: use existing tokens (`bg-primary`, `bg-secondary`, etc.); optional `--waiting` only if you add it in a tiny globals tweak

- [ ] **Step 1: Build `SessionAnswerForm`** — lock banner, textarea, confirm Dialog, submit handler via props/`onSubmit`
- [ ] **Step 2: Build waiting + `SessionRevealButton` + `SessionRevealPanel`** — panel renders `AnswerCard`s only when `phase === "revealed"` and texts non-null
- [ ] **Step 3: Build hub list card + start theme/prompt molecules**
- [ ] **Step 4: Lint touched components**
- [ ] **Step 5: Stop**

---

### Task 8: Pages — `/couple` active hub, `/start`, `/conversation/[id]`

**Files:**

- Modify: `apps/web/app/(app)/couple/page.tsx`
- Create: `apps/web/app/(app)/start/page.tsx`
- Create: `apps/web/app/(app)/conversation/[id]/page.tsx`

**Interfaces:**

- Consumes: `useCoupleMeQuery`, session/theme hooks, organisms from Task 7
- Gate: if `couple.status !== "active"`, hide Start / show existing invite UI (full invite-pending visual polish is T1)

- [ ] **Step 1: Active hub on `/couple`**

When `couple.data.status === "active"`:

- Keep members/greeting/welcome as desired
- Add “Start a conversation” → `/start`
- Render `useSessionsQuery` list via `ConversationCard` or empty dashed state
- Remove debug `console.log` if still present

When not active: keep `InvitePartnerForm` (T1 polishes)

Loading: `CouplePageSkeleton` or simple pending text upgraded to skeleton

- [ ] **Step 2: `/start` curated only**

- Back to `/couple`
- Load themes; empty state if none
- Theme select + prompt Start → `useCreateSessionMutation` → `router.push(/conversation/${id})`
- No custom tab in T0 (avoids throwaway instant-start)

- [ ] **Step 3: `/conversation/[id]`**

Branch on `phase` from `useSessionQuery`:

- `answering` → `SessionAnswerForm` (+ partnerSubmitted notice without text)
- `waiting_for_partner` → `SessionWaiting`
- `ready_to_reveal` → `SessionRevealButton`
- `revealed` → `SessionRevealPanel`
- error/404 → unavailable copy + link home

- [ ] **Step 4: Manual two-browser smoke**

1. Active couple, both verified
2. A starts curated session
3. A submits; B sees partnerSubmitted / answering
4. B submits; both see ready_to_reveal
5. A Reveals — A sees both; B still ready_to_reveal without partner text
6. B Reveals — B sees both
7. Hub list phases match

- [ ] **Step 5: Stop** — commit only if asked.

---

## Spec coverage (self-review)


| FR / concern                                    | Task                              |
| ----------------------------------------------- | --------------------------------- |
| FR-01 hub landing                               | 8 (existing auth gate)            |
| FR-05 Start + list                              | 8                                 |
| FR-06–07 curated start                          | 3 seed, 4 GET/POST, 8 `/start`    |
| FR-12–14 answer / wait / partner submitted flag | 4, 7, 8                           |
| FR-15–17 redaction + per-user Reveal            | 2, 4, 7, 8                        |
| FR-18 hub status                                | 2 phase, 6 labels, 7 card, 8 list |
| NFR-05 server redaction                         | 2, 4                              |
| No auto-reveal / no Lovable provider            | Global + Tasks 7–8                |
| T1–T6                                           | Explicitly deferred               |


**Placeholder scan:** clean — migrate commands are `pnpm generate` / `pnpm migrate` in `packages/database`.

**Type consistency:** `SessionViewerPhase` and detail DTO `phase` shared naming across domain → API → web labels.