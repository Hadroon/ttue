import { describe, expect, test } from "bun:test";
import { rateLimit, resetRateLimit } from "./rate-limit";

describe("rateLimit", () => {
  test("allows up to max attempts per window, then blocks until the window resets", () => {
    const key = `test:${Math.random()}`;
    expect([1, 2, 3].map(() => rateLimit(key, 3, 1000, 0))).toEqual([true, true, true]);
    expect(rateLimit(key, 3, 1000, 500)).toBe(false);
    expect(rateLimit(key, 3, 1000, 1000)).toBe(true);
  });

  test("resetRateLimit clears the counter", () => {
    const key = `test:${Math.random()}`;
    rateLimit(key, 1, 1000, 0);
    expect(rateLimit(key, 1, 1000, 0)).toBe(false);
    resetRateLimit(key);
    expect(rateLimit(key, 1, 1000, 0)).toBe(true);
  });
});
