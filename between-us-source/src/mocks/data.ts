import type { Couple, CoupleDataSource, Prompt, Session, Theme } from "@/types/couple";

const members = [
  { id: "m1", email: "rueben@example.com", emailVerified: true, inviteAccepted: true },
  { id: "m2", email: "alex.morgan@example.com", emailVerified: true, inviteAccepted: true },
];

const themeSeeds = [
  ["everyday", "Everyday moments", "Notice the small things that shape your days.", "☕"],
  ["dreams", "Dreams & plans", "Look ahead together, without pressure.", "✦"],
  ["lately", "Us, lately", "Make room for what has been present recently.", "◌"],
  ["gratitude", "Gratitude", "Share what you have quietly appreciated.", "♡"],
  ["home", "Money & home", "Talk gently about the life you share.", "⌂"],
  ["knowing", "Knowing you", "Stay curious about the person beside you.", "◎"],
] as const;

const promptTexts: Record<string, string[]> = {
  everyday: ["What small moment with me has stayed with you this week?", "When do you feel most at ease in our everyday life?", "What ordinary ritual would you love us to make more time for?"],
  dreams: ["What would a good year together feel like, beyond the milestones?", "What is one hope you have not said out loud lately?", "Where would you like our life to feel more spacious?"],
  lately: ["What do you think we have been doing well lately?", "Where could we be a little gentler with each other?", "What has felt different between us recently?"],
  gratitude: ["What is something I did recently that made you feel cared for?", "What part of our relationship are you especially grateful for today?", "What quality in me have you noticed anew?"],
  home: ["What would make home feel calmer for both of us?", "What does feeling secure together mean to you?", "What shared responsibility could feel more balanced?"],
  knowing: ["What is something you wish I understood more fully about you?", "What has been bringing you energy lately?", "What part of yourself are you growing into?"],
};

function makePrompts(themeId: string, themeTitle: string): Prompt[] {
  return (promptTexts[themeId] ?? []).map((text, index) => ({
    id: `${themeId}-${index + 1}`,
    title: index === 0 ? themeTitle : `${themeTitle} · ${index + 1}`,
    description: "A quiet question to answer in your own words.",
    themeId,
    text,
    kind: "curated",
  }));
}

export const themes: Theme[] = themeSeeds.map(([id, title, description, symbol]) => ({
  id,
  title,
  description,
  symbol,
  prompts: makePrompts(id, title),
}));

const featuredPrompt = themes[0]?.prompts[0];

export const initialCouple: Couple = { id: "couple-1", members };

export const initialSessions: Session[] = featuredPrompt
  ? [{
      id: "evening-1",
      prompt: featuredPrompt,
      status: "awaiting_responses",
      responses: [
        { memberId: "m1", text: "Making tea together before the rest of the evening begins.", submitted: false },
        { memberId: "m2", text: "The walk home when we were both tired and still made each other laugh.", submitted: false },
      ],
      followUps: [
        { id: "f1", question: "What surprised you most about your partner's answer?", responses: [] },
        { id: "f2", question: "What would you like to make more room for together?", responses: [] },
        { id: "f3", question: "What is one small thing you could try this week?", responses: [] },
      ],
      directedQuestions: [],
    }]
  : [];

export const mockDataSource: CoupleDataSource = {
  getCouple: () => initialCouple,
  getThemes: () => themes,
  getSessions: () => initialSessions,
};