import { describe, expect, it } from "vitest";
import {
  filterPrompts,
  PROMPT_PAGE_SIZE,
  promptFiltersHref,
  readPromptFilters,
  toggleDepth,
  toggleTag,
  toggleTalkedAbout,
  type PromptFilters,
} from "./prompt-filters";

const none: PromptFilters = {
  depth: null,
  tags: [],
  talkedAbout: false,
  show: PROMPT_PAGE_SIZE,
};

describe("readPromptFilters", () => {
  it("reads depth, known tags, talked about and show", () => {
    const params = new URLSearchParams(
      "depth=deep&tag=playful&tag=nope&talked=1&show=12",
    );

    expect(readPromptFilters(params, ["playful", "romantic"])).toEqual({
      depth: "deep",
      tags: ["playful"],
      talkedAbout: true,
      show: 12,
    });
  });

  it("ignores an unknown depth, a bad show and any other talked value", () => {
    const params = new URLSearchParams("depth=very&show=abc&talked=yes");

    expect(readPromptFilters(params, [])).toEqual(none);
  });

  it("never shows fewer than one page", () => {
    expect(readPromptFilters(new URLSearchParams("show=2"), []).show).toBe(
      PROMPT_PAGE_SIZE,
    );
  });
});

describe("filterPrompts", () => {
  const prompts = [
    {
      id: "a",
      depth: "light" as const,
      tags: ["playful"],
      answeredSessionId: null,
    },
    {
      id: "b",
      depth: "deep" as const,
      tags: ["romantic"],
      answeredSessionId: null,
    },
    { id: "c", depth: "deep" as const, tags: [], answeredSessionId: null },
    {
      id: "done",
      depth: "light" as const,
      tags: ["playful"],
      answeredSessionId: "s1",
    },
  ];

  it("hides answered prompts with no filters", () => {
    expect(filterPrompts(prompts, none).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("shows answered prompts too when talked about is on", () => {
    expect(
      filterPrompts(prompts, { ...none, talkedAbout: true }).map((p) => p.id),
    ).toEqual(["a", "b", "c", "done"]);
  });

  it("matches one depth", () => {
    expect(
      filterPrompts(prompts, { ...none, depth: "deep" }).map((p) => p.id),
    ).toEqual(["b", "c"]);
  });

  it("matches any selected tag", () => {
    expect(
      filterPrompts(prompts, { ...none, tags: ["playful", "romantic"] }).map(
        (p) => p.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("combines talked about with the other filters", () => {
    expect(
      filterPrompts(prompts, {
        depth: "light",
        tags: ["playful"],
        talkedAbout: true,
      }).map((p) => p.id),
    ).toEqual(["a", "done"]);
  });
});

describe("promptFiltersHref", () => {
  it("is just the pathname with no filters", () => {
    expect(promptFiltersHref("/start/x", none)).toBe("/start/x");
  });

  it("encodes depth, tags, talked about and show", () => {
    expect(
      promptFiltersHref("/start/x", {
        depth: "light",
        tags: ["a", "b"],
        talkedAbout: true,
        show: 12,
      }),
    ).toBe("/start/x?depth=light&tag=a&tag=b&talked=1&show=12");
  });
});

describe("toggleDepth, toggleTag and toggleTalkedAbout", () => {
  it("selects, then clears, a depth and resets show", () => {
    const on = toggleDepth({ ...none, show: 18 }, "medium");
    expect(on).toEqual({ ...none, depth: "medium" });
    expect(toggleDepth(on, "medium").depth).toBeNull();
  });

  it("adds, then removes, a tag and resets show", () => {
    const on = toggleTag({ ...none, show: 18 }, "playful");
    expect(on).toEqual({ ...none, tags: ["playful"] });
    expect(toggleTag(on, "playful").tags).toEqual([]);
  });

  it("turns talked about on, then off, and resets show", () => {
    const on = toggleTalkedAbout({ ...none, show: 18 });
    expect(on).toEqual({ ...none, talkedAbout: true });
    expect(toggleTalkedAbout(on).talkedAbout).toBe(false);
  });
});
