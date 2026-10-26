# Couple Space — working agreement

Read this before taking on any task. Web code conventions are in `apps/web/CLAUDE.md`; product rules are in
`docs/product/scope.md` (the reasons in `docs/product/decisions.md`); every open task, its order and gate are
in `docs/plan/board.md`. Stack and engineering rules: `docs/engineering/README.md`.

## Tasks: guide first, don't implement

I usually want to write the code myself. When I give you a task (e.g. "P0-5", "H-11", "build the reveal
button"):

- **Don't edit source files by default.** Explain the approach and show the code in the chat: full files for
  new files, exact before/after snippets for changes, each with its file path.
- **Only edit source files when I explicitly ask**, e.g. "implement it", "apply it", "make the change",
  "fix it on main".
- Editing docs under `docs/plan/` and `docs/product/` is fine when the task is about the plan.
- If a task is ambiguous or touches a product rule, ask or flag it. Don't invent product rules.
- When reviewing the tasks always ask if I want the code instead of the instruction, code must include tests where necessary.

## Docs: keep them small

The docs once outgrew the code (84 files, ~29k lines), so they follow these rules:

- **One home per kind of information:** rules in `scope.md`, reasons in `decisions.md` (append dated
  *Amended* / *Overruled* lines, don't rewrite), future ideas in `roadmap.md`, tasks and order in `board.md`.
  Don't repeat a rule in a second file; link to it.
- **Guides** live in `docs/plan/guides/<task-id>-<slug>.md`, with full before/after code and tests.
  A guide exists only until its task merges: **then delete it** and tick the task on the board.
- **No new doc files** (specs, checklists, close-out lists, ERD diagrams) without asking. Put a task's
  checklist in its guide, a decision in `decisions.md`, the schema in `packages/database/src/schema`.
- When a decision changes, update `scope.md`, add the line in `decisions.md`, and fix only the guides
  that are still live.

## Match the existing patterns

Before writing any code, read the closest existing implementation and follow it. Don't introduce a new
pattern, library or folder structure without saying so and asking first. Current patterns:

- **Forms:** React Hook Form + `zodResolver`, with the schema in `@couple-space/domain` (shared with the
  API DTO) and the `Field` components from `components/ui/field`. See `components/auth/register.form.tsx`
  and `components/organisms/session-answer-form/`.
- **Minimise `useState` / `useEffect`.** Prefer RHF state, React Query state, uncontrolled Base UI
  components and event handlers. If one is genuinely needed, say why.
- **No `try/catch` in form submit handlers.** Call the mutation with `mutate` and pass `isPending` /
  `isError` down as props.
- **Data:** React Query hooks in `apps/web/hooks/`, calling `apiFetch` from `lib/api.ts`. Components
  don't call `apiFetch` directly.
- **Components:** `components/{atoms,molecules,organisms}/<name>/<name>.tsx`; props as a `type`,
  `Readonly<…>`, callback props named `on…`. Full rules in `apps/web/CLAUDE.md`.
- **Domain package:** files grouped by area (`sessions/`, `schemas/`, `invitations/`), exported from
  `src/index.ts`. Business rules and redaction live in `packages/domain` + Nest, never in the web client.
- **Database:** change the Drizzle schema, run `pnpm --filter @couple-space/database generate`, then
  read and hand-edit the SQL so it's safe on tables that already have rows (see migration `0005`).
- **API:** Nest exceptions carry a reason code, e.g. `new ConflictException({ reason: "already_submitted" })`.
- **CODE COMMENTS** Should follow the tsdoc files where necessary, functions should include a description, @remark, @params (if present and not obvious by the type/interface) and a @return at all times.

When the code you show deviates from an existing pattern, say where and why.

## Git

- Never commit or push unless I ask in that message.
- Plans and docs go to `main` when I ask for them to be committed.
