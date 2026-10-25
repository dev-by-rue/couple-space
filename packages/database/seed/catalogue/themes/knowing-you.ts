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
