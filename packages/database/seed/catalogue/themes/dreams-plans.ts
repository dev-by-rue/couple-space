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
