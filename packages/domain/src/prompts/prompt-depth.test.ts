import { describe, expect, it } from "vitest";
import {
  isPromptDepth,
  PROMPT_DEPTH_LABELS,
  PROMPT_DEPTHS,
} from "./prompt-depth.js";

describe("PROMPT_DEPTHS", () => {
  it("has a label for every depth", () => {
    expect(Object.keys(PROMPT_DEPTH_LABELS).sort()).toEqual(
      [...PROMPT_DEPTHS].sort(),
    );
  });
});

describe("isPromptDepth", () => {
  it.each(["light", "medium", "deep"])("accepts %s", (value) => {
    expect(isPromptDepth(value)).toBe(true);
  });

  it.each(["Light", "shallow", "", null, undefined])("rejects %s", (value) => {
    expect(isPromptDepth(value)).toBe(false);
  });
});
