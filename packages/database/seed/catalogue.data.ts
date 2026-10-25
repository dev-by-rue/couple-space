import type { promptThemes, prompts } from "../src/schema/index.js";

type ThemeRow = typeof promptThemes.$inferInsert;
type PromptRow = typeof prompts.$inferInsert;

const id = (n: number) =>
  `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/**
 * A question, or a retired one that stays in the list so its id never moves.
 */
type QuestionSeed =
  | string
  | { text: string; retired?: true; followUps?: string[] };

/**
 * A theme and its questions.
 *
 * Prompt ids come from each question's position, so the list is append-only:
 * never reorder, remove or reword a question. To change one, retire it and
 * add the new wording at the end. A theme holds at most 9 questions.
 */
type ThemeSeed = {
  n: number;
  title: string;
  description: string;
  symbol: string;
  questions: QuestionSeed[];
  slug: string;
};

const catalogue: ThemeSeed[] = [
  {
    n: 1,
    title: "Everyday moments",
    description: "Notice the small things that shape your days.",
    symbol: "coffee",
    questions: [
      {
        text: "What small moment with me has stayed with you this week?",
        followUps: [
          "What made that moment stand out from the rest of the week?",
          "How could we make room for more moments like that?",
        ],
      },
      {
        text: "When do you feel most at ease in our everyday life?",
        followUps: [
          "What gets in the way of feeling like that more often?",
          "Is there something I do that helps you get there?",
        ],
      },
      {
        text: "What ordinary ritual would you love us to make more time for?",
        followUps: [
          "What would it take to make it happen this week?",
          "Where did that ritual come from for you?",
        ],
      },
    ],
    slug: "everyday-moments",
  },
  {
    n: 2,
    title: "Us, lately",
    description: "Make room for what has been present recently.",
    symbol: "calendar-heart",
    questions: [
      {
        text: "What do you think we have been doing well lately?",
        followUps: [
          "What do you think has helped us do that?",
          "How would you like us to keep it going?",
        ],
      },
      {
        text: "Where could we be a little gentler with each other?",
        followUps: [
          "What would gentler look like in a real moment?",
          "Is there something you'd like me to try first?",
        ],
      },
      {
        text: "What has felt different between us recently?",
        followUps: [
          "Does the change feel good, or does it worry you a little?",
          "What do you think is behind it?",
        ],
      },
    ],
    slug: "us-lately",
  },
  {
    n: 3,
    title: "Dreams & plans",
    description: "Looking ahead together, without pressure.",
    symbol: "compass",
    questions: [
      {
        text: "What would a good year together feel like, beyond the milestones?",
        followUps: [
          "What's one small thing that would already move us towards it?",
          "What would you want us to let go of this year?",
        ],
      },
      {
        text: "What is one hope you have not said out loud lately?",
        followUps: [
          "What made it hard to say until now?",
          "How could I support that hope?",
        ],
      },
      {
        text: "Where would you like our life to feel more spacious?",
        followUps: [
          "What's taking up the space right now?",
          "What would you do with that extra room?",
        ],
      },
    ],
    slug: "dreams-plans",
  },
  {
    n: 4,
    title: "Knowing you",
    description: "Stay curious about the person beside you.",
    symbol: "message-circle-heart",
    questions: [
      {
        text: "What is something you wish I understood more fully about you?",
        followUps: [
          "When do you notice that gap the most?",
          "What would help me understand it better?",
        ],
      },
      {
        text: "What has been bringing you energy lately?",
        followUps: [
          "What has been draining it?",
          "How can I protect the things that give you energy?",
        ],
      },
      {
        text: "What part of yourself are you growing into?",
        followUps: [
          "What first made you notice it?",
          "How would you like me to encourage it?",
        ],
      },
    ],
    slug: "knowing-you",
  },
  {
    n: 5,
    title: "Money & home",
    description: "Talk gently about the life you share.",
    symbol: "house",
    questions: [
      {
        text: "What would make home feel calmer for both of us?",
        followUps: [
          "Which part of the week feels least calm at home?",
          "What's one change we could try for a fortnight?",
        ],
      },
      {
        text: "What does feeling secure together mean to you?",
        followUps: [
          "When have you felt most secure with me?",
          "Is there anything that makes you feel less secure right now?",
        ],
      },
      {
        text: "What shared responsibility could feel more balanced?",
        followUps: [
          "What would a fairer split look like to you?",
          "Is there something you'd happily take on in exchange?",
        ],
      },
    ],
    slug: "money-home",
  },
  {
    n: 6,
    title: "Gratitude",
    description: "Share what you have quietly appreciated.",
    symbol: "hand-heart",
    questions: [
      {
        text: "What is something I did recently that made you feel cared for?",
        followUps: [
          "What made it land the way it did?",
          "Is there a way you'd like to be cared for that I haven't tried?",
        ],
      },
      {
        text: "What part of our relationship are you especially grateful for today?",
        followUps: [
          "Has that always been there, or has it grown?",
          "How could we tell each other more often?",
        ],
      },
      {
        text: "What quality in me have you noticed anew?",
        followUps: [
          "When did you notice it?",
          "How does it show up between us?",
        ],
      },
    ],
    slug: "gratitude",
  },
];

export const themeRows: ThemeRow[] = catalogue.map((theme, index) => ({
  id: id(theme.n),
  title: theme.title,
  slug: theme.slug,
  description: theme.description,
  symbol: theme.symbol,
  sortOrder: index,
}));

const asObject = (question: QuestionSeed) =>
  typeof question === "string" ? { text: question } : question;

export const promptRows: PromptRow[] = catalogue.flatMap((theme) =>
  theme.questions.flatMap((question, index) => {
    const questionObject = asObject(question);
    const n = theme.n * 10 + index + 1;
    const title = index === 0 ? theme.title : `${theme.title} • ${index + 1}`;

    const curated: PromptRow = {
      id: id(n),
      themeId: id(theme.n),
      parentPromptId: null,
      title,
      description: "A quiet question to answer in your own words.",
      text: questionObject.text,
      kind: "curated",
      sortOrder: index,
      retiredAt: questionObject.retired ? new Date() : null,
    };

    const followUps: PromptRow[] = (questionObject.followUps ?? []).map(
      (text, k) => ({
        id: id(1000 + n * 10 + k + 1),
        themeId: id(theme.n),
        parentPromptId: id(n),
        title: `${title} · follow-up ${k + 1}`,
        description: "A follow-up to talk through together.",
        text,
        kind: "follow_up",
        sortOrder: k,
        retiredAt: questionObject.retired ? new Date() : null,
      }),
    );

    return [curated, ...followUps];
  }),
);
