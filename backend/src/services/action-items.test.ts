import { describe, expect, test } from "bun:test";
import { KINDS, ValidationError, getKind, parseItemData } from "./action-items";

const parse = (kind: string, data: unknown) => parseItemData(getKind(kind)!, data);

describe("action item registry", () => {
  test("rejects unknown kinds, including inherited object keys", () => {
    expect(getKind("case")).not.toBeNull();
    expect(getKind("nope")).toBeNull();
    expect(getKind("constructor")).toBeNull();
    expect(getKind(42)).toBeNull();
  });

  test("every kind with a sum field has a parent", () => {
    for (const [kind, def] of Object.entries(KINDS)) {
      if (def.sumField) expect(def.parent, kind).toBeDefined();
    }
  });

  test("trims text, drops unknown fields and fills optional ones", () => {
    const data = parse("case", { target: "  Acme  ", jurisdiction: "EU", basis: "Other", budget: 500, extra: "x" });
    expect(data).toEqual({ target: "Acme", jurisdiction: "EU", basis: "Other", budget: 500, lead: "" });
  });

  test("reports missing and invalid fields", () => {
    expect(() => parse("case", { jurisdiction: "EU", basis: "Other", budget: 1 })).toThrow("Target entity is required");
    expect(() => parse("case", { target: "A", jurisdiction: "EU", basis: "Other", budget: -1 })).toThrow(ValidationError);
    expect(() => parse("case", { target: "A", jurisdiction: "EU", basis: "Other", budget: 1.5 })).toThrow(ValidationError);
    expect(() => parse("case", "text")).toThrow("data must be an object");
    expect(() => parse("case", [])).toThrow("data must be an object");
  });

  test("only accepts http(s) links", () => {
    expect(parse("filing", { title: "Complaint", url: "example.org/doc" }).url).toBe("https://example.org/doc");
    expect(() => parse("filing", { title: "x", url: "javascript:alert(1)" })).toThrow(ValidationError);
    expect(() => parse("media", { title: "x", type: "Logo", url: "data:text/html,hi" })).toThrow(ValidationError);
  });

  test("validates evidence hashes and dates", () => {
    const hash = "A".repeat(64);
    const ok = parse("evidence", { name: "a.jpg", size: 10, sha256: hash, confidentiality: "Public", capturedAt: "2026-01-02T03:04:05Z" });
    expect(ok.sha256).toBe("a".repeat(64));
    expect(() => parse("evidence", { name: "a", size: 1, sha256: "abc", confidentiality: "Public", capturedAt: "2026-01-01" })).toThrow(ValidationError);
    expect(() => parse("evidence", { name: "a", size: 1, sha256: hash, confidentiality: "Secret", capturedAt: "2026-01-01" })).toThrow(ValidationError);
    expect(() => parse("evidence", { name: "a", size: 1, sha256: hash, confidentiality: "Public", capturedAt: "not a date" })).toThrow(ValidationError);
  });

  test("legal cases and bounty tasks need admin approval before they can be funded", () => {
    expect(KINDS.case.approval).toBe(true);
    expect(KINDS.task.approval).toBe(true);
    expect(KINDS.media.approval).toBeUndefined();
    expect(getKind("case_pledge")).toBeNull();
  });

  test("validates targets and their mapped sub-brands", () => {
    const data = parse("target", { brand: "Brand", alternative: null, extra: 1 });
    expect(data).toEqual({ brand: "Brand", parent: "", alternative: null });
    expect(parse("target", { brand: "B", alternative: { name: "Alt" } }).alternative).toEqual({ name: "Alt", note: "" });
    expect(parse("subsidiary", { name: "Sub", citation: "example.org/report" })).toEqual({ name: "Sub", citation: "https://example.org/report" });
    expect(() => parse("subsidiary", { name: "Sub", citation: "not a link" })).toThrow(ValidationError);
    expect(() => parse("subsidiary", { citation: "https://example.org" })).toThrow(ValidationError);
  });

  test("sub-brands hang off targets and are shared", () => {
    expect(KINDS.subsidiary.parent).toEqual({ kind: "target", required: true });
    expect(KINDS.subsidiary.scope).toBe("shared");
    expect(KINDS.resolution_cosponsor.sumWhen).toBe("cosponsor");
  });

  test("tasks default to Open and reject unknown statuses", () => {
    expect(parse("task", { title: "Fix", cost: 10 }).status).toBe("Open");
    expect(() => parse("task", { title: "Fix", cost: 10, status: "Done" })).toThrow(ValidationError);
  });

  test("quadratic voting cannot exceed the voice credits", () => {
    expect(parse("allocation", { votes: { "1": 6, "2": 8 } }).votes).toEqual({ "1": 6, "2": 8 });
    expect(() => parse("allocation", { votes: { "1": 8, "2": 7 } })).toThrow(/credits/);
    expect(() => parse("allocation", { votes: { abc: 1 } })).toThrow(ValidationError);
    expect(parse("allocation", { votes: { "1": 0 } }).votes).toEqual({});
  });

  test("outreach counters default to zero", () => {
    expect(parse("outreach", {})).toEqual({ postalCode: "", email: 0, call: 0, mail: 0 });
  });
});
