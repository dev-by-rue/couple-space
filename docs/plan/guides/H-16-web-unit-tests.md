# H-16 · Web unit tests (`lib/` only)

[← Housekeeping](../board.md) · Size **S** · Before: [P1-6](P1-6-session-completion.md) · Next: [P1-6](P1-6-session-completion.md)

**Goal:** `apps/web` gets a test runner, so every guide from P1-6 on can ship web tests. This is the
smallest useful slice: **Vitest, Node environment, pure helpers in `lib/` only.** Component tests (a DOM
environment, Testing Library) and the Playwright reveal flow stay in [H-10](../board.md).

**Done when:**

- `pnpm --filter @couple-space/web test` runs Vitest, and `pnpm test` at the root includes the web.
- `lib/session-sort.test.ts` and `lib/prompt-filters.test.ts` pass (13 tests).
- `pnpm check-types` and `pnpm lint` stay green.

### Notes

- **Same runner as the rest of the repo.** `packages/domain` and `packages/database` use Vitest 3, so
  the web uses `^3` too: it's already in the lockfile and nothing new is downloaded.
- **No `globals`.** Tests import `describe`/`it`/`expect` from `vitest`, as the domain tests do, so
  `tsc` needs no extra types.
- **The `@/` alias** has to be repeated in `vitest.config.ts`, because Vitest doesn't read `tsconfig`
  `paths`. A plugin (`vite-tsconfig-paths`) could do it, but that's another dependency for one line.
- **Imports from `@couple-space/domain`** resolve to its built `dist/`. `turbo run test` already builds
  dependencies first (`dependsOn: ["^build"]`). If you run Vitest directly in `apps/web`, run
  `pnpm --filter @couple-space/domain build` once first.
- **`include: ["lib/**/*.test.ts"]`** keeps this slice honest: a component test dropped in by accident
  won't run in a Node environment and fail confusingly.

Checked on a scratch copy of `main` @ `11e738c`: install, 13 tests passing, `check-types` and `lint` clean.

---

## Step 1 · Install

```bash
pnpm --filter @couple-space/web add -D vitest@^3
```

### `apps/web/package.json` (change)
**Before**
```json
    "lint": "eslint",
    "check-types": "next typegen && tsc --noEmit -p tsconfig.json"
  },
```
**After**
```json
    "lint": "eslint",
    "check-types": "next typegen && tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
```
The `add` command puts `"vitest": "^3"` in `devDependencies` and updates `pnpm-lock.yaml`.

### `apps/web/vitest.config.ts` (new)
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same `@/` alias as tsconfig.json `paths`.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // H-16: pure helpers only. Component tests need a DOM environment (H-10).
    include: ["lib/**/*.test.ts"],
    passWithNoTests: true,
  },
});
```

---

## Step 2 · Tests for the existing helpers

### `apps/web/lib/session-sort.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import type { SessionListItem } from "@/hooks/use-sessions";
import { sortSessionsByPriority } from "./session-sort";

function session(
  id: string,
  phase: SessionListItem["phase"],
  updatedAt: string,
): SessionListItem {
  return { id, promptTitle: id, promptText: id, phase, updatedAt };
}

describe("sortSessionsByPriority", () => {
  it("puts the sessions that need the viewer first", () => {
    const sorted = sortSessionsByPriority([
      session("revealed", "revealed", "2026-10-26T10:00:00.000Z"),
      session("waiting", "waiting_for_partner", "2026-10-26T10:00:00.000Z"),
      session("ready", "ready_to_reveal", "2026-10-26T10:00:00.000Z"),
      session("answering", "answering", "2026-10-26T10:00:00.000Z"),
    ]);

    expect(sorted.map((s) => s.id)).toEqual([
      "answering",
      "ready",
      "waiting",
      "revealed",
    ]);
  });

  it("breaks ties newest first", () => {
    const sorted = sortSessionsByPriority([
      session("old", "answering", "2026-10-01T10:00:00.000Z"),
      session("new", "answering", "2026-10-26T10:00:00.000Z"),
    ]);

    expect(sorted.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("doesn't mutate the input (React Query's cache)", () => {
    const input = [
      session("revealed", "revealed", "2026-10-26T10:00:00.000Z"),
      session("answering", "answering", "2026-10-26T10:00:00.000Z"),
    ];
    sortSessionsByPriority(input);

    expect(input.map((s) => s.id)).toEqual(["revealed", "answering"]);
  });
});
```
P1-6 adds `status` to `SessionListItem`; its guide updates the `session()` helper here.

### `apps/web/lib/prompt-filters.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import {
  filterPrompts,
  PROMPT_PAGE_SIZE,
  promptFiltersHref,
  readPromptFilters,
  toggleDepth,
  toggleTag,
  type PromptFilters,
} from "./prompt-filters";

const none: PromptFilters = { depth: null, tags: [], show: PROMPT_PAGE_SIZE };

describe("readPromptFilters", () => {
  it("reads depth, known tags and show", () => {
    const params = new URLSearchParams(
      "depth=deep&tag=playful&tag=nope&show=12",
    );

    expect(readPromptFilters(params, ["playful", "romantic"])).toEqual({
      depth: "deep",
      tags: ["playful"],
      show: 12,
    });
  });

  it("ignores an unknown depth and a bad show", () => {
    const params = new URLSearchParams("depth=very&show=abc");

    expect(readPromptFilters(params, [])).toEqual(none);
  });

  it("never shows fewer than one page", () => {
    expect(readPromptFilters(new URLSearchParams("show=2"), []).show).toBe(
      PROMPT_PAGE_SIZE,
    );
  });
});

describe("filterPrompts", () => {
  const prompts = [
    { id: "a", depth: "light" as const, tags: ["playful"] },
    { id: "b", depth: "deep" as const, tags: ["romantic"] },
    { id: "c", depth: "deep" as const, tags: [] },
  ];

  it("keeps everything with no filters", () => {
    expect(filterPrompts(prompts, none).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("matches one depth", () => {
    expect(
      filterPrompts(prompts, { depth: "deep", tags: [] }).map((p) => p.id),
    ).toEqual(["b", "c"]);
  });

  it("matches any selected tag", () => {
    expect(
      filterPrompts(prompts, {
        depth: null,
        tags: ["playful", "romantic"],
      }).map((p) => p.id),
    ).toEqual(["a", "b"]);
  });
});

describe("promptFiltersHref", () => {
  it("is just the pathname with no filters", () => {
    expect(promptFiltersHref("/start/x", none)).toBe("/start/x");
  });

  it("encodes depth, tags and show", () => {
    expect(
      promptFiltersHref("/start/x", {
        depth: "light",
        tags: ["a", "b"],
        show: 12,
      }),
    ).toBe("/start/x?depth=light&tag=a&tag=b&show=12");
  });
});

describe("toggleDepth and toggleTag", () => {
  it("selects, then clears, a depth and resets show", () => {
    const on = toggleDepth({ ...none, show: 18 }, "medium");
    expect(on).toEqual({ depth: "medium", tags: [], show: PROMPT_PAGE_SIZE });
    expect(toggleDepth(on, "medium").depth).toBeNull();
  });

  it("adds, then removes, a tag and resets show", () => {
    const on = toggleTag({ ...none, show: 18 }, "playful");
    expect(on).toEqual({
      depth: null,
      tags: ["playful"],
      show: PROMPT_PAGE_SIZE,
    });
    expect(toggleTag(on, "playful").tags).toEqual([]);
  });
});
```
P1-32 adds the "Show talked about" filter here; its guide extends these tests.

---

## Verification
1. `pnpm --filter @couple-space/web test` → 2 files, 13 tests passing.
2. `pnpm test` at the root runs the web tests alongside the other packages.
3. `pnpm check-types && pnpm lint` stay green (the test files are type-checked with the rest of the app).
4. If P1-17 (CI) is in place, nothing to change: it already runs `turbo run test`.
