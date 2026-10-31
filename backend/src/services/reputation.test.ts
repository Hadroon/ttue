import { describe, expect, test } from "bun:test";
import { getCivicRank, getNextCivicRank, getVoteDelta, mapCategoryToDomainSlug } from "./reputation";

describe("civic rank policy", () => {
  test.each([
    [-10, "CITIZEN"],
    [0, "CITIZEN"],
    [99, "CITIZEN"],
    [100, "SCRIBE"],
    [499, "SCRIBE"],
    [500, "TRIBUNE"],
    [1999, "TRIBUNE"],
    [2000, "ARCHON"],
  ])("maps %i reputation to %s", (reputation, expected) => {
    expect(getCivicRank(reputation)).toBe(expected);
  });

  test("returns the next rank threshold", () => {
    expect(getNextCivicRank(99)).toEqual({ title: "SCRIBE", minimumReputation: 100 });
    expect(getNextCivicRank(2000)).toBeNull();
  });
});

describe("vote delta policy", () => {
  test.each([
    [null, 1, 1],
    [null, -1, -1],
    [1, null, -1],
    [-1, null, 1],
    [1, -1, -2],
    [-1, 1, 2],
  ])("moves from %p to %p with delta %i", (previous, next, expected) => {
    expect(getVoteDelta(previous, next)).toBe(expected);
  });
});

describe("legacy category domain mapping", () => {
  test("maps known categories and falls back to General Civic", () => {
    expect(mapCategoryToDomainSlug("Environment")).toBe("climate-ecology");
    expect(mapCategoryToDomainSlug("Housing")).toBe("resource-economy");
    expect(mapCategoryToDomainSlug("Technology")).toBe("algorithmic-governance");
    expect(mapCategoryToDomainSlug("Health")).toBe("open-science");
    expect(mapCategoryToDomainSlug("Other")).toBe("general-civic");
  });
});