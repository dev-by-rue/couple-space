import { describe, expect, it } from "vitest";
import { promptId, uuidv5 } from "./ids.js";
import {
  catalogue,
  promptRows,
  promptTagLinkRows,
  tagRows,
  themeRows,
} from "./index.js";

const KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lists the values that appear more than once.
 *
 * @returns The duplicates, empty when every value is unique.
 */
function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("uuidv5", () => {
  it("matches the RFC example for the DNS namespace", () => {
    expect(
      uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
    ).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("never changes for an existing key", () => {
    // Fails if NAMESPACE or the "prompt:" prefix is edited, which would move every id.
    expect(promptId("small-moment-this-week")).toBe(
      "385fd7a4-5b33-5887-895d-03050a7af12d",
    );
  });
});

describe("catalogue", () => {
  it("has unique ids across themes, prompts and tags", () => {
    const ids = [...themeRows, ...promptRows, ...tagRows].map((r) => r.id!);
    expect(duplicates(ids)).toEqual([]);
  });

  it("has unique theme slugs and prompt keys", () => {
    expect(duplicates(catalogue.map((t) => t.slug))).toEqual([]);
    expect(duplicates(promptRows.map((p) => p.key!))).toEqual([]);
  });

  it("uses kebab-case keys and slugs", () => {
    for (const theme of catalogue) {
      expect(theme.slug).toMatch(KEY_FORMAT);
      for (const question of theme.questions) {
        expect(question.key).toMatch(KEY_FORMAT);
      }
    }
  });

  it("has a title and text on every question", () => {
    for (const prompt of promptRows) {
      expect(prompt.title.trim()).not.toBe("");
      expect(prompt.text.trim()).not.toBe("");
    }
  });

  it("points every follow-up at a curated prompt", () => {
    const curatedIds = promptRows
      .filter((p) => p.kind === "curated")
      .map((p) => p.id);
    for (const followUp of promptRows.filter((p) => p.kind === "follow_up")) {
      expect(curatedIds).toContain(followUp.parentPromptId);
    }
  });

  it("has no empty follow-ups", () => {
    for (const theme of catalogue) {
      for (const question of theme.questions) {
        for (const text of question.followUps ?? []) {
          expect(text.trim()).not.toBe("");
        }
      }
    }
  });

  it("never tags a question twice with the same tag", () => {
    const pairs = promptTagLinkRows.map((l) => `${l.promptId}:${l.tagId}`);
    expect(duplicates(pairs)).toEqual([]);
  });
});
