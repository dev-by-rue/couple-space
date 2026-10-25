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
