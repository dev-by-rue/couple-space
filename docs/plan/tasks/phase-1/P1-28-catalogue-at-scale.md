# P1-28 · Catalogue at scale

[← Phase 1](../phase-1-mvp-1.md) · Size **M** · Gate A · Decisions: [Q26](../../03-product-decisions.md#q26), [Q27](../../03-product-decisions.md#q27), [E-13](../../erd/design-review.md#e-13) · After: [P1-8 Step 1](P1-8-follow-ups.md#step-1--database) · Next: [P1-8 Step 2](P1-8-follow-ups.md#step-2--seed)

**Goal:** a prompt catalogue that can grow to thousands of questions without id collisions or one giant
file. Ids come from a hand-written **key** (UUIDv5), not from a question's position. Each theme lives in
its own file. Every question gets a real title, a **depth** and **tags** (Q26). A test guards the rules.

**Done when:**

- `prompts.key` (unique), `prompts.depth` (`light` | `medium` | `deep`), and the `prompt_tags` and
  `prompt_tag_links` tables exist. The migration resets the old catalogue first (E-13).
- `seed/catalogue.data.ts` is replaced by `seed/catalogue/`: `ids.ts`, `types.ts`, `tags.ts`, one file
  per theme under `themes/`, and `index.ts` that builds the rows.
- Theme, prompt and tag ids are `uuidv5` of `theme:<slug>`, `prompt:<key>` and `tag:<slug>`.
- `pnpm --filter @couple-space/database test` passes: known UUIDv5 vector, unique ids/keys/slugs, key
  format, no duplicate tags on a question.
- `seed` logs `seeded 6 themes, 18 prompts, 6 tags`.

### Where this sits

Between P1-8 Step 1 (schema) and P1-8 Step 2 (follow-ups in the seed). The "before" code below assumes
Step 1 is applied. If Step 1's migration hasn't been deployed yet, delete it and let this guide's
`generate` produce **one** migration for both (see Migration).

### Decisions and deviations to flag

- **The migration deletes every session and the whole catalogue** (E-13). That's fine only because there
  are no real users yet. After Gate A this pattern is never used again: retire, don't delete (Q14).
- **New tables seeded from code** (`prompt_tags`, `prompt_tag_links`). Same pattern as `prompt_themes`:
  content lives in the repo and the seed upserts it on every deploy. Links are owned by the seed, so it
  deletes and re-inserts them on each run.
- **Depth values are written twice:** the `Depth` type in `seed/catalogue/types.ts` and the check
  constraint in `prompts.ts`. This matches how P1-7 handles `decline_reason`. When P1-30 adds depth
  filters, the list also goes into `packages/domain` (`PROMPT_DEPTHS`).
- **The tag list is a draft** (`seed/catalogue/tags.ts`). Q26 holds back a "naughty"/sexual tag until
  its opt-in rules are decided.
- **Titles, keys, depths and tags on the existing 18 questions are drafts.** Change them freely until
  Gate A. After that a key is permanent (E-13).
- **`key` and `depth` are nullable in the database**, but a check makes them required for `curated` and
  `follow_up` rows. MVP-2 puts custom and partner-added prompts in the same table (P2-2, P2-7), and those
  have no key and may have no depth. A `NOT NULL` now would mean a migration on live data later.
- **`vitest` added to `packages/database`.** Same version and config as `packages/domain`.

---

## Step 1 · Schema

### `packages/database/src/schema/prompts.ts` (change)

**Before** (after P1-8 Step 1)
```ts
import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { promptThemes } from "./prompt-themes.js";

export const prompts = pgTable("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  themeId: uuid("theme_id")
    .notNull()
    .references(() => promptThemes.id),
  parentPromptId: uuid("parent_prompt_id").references(
    (): AnyPgColumn => prompts.id,
  ),
  title: text("title").notNull(),
  description: text("description").notNull(),
  text: text("text").notNull(),
  kind: text("kind").notNull().default("curated"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
});
```
**After**
```ts
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { promptThemes } from "./prompt-themes.js";

export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Permanent, hand-written key the id is derived from (E-13). Never changed or reused.
     * Null for couple-written prompts (MVP-2).
     */
    key: text("key").unique(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => promptThemes.id),
    /** Set for kind = 'follow_up': the curated prompt this follows. One level only (E-12). */
    parentPromptId: uuid("parent_prompt_id").references(
      (): AnyPgColumn => prompts.id,
    ),
    title: text("title").notNull(),
    description: text("description").notNull(),
    text: text("text").notNull(),
    kind: text("kind").notNull().default("curated"),
    /** How heavy the question is (Q26). Follow-ups take their parent's depth. */
    depth: text("depth"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "prompts_depth_preset",
      sql`${t.depth} is null or ${t.depth} in ('light', 'medium', 'deep')`,
    ),
    // Catalogue prompts always have a key and a depth; couple-written ones (MVP-2) may not.
    check(
      "prompts_catalogue_key_depth",
      sql`${t.kind} not in ('curated', 'follow_up') or (${t.key} is not null and ${t.depth} is not null)`,
    ),
  ],
);
```

### `packages/database/src/schema/prompt-tags.ts` (new)
```ts
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { prompts } from "./prompts.js";

/** Tags couples can filter prompts by (Q26). Seeded from `seed/catalogue/tags.ts`. */
export const promptTags = pgTable("prompt_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Which tags a prompt has. Owned by the seed: deleted and re-inserted on every run. */
export const promptTagLinks = pgTable(
  "prompt_tag_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => promptTags.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("prompt_tag_links_prompt_tag_unique").on(t.promptId, t.tagId),
    index("prompt_tag_links_tag_id_idx").on(t.tagId),
  ],
);
```

### `packages/database/src/schema/index.ts` (change)
**Before**
```ts
export * from "./prompts.js";
```
**After**
```ts
export * from "./prompts.js";
export * from "./prompt-tags.js";
```

### Migration

Do these in order. You only **create and edit** the migration here; it runs in the Verification step,
once the catalogue files exist (seeding before then would fail the new check constraint).

1. **Only if P1-8 Step 1 has its own migration that was never deployed:** delete its `.sql`, its
   `meta/<n>_snapshot.json`, and its entry in `meta/_journal.json`. One `generate` will then cover both
   tasks.
2. Run `pnpm --filter @couple-space/database generate`. It creates `packages/database/drizzle/0010_<name>.sql`.
3. **Open that file and paste this at the very top**, above the first `CREATE TABLE`, then save:

   ```sql
   -- One-off reset before Gate A (E-13): ids now come from keys, so the old
   -- catalogue and every session on it go. Never copy this after Gate A.
   DELETE FROM "session_reveals";--> statement-breakpoint
   DELETE FROM "session_responses";--> statement-breakpoint
   DELETE FROM "conversation_sessions";--> statement-breakpoint
   DELETE FROM "prompts";--> statement-breakpoint
   DELETE FROM "prompt_themes";--> statement-breakpoint
   ```

4. Read the rest of the file. Expect two `CREATE TABLE`s (`prompt_tags`, `prompt_tag_links`); four
   nullable `ADD COLUMN`s (`key`, `depth`, and `parent_prompt_id` / `parent_session_id` from P1-8 Step 1);
   FKs; indexes; `prompts_key_unique`; and the two checks. Nothing else needs editing.
5. **Don't run `migrate` yet.** Carry on with Step 2.

**When the reset runs:** automatically, the first time `migrate` applies this file. Locally that's
Verification step 1. On Railway it's the first deploy after this reaches `main` (`preDeployCommand` runs
`migrate`, then `seed`). Drizzle applies each file once, so it never runs again.

**Why it's needed:** ids now come from keys, so the old rows would stay behind with no key under ids
nothing uses, and the new theme ids would clash with them on `prompt_themes.slug`. One `DELETE` per table
removes parents and children together, so the self-references from P1-8 Step 1 don't get in the way
(Postgres checks those FKs at the end of each statement). Users, couples and invitations are untouched.

---

## Step 2 · Catalogue files

Delete `packages/database/seed/catalogue.data.ts`. Its content moves into the files below.

### `packages/database/seed/catalogue/ids.ts` (new)
```ts
import { createHash } from "node:crypto";

/**
 * Namespace for every catalogue id. Changing it changes every id, so never edit it.
 */
const NAMESPACE = "bd363184-b8e8-44c6-a8aa-bc9107f19cfc";

/**
 * Builds a name-based UUID (RFC 9562 version 5).
 *
 * @remarks
 * The same name and namespace always give the same id, which is what keeps
 * catalogue ids stable across deploys without storing them by hand.
 *
 * @param name - The text the id is derived from.
 * @param namespace - A UUID that scopes the name.
 * @returns The UUID string.
 */
export function uuidv5(name: string, namespace: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(name, "utf8")
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Id for a theme.
 *
 * @remarks The prefix keeps theme, prompt and tag ids apart even if a slug and a key match.
 * @returns The theme's UUID.
 */
export const themeId = (slug: string) => uuidv5(`theme:${slug}`, NAMESPACE);

/**
 * Id for a curated prompt.
 *
 * @returns The prompt's UUID.
 */
export const promptId = (key: string) => uuidv5(`prompt:${key}`, NAMESPACE);

/**
 * Id for a tag.
 *
 * @returns The tag's UUID.
 */
export const tagId = (slug: string) => uuidv5(`tag:${slug}`, NAMESPACE);
```

### `packages/database/seed/catalogue/tags.ts` (new)
```ts
/**
 * Tags couples can filter by (Q26). Draft list.
 *
 * Slugs are permanent once live: add new tags at the end, never rename a slug.
 * Labels can change. The order here is the order the filters show in.
 */
export const TAGS = [
  { slug: "playful", label: "Playful" },
  { slug: "thoughtful", label: "Thoughtful" },
  { slug: "romantic", label: "Romantic" },
  { slug: "practical", label: "Practical" },
  { slug: "nostalgic", label: "Nostalgic" },
  { slug: "hopeful", label: "Hopeful" },
] as const;

export type TagSlug = (typeof TAGS)[number]["slug"];
```

### `packages/database/seed/catalogue/types.ts` (new)
```ts
import type { TagSlug } from "./tags.js";

/** Keep in step with the `prompts_depth_preset` check in `src/schema/prompts.ts`. */
export type Depth = "light" | "medium" | "deep";

/**
 * One curated question.
 *
 * `key` is permanent: never change or reuse it (E-13). To reword a question,
 * set `retired: true` and add the new wording with a new key (Q13).
 */
export type QuestionSeed = {
  /** kebab-case, unique across the whole catalogue. */
  key: string;
  /** Shown on the hub card and the session header. */
  title: string;
  text: string;
  depth: Depth;
  tags: TagSlug[];
  retired?: true;
};

/**
 * A theme and its questions. The slug is permanent (the theme id comes from it).
 * Questions can be reordered freely: ids don't depend on position.
 */
export type ThemeSeed = {
  slug: string;
  title: string;
  description: string;
  /** A key of `THEME_ICONS` in apps/web. */
  symbol: string;
  questions: QuestionSeed[];
};
```

### `packages/database/seed/catalogue/themes/everyday-moments.ts` (new)
```ts
import type { ThemeSeed } from "../types.js";

export const everydayMoments: ThemeSeed = {
  slug: "everyday-moments",
  title: "Everyday moments",
  description: "Notice the small things that shape your days.",
  symbol: "coffee",
  questions: [
    {
      key: "small-moment-this-week",
      title: "A moment that stayed",
      text: "What small moment with me has stayed with you this week?",
      depth: "light",
      tags: ["thoughtful"],
    },
    {
      key: "most-at-ease-everyday",
      title: "Most at ease",
      text: "When do you feel most at ease in our everyday life?",
      depth: "light",
      tags: ["thoughtful"],
    },
    {
      key: "ritual-more-time-for",
      title: "A ritual to keep",
      text: "What ordinary ritual would you love us to make more time for?",
      depth: "light",
      tags: ["practical"],
    },
  ],
};
```

### `packages/database/seed/catalogue/themes/us-lately.ts` (new)
```ts
import type { ThemeSeed } from "../types.js";

export const usLately: ThemeSeed = {
  slug: "us-lately",
  title: "Us, lately",
  description: "Make room for what has been present recently.",
  symbol: "calendar-heart",
  questions: [
    {
      key: "doing-well-lately",
      title: "What we're doing well",
      text: "What do you think we have been doing well lately?",
      depth: "light",
      tags: ["thoughtful"],
    },
    {
      key: "gentler-with-each-other",
      title: "A little gentler",
      text: "Where could we be a little gentler with each other?",
      depth: "medium",
      tags: ["thoughtful"],
    },
    {
      key: "different-between-us-recently",
      title: "Something has shifted",
      text: "What has felt different between us recently?",
      depth: "medium",
      tags: ["thoughtful"],
    },
  ],
};
```

### `packages/database/seed/catalogue/themes/dreams-plans.ts` (new)
```ts
import type { ThemeSeed } from "../types.js";

export const dreamsPlans: ThemeSeed = {
  slug: "dreams-plans",
  title: "Dreams & plans",
  description: "Looking ahead together, without pressure.",
  symbol: "compass",
  questions: [
    {
      key: "good-year-together",
      title: "A good year",
      text: "What would a good year together feel like, beyond the milestones?",
      depth: "light",
      tags: ["hopeful"],
    },
    {
      key: "unspoken-hope",
      title: "An unspoken hope",
      text: "What is one hope you have not said out loud lately?",
      depth: "medium",
      tags: ["hopeful"],
    },
    {
      key: "more-spacious-life",
      title: "Room to breathe",
      text: "Where would you like our life to feel more spacious?",
      depth: "medium",
      tags: ["hopeful", "practical"],
    },
  ],
};
```

### `packages/database/seed/catalogue/themes/knowing-you.ts` (new)
```ts
import type { ThemeSeed } from "../types.js";

export const knowingYou: ThemeSeed = {
  slug: "knowing-you",
  title: "Knowing you",
  description: "Stay curious about the person beside you.",
  symbol: "message-circle-heart",
  questions: [
    {
      key: "wish-i-understood",
      title: "Understood more fully",
      text: "What is something you wish I understood more fully about you?",
      depth: "deep",
      tags: ["thoughtful"],
    },
    {
      key: "bringing-you-energy",
      title: "What gives you energy",
      text: "What has been bringing you energy lately?",
      depth: "light",
      tags: ["thoughtful"],
    },
    {
      key: "growing-into",
      title: "Who you're becoming",
      text: "What part of yourself are you growing into?",
      depth: "medium",
      tags: ["thoughtful", "hopeful"],
    },
  ],
};
```

### `packages/database/seed/catalogue/themes/money-home.ts` (new)
```ts
import type { ThemeSeed } from "../types.js";

export const moneyHome: ThemeSeed = {
  slug: "money-home",
  title: "Money & home",
  description: "Talk gently about the life you share.",
  symbol: "house",
  questions: [
    {
      key: "calmer-home",
      title: "A calmer home",
      text: "What would make home feel calmer for both of us?",
      depth: "light",
      tags: ["practical"],
    },
    {
      key: "feeling-secure-together",
      title: "Feeling secure",
      text: "What does feeling secure together mean to you?",
      depth: "medium",
      tags: ["practical", "thoughtful"],
    },
    {
      key: "balanced-responsibility",
      title: "Sharing the load",
      text: "What shared responsibility could feel more balanced?",
      depth: "medium",
      tags: ["practical"],
    },
  ],
};
```

### `packages/database/seed/catalogue/themes/gratitude.ts` (new)
```ts
import type { ThemeSeed } from "../types.js";

export const gratitude: ThemeSeed = {
  slug: "gratitude",
  title: "Gratitude",
  description: "Share what you have quietly appreciated.",
  symbol: "hand-heart",
  questions: [
    {
      key: "felt-cared-for",
      title: "Feeling cared for",
      text: "What is something I did recently that made you feel cared for?",
      depth: "light",
      tags: ["romantic"],
    },
    {
      key: "grateful-for-today",
      title: "Grateful today",
      text: "What part of our relationship are you especially grateful for today?",
      depth: "light",
      tags: ["romantic", "thoughtful"],
    },
    {
      key: "quality-noticed-anew",
      title: "Noticed anew",
      text: "What quality in me have you noticed anew?",
      depth: "light",
      tags: ["romantic"],
    },
  ],
};
```

### `packages/database/seed/catalogue/index.ts` (new)
```ts
import type {
  promptTagLinks,
  promptTags,
  promptThemes,
  prompts,
} from "../../src/schema/index.js";
import { promptId, tagId, themeId } from "./ids.js";
import { TAGS } from "./tags.js";
import type { ThemeSeed } from "./types.js";
import { dreamsPlans } from "./themes/dreams-plans.js";
import { everydayMoments } from "./themes/everyday-moments.js";
import { gratitude } from "./themes/gratitude.js";
import { knowingYou } from "./themes/knowing-you.js";
import { moneyHome } from "./themes/money-home.js";
import { usLately } from "./themes/us-lately.js";

type ThemeRow = typeof promptThemes.$inferInsert;
type PromptRow = typeof prompts.$inferInsert;
type TagRow = typeof promptTags.$inferInsert;
type PromptTagLinkRow = typeof promptTagLinks.$inferInsert;

/** Every theme, in the order `/start` shows them. Add a new theme by adding its file here. */
export const catalogue: ThemeSeed[] = [
  everydayMoments,
  usLately,
  dreamsPlans,
  knowingYou,
  moneyHome,
  gratitude,
];

export const themeRows: ThemeRow[] = catalogue.map((theme, index) => ({
  id: themeId(theme.slug),
  title: theme.title,
  slug: theme.slug,
  description: theme.description,
  symbol: theme.symbol,
  sortOrder: index,
}));

export const promptRows: PromptRow[] = catalogue.flatMap((theme) =>
  theme.questions.map((question, index) => ({
    id: promptId(question.key),
    key: question.key,
    themeId: themeId(theme.slug),
    title: question.title,
    description: "A quiet question to answer in your own words.",
    text: question.text,
    kind: "curated",
    depth: question.depth,
    sortOrder: index,
    retiredAt: question.retired ? new Date() : null,
  })),
);

export const tagRows: TagRow[] = TAGS.map((tag, index) => ({
  id: tagId(tag.slug),
  slug: tag.slug,
  label: tag.label,
  sortOrder: index,
}));

export const promptTagLinkRows: PromptTagLinkRow[] = catalogue.flatMap(
  (theme) =>
    theme.questions.flatMap((question) =>
      question.tags.map((slug) => ({
        promptId: promptId(question.key),
        tagId: tagId(slug),
      })),
    ),
);
```

---

## Step 3 · Seed

### `packages/database/seed/catalogue.seed.ts` (change)

**Before**
```ts
import { promptThemes, prompts } from "../src/schema/index.js";
import { themeRows, promptRows } from "./catalogue.data.js";
```
**After**
```ts
import {
  promptTagLinks,
  promptTags,
  promptThemes,
  prompts,
} from "../src/schema/index.js";
import {
  promptRows,
  promptTagLinkRows,
  tagRows,
  themeRows,
} from "./catalogue/index.js";
```

**Before** (prompts upsert `set`)
```ts
      set: {
        themeId: sql`excluded.theme_id`,
```
**After**
```ts
      set: {
        key: sql`excluded.key`,
        themeId: sql`excluded.theme_id`,
        depth: sql`excluded.depth`,
```

**Before** (end of the transaction)
```ts
        updatedAt: new Date(),
      },
    });
});

console.log(`seeded ${themeRows.length} themes, ${promptRows.length} prompts`);
```
**After**
```ts
        updatedAt: new Date(),
      },
    });

  await tx
    .insert(promptTags)
    .values(tagRows)
    .onConflictDoUpdate({
      target: promptTags.id,
      set: {
        slug: sql`excluded.slug`,
        label: sql`excluded.label`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: new Date(),
      },
    });

  // The seed owns every link, so replace them all: removing a tag from a question just works.
  await tx.delete(promptTagLinks);
  if (promptTagLinkRows.length > 0) {
    await tx.insert(promptTagLinks).values(promptTagLinkRows);
  }
});

console.log(
  `seeded ${themeRows.length} themes, ${promptRows.length} prompts, ${tagRows.length} tags`,
);
```

---

## Step 4 · Tests

### `packages/database/package.json` (change)
**Before**
```json
    "seed": "tsx seed/catalogue.seed.ts",
    "clear-sessions": "tsx seed/clear-sessions.ts"
  },
```
**After**
```json
    "seed": "tsx seed/catalogue.seed.ts",
    "clear-sessions": "tsx seed/clear-sessions.ts",
    "test": "vitest run"
  },
```
and add `"vitest": "^3"` to `devDependencies`, then `pnpm install`.

### `packages/database/vitest.config.ts` (new, same as `packages/domain`)
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
  },
});
```

### `packages/database/seed/catalogue/catalogue.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { promptId, uuidv5 } from "./ids.js";
import {
  catalogue,
  promptRows,
  promptTagLinkRows,
  tagRows,
  themeRows,
} from "./index.js";

const KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lists the values that appear more than once.
 *
 * @returns The duplicates, empty when every value is unique.
 */
function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("uuidv5", () => {
  it("matches the RFC example for the DNS namespace", () => {
    expect(
      uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
    ).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("never changes for an existing key", () => {
    // Fails if NAMESPACE or the "prompt:" prefix is edited, which would move every id.
    expect(promptId("small-moment-this-week")).toBe(
      "385fd7a4-5b33-5887-895d-03050a7af12d",
    );
  });
});

describe("catalogue", () => {
  it("has unique ids across themes, prompts and tags", () => {
    const ids = [...themeRows, ...promptRows, ...tagRows].map((r) => r.id!);
    expect(duplicates(ids)).toEqual([]);
  });

  it("has unique theme slugs and prompt keys", () => {
    expect(duplicates(catalogue.map((t) => t.slug))).toEqual([]);
    expect(duplicates(promptRows.map((p) => p.key!))).toEqual([]);
  });

  it("uses kebab-case keys and slugs", () => {
    for (const theme of catalogue) {
      expect(theme.slug).toMatch(KEY_FORMAT);
      for (const question of theme.questions) {
        expect(question.key).toMatch(KEY_FORMAT);
      }
    }
  });

  it("has a title and text on every question", () => {
    for (const prompt of promptRows) {
      expect(prompt.title.trim()).not.toBe("");
      expect(prompt.text.trim()).not.toBe("");
    }
  });

  it("never tags a question twice with the same tag", () => {
    const pairs = promptTagLinkRows.map((l) => `${l.promptId}:${l.tagId}`);
    expect(duplicates(pairs)).toEqual([]);
  });
});
```

Tags are type-checked (`TagSlug`) and depths too (`Depth`), so the test doesn't repeat those checks.

---

## Verification

1. `pnpm --filter @couple-space/database migrate` (this runs the reset you pasted into `0010`), then
   `pnpm --filter @couple-space/database seed` → `seeded 6 themes, 18 prompts, 6 tags`.
2. `pnpm --filter @couple-space/database test` and `pnpm check-types`.
3. `/start` lists the six themes with the new titles; starting a conversation still works.
4. In the database, `select key, depth from prompts` shows keys and depths, and `prompt_tag_links`
   has 22 rows.
5. Rename a title in a theme file, seed again: the same prompt id now has the new title.
