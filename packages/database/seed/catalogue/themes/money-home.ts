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
