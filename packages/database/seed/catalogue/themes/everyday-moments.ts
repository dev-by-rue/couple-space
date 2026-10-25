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
