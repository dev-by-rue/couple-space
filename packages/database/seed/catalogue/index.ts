import type {
  promptTagLinks,
  promptTags,
  promptThemes,
  prompts,
} from "../../src/schema/index.js";
import { followUpId, promptId, tagId, themeId } from "./ids.js";
import { TAGS } from "./tags.js";
import type { ThemeSeed } from "./types.js";
import { dreamsPlans } from "./themes/dreams-plans.js";
import { everydayMoments } from "./themes/everyday-moments.js";
import { gratitude } from "./themes/gratitude.js";
import { knowingYou } from "./themes/knowing-you.js";
import { moneyHome } from "./themes/money-home.js";
import { usLately } from "./themes/us-lately.js";
import { littleTraditions } from "./themes/little-traditions.js";
import { noExplainingNeeded } from "./themes/no-explaining-needed.js";
import { sayItSoftly } from "./themes/say-it-softly.js";
import { yourKindOfCare } from "./themes/your-kind-of-care.js";

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
  yourKindOfCare,
  littleTraditions,
  sayItSoftly,
  noExplainingNeeded,
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
  theme.questions.flatMap((question, index) => {
    const retiredAt = question.retired ? new Date() : null;

    const curated: PromptRow = {
      id: promptId(question.key),
      key: question.key,
      themeId: themeId(theme.slug),
      parentPromptId: null,
      title: question.title,
      description: "A quiet question to answer in your own words.",
      text: question.text,
      kind: "curated",
      depth: question.depth,
      sortOrder: index,
      retiredAt,
    };

    const followUps: PromptRow[] = (question.followUps ?? []).map(
      (text, k) => ({
        id: followUpId(question.key, k + 1),
        key: `${question.key}/${k + 1}`,
        themeId: themeId(theme.slug),
        parentPromptId: curated.id,
        title: `${question.title} · follow-up ${k + 1}`,
        description: "A follow-up to talk through together.",
        text,
        kind: "follow_up",
        depth: question.depth,
        sortOrder: k,
        retiredAt,
      }),
    );

    return [curated, ...followUps];
  }),
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
