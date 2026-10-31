import { describe, expect, test } from "bun:test";
import { TEXT_LIMITS, checkTagList, checkTextLimits } from "./text-limits";

describe("checkTextLimits", () => {
  test("accepts values within limits and skips missing ones", () => {
    expect(checkTextLimits({ Title: ["a".repeat(TEXT_LIMITS.title), TEXT_LIMITS.title], Bio: [undefined, 10], Other: [null, 10] })).toBeNull();
  });

  test("rejects values over the limit", () => {
    expect(checkTextLimits({ Title: ["a".repeat(TEXT_LIMITS.title + 1), TEXT_LIMITS.title] })).toBe(
      `Title must be at most ${TEXT_LIMITS.title} characters`,
    );
  });

  test("rejects non-string values", () => {
    expect(checkTextLimits({ Content: [{ length: 1 }, 10] })).toBe("Content must be text");
  });
});

describe("checkTagList", () => {
  test("accepts missing or valid tag lists", () => {
    expect(checkTagList(undefined)).toBeNull();
    expect(checkTagList(["climate", "a".repeat(TEXT_LIMITS.tag)])).toBeNull();
  });

  test("rejects too many, too long or non-string tags", () => {
    expect(checkTagList(Array.from({ length: TEXT_LIMITS.maxTags + 1 }, (_, i) => `t${i}`))).toBe(`At most ${TEXT_LIMITS.maxTags} tags are allowed`);
    expect(checkTagList(["a".repeat(TEXT_LIMITS.tag + 1)])).toBe(`Tags must be at most ${TEXT_LIMITS.tag} characters`);
    expect(checkTagList([1])).toBe("Tags must be text");
    expect(checkTagList("climate")).toBe("Tags must be a list");
  });
});
