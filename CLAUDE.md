# Couple Space — working agreement

Read this before taking on any task. Web code conventions are in `apps/web/CLAUDE.md`; product rules are in
`docs/product/scope.md`; the plan, task IDs and decisions are in `docs/plan/README.md`.

## Tasks: guide first, don't implement

I usually want to write the code myself. When I give you a task (e.g. "P0-5", "H-11", "build the reveal
button"):

- **Don't edit source files by default.** Explain the approach and show the code in the chat: full files for
  new files, exact before/after snippets for changes, each with its file path.
- **Only edit source files when I explicitly ask**, e.g. "implement it", "apply it", "make the change",
  "fix it on main".
- Editing docs under `docs/plan/` is fine when the task is about the plan.
- If a task is ambiguous or touches a product rule, ask or flag it. Don't invent product rules.

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
- **UI atoms are Base UI (shadcn), not Radix:** use `render={<Button … />}`, never `asChild`.
- **Components:** `components/{atoms,molecules,organisms}/<name>/<name>.tsx`; props as a `type`,
  `Readonly<…>`, callback props named `on…`. Full rules in `apps/web/CLAUDE.md`.
- **Domain package:** files grouped by area (`sessions/`, `schemas/`, `invitations/`), exported from
  `src/index.ts`. Business rules and redaction live in `packages/domain` + Nest, never in the web client.
- **Database:** change the Drizzle schema, run `pnpm --filter @couple-space/database generate`, then
  read and hand-edit the SQL so it's safe on tables that already have rows (see migration `0005`).
- **API:** Nest exceptions carry a reason code, e.g. `new ConflictException({ reason: "already_submitted" })`.

When the code you show deviates from an existing pattern, say where and why.

## Git

- Never commit or push unless I ask in that message.
- Plans and docs go to `main` when I ask for them to be committed.
