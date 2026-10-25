import type { ThemeSeed } from "../types.js";

export const usLately: ThemeSeed = {
  slug: "us-lately",
  title: "Us, lately",
  description: "Make room for what has been present recently.",
  symbol: "calendar-heart",
  questions: [
    {
      key: "doing-well-lately",
      title: "What we're doing well",
      text: "What do you think we have been doing well lately?",
      depth: "light",
      tags: ["thoughtful"],
    },
    {
      key: "gentler-with-each-other",
      title: "A little gentler",
      text: "Where could we be a little gentler with each other?",
      depth: "medium",
      tags: ["thoughtful"],
    },
    {
      key: "different-between-us-recently",
      title: "Something has shifted",
      text: "What has felt different between us recently?",
      depth: "medium",
      tags: ["thoughtful"],
    },
  ],
};
