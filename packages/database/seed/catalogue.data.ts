import type { promptThemes, prompts } from "../src/schema/index.js";

type ThemeRow = typeof promptThemes.$inferInsert;
type PromptRow = typeof prompts.$inferInsert;

const id = (n: number) =>
  `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type ThemeSeed = {
  n: number;
  title: string;
  description: string;
  symbol: string;
  questions: string[];
};

const catalogue: ThemeSeed[] = [
  {
    n: 1,
    title: "Everyday moments",
    description: "Notice the small things that shape your days.",
    symbol: "coffee",
    questions: [
      "What small moment with me has stayed with you this week?",
      "When do you feel most at ease in our everyday life?",
      "What ordinary ritual would you love us to make more time for?",
    ],
  },
  {
    n: 2,
    title: "Us, lately",
    description: "Make room for what has been present recently.",
    symbol: "calendar-heart",
    questions: [
      "What do you think we have been doing well lately?",
      "Where could we be a little gentler with each other?",
      "What has felt different between us recently?",
    ],
  },
  {
    n: 3,
    title: "Dreams & plans",
    description: "Looking ahead together, without pressure.",
    symbol: "compass",
    questions: [
      "What would a good year together feel like, beyond the milestones?",
      "What is one hope you have not said out loud lately?",
      "Where would you like our life to feel more spacious?",
    ],
  },
  {
    n: 4,
    title: "Knowing you",
    description: "Stay curious about the person beside you.",
    symbol: "message-circle-heart",
    questions: [
      "What is something you wish I understood more fully about you?",
      "What has been bringing you energy lately?",
      "What part of yourself are you growing into?",
    ],
  },
  {
    n: 5,
    title: "Money & home",
    description: "Talk gently about the life you share.",
    symbol: "house",
    questions: [
      "What would make home feel calmer for both of us?",
      "What does feeling secure together mean to you?",
      "What shared responsibility could feel more balanced?",
    ],
  },
  {
    n: 6,
    title: "Gratitude",
    description: "Share what you have quietly appreciated.",
    symbol: "hand-heart",
    questions: [
      "What is something I did recently that made you feel cared for?",
      "What part of our relationship are you especially grateful for today?",
      "What quality in me have you noticed anew?",
    ],
  },
];

export const themeRows: ThemeRow[] = catalogue.map((theme, index) => ({
  id: id(theme.n),
  title: theme.title,
  description: theme.description,
  symbol: theme.symbol,
  sortOrder: index,
}));

export const promptRows: PromptRow[] = catalogue.flatMap((theme) =>
  theme.questions.map((question, index) => ({
    id: id(theme.n * 10 + index + 1),
    themeId: id(theme.n),
    title: index === 0 ? theme.title : `${theme.title} · ${index + 1}`,
    description: "A quiet question to answer in your own words.",
    text: question,
    kind: "curated",
    sortOrder: index,
  })),
);
