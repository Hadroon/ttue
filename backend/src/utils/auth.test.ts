import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { checkPasswordPolicy, isValidEmail, isValidUsername, normalizeEmail, validatePassword, validateUsername } from "./auth";

// Fake Have I Been Pwned range API that reports `breached` passwords as seen in breaches
function pwnedApi(breached: string[]): typeof fetch {
  return (async (url: string) => {
    const prefix = String(url).slice(-5);
    const lines = breached
      .map((p) => createHash("sha1").update(p).digest("hex").toUpperCase())
      .filter((h) => h.startsWith(prefix))
      .map((h) => `${h.slice(5)}:42`);
    return new Response([...lines, "0000000000000000000000000000000000A:0"].join("\r\n"));
  }) as unknown as typeof fetch;
}

describe("validatePassword", () => {
  test("accepts passwords between 8 characters and 72 bytes", () => {
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("a".repeat(72))).toBeNull();
  });

  test("rejects missing, short and over-long passwords", () => {
    expect(validatePassword(undefined)).toBe("Password is required");
    expect(validatePassword("1234567")).toBe("Password must be at least 8 characters");
    expect(validatePassword("a".repeat(73))).toBe("Password must be at most 72 characters");
    // 37 two-byte characters exceed bcrypt's 72-byte limit
    expect(validatePassword("é".repeat(37))).toBe("Password must be at most 72 characters");
  });
});

describe("email and username rules", () => {
  test("normalizes and validates emails", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com");
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("jane@example")).toBe(false);
    expect(isValidEmail("jane doe@example.com")).toBe(false);
  });

  test("allows 3-30 letters, digits and underscores in usernames", () => {
    expect(isValidUsername("earth_friend_42")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a".repeat(31))).toBe(false);
    expect(isValidUsername("jane.doe")).toBe(false);
  });

  test("rejects reserved usernames regardless of case", () => {
    expect(validateUsername("Admin")).toBe("That username is reserved. Please choose another one.");
    expect(validateUsername("earth_friend")).toBeNull();
  });
});

describe("checkPasswordPolicy", () => {
  test("rejects passwords containing the username or email name", async () => {
    const api = pwnedApi([]);
    expect(await checkPasswordPolicy("xxJaneDoe2026", { username: "janedoe" }, api)).toBe("Password must not contain your username or email");
    expect(await checkPasswordPolicy("my-jane.d-secret", { email: "jane.d@example.com" }, api)).toBe("Password must not contain your username or email");
  });

  test("rejects breached passwords and accepts unbreached ones", async () => {
    const api = pwnedApi(["correcthorse1"]);
    expect(await checkPasswordPolicy("correcthorse1", {}, api)).toContain("data breach");
    expect(await checkPasswordPolicy("violet tractor anthem", {}, api)).toBeNull();
  });

  test("fails open when the breach service is unreachable", async () => {
    const failing = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await checkPasswordPolicy("violet tractor anthem", {}, failing)).toBeNull();
  });
});
