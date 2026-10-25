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
