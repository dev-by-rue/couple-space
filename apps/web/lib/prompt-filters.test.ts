import { describe, expect, it } from "vitest";
import {
  filterPrompts,
  PROMPT_PAGE_SIZE,
  promptFiltersHref,
  readPromptFilters,
  toggleDepth,
  toggleTag,
  type PromptFilters,
} from "./prompt-filters";

const none: PromptFilters = { depth: null, tags: [], show: PROMPT_PAGE_SIZE };

describe("readPromptFilters", () => {
  it("reads depth, known tags and show", () => {
    const params = new URLSearchParams(
      "depth=deep&tag=playful&tag=nope&show=12",
    );

    expect(readPromptFilters(params, ["playful", "romantic"])).toEqual({
      depth: "deep",
      tags: ["playful"],
      show: 12,
    });
  });

  it("ignores an unknown depth and a bad show", () => {
    const params = new URLSearchParams("depth=very&show=abc");

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
    { id: "a", depth: "light" as const, tags: ["playful"] },
    { id: "b", depth: "deep" as const, tags: ["romantic"] },
    { id: "c", depth: "deep" as const, tags: [] },
  ];

  it("keeps everything with no filters", () => {
    expect(filterPrompts(prompts, none).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("matches one depth", () => {
    expect(
      filterPrompts(prompts, { depth: "deep", tags: [] }).map((p) => p.id),
    ).toEqual(["b", "c"]);
  });

  it("matches any selected tag", () => {
    expect(
      filterPrompts(prompts, {
        depth: null,
        tags: ["playful", "romantic"],
      }).map((p) => p.id),
    ).toEqual(["a", "b"]);
  });
});

describe("promptFiltersHref", () => {
  it("is just the pathname with no filters", () => {
    expect(promptFiltersHref("/start/x", none)).toBe("/start/x");
  });

  it("encodes depth, tags and show", () => {
    expect(
      promptFiltersHref("/start/x", {
        depth: "light",
        tags: ["a", "b"],
        show: 12,
      }),
    ).toBe("/start/x?depth=light&tag=a&tag=b&show=12");
  });
});

describe("toggleDepth and toggleTag", () => {
  it("selects, then clears, a depth and resets show", () => {
    const on = toggleDepth({ ...none, show: 18 }, "medium");
    expect(on).toEqual({ depth: "medium", tags: [], show: PROMPT_PAGE_SIZE });
    expect(toggleDepth(on, "medium").depth).toBeNull();
  });

  it("adds, then removes, a tag and resets show", () => {
    const on = toggleTag({ ...none, show: 18 }, "playful");
    expect(on).toEqual({
      depth: null,
      tags: ["playful"],
      show: PROMPT_PAGE_SIZE,
    });
    expect(toggleTag(on, "playful").tags).toEqual([]);
  });
});
