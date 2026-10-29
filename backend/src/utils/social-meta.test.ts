import { beforeEach, describe, expect, mock, test } from "bun:test";

let rows: unknown[] = [];
const chain: Record<string, unknown> = {};
for (const method of ["select", "from", "where"]) {
  chain[method] = () => chain;
}
chain.limit = async () => rows;
mock.module("../db", () => ({ db: chain }));

const { injectSocialMeta } = await import("./social-meta");

const html = "<!doctype html><html><head><title>EarthForumApp</title></head><body></body></html>";

function render(path: string, headers: Record<string, string> = {}) {
  const url = new URL(`https://forum.example${path}`);
  return injectSocialMeta(html, new Request(url, { headers }), url);
}

describe("injectSocialMeta", () => {
  beforeEach(() => {
    rows = [];
    delete process.env.DOMAIN;
  });

  test("adds default tags for ordinary pages", async () => {
    const out = await render("/challenges");
    expect(out).toContain("<title>Earth Forum</title>");
    expect(out).toContain('<meta property="og:title" content="Earth Forum">');
    expect(out).toContain('<meta property="og:image" content="https://forum.example/favicon.png">');
    expect(out.indexOf("og:title")).toBeLessThan(out.indexOf("</head>"));
  });

  test("uses the challenge title and plain-text description", async () => {
    rows = [{ title: 'Clean "water"', description: "<p>Rivers are <b>polluted</b> &amp; dying.</p>", category: "Environment" }];
    const out = await render("/article-workbench?challengeId=7&section=ideas");
    expect(out).toContain('<meta property="og:title" content="Clean &quot;water&quot; | Earth Forum">');
    expect(out).toContain('<meta property="og:description" content="Rivers are polluted &amp; dying.">');
    expect(out).toContain('<meta property="og:url" content="https://forum.example/article-workbench?challengeId=7&amp;section=ideas">');
    expect(out).toContain('<meta property="og:type" content="article">');
  });

  test("labels draft bill links", async () => {
    rows = [{ title: "Clean water", description: "Text", category: "Environment" }];
    const out = await render("/article-workbench?challengeId=7&section=draft");
    expect(out).toContain('content="Draft bill: Clean water | Earth Forum"');
  });

  test("falls back to defaults for an unknown challenge or invalid id", async () => {
    expect(await render("/article-workbench?challengeId=999")).toContain('og:title" content="Earth Forum"');
    expect(await render("/article-workbench?challengeId=abc")).toContain('og:title" content="Earth Forum"');
  });

  test("uses the profile bio for profile links", async () => {
    rows = [{ username: "ada", displayName: "Ada L.", bio: "Civic hacker" }];
    const out = await render("/profile/ada");
    expect(out).toContain('og:title" content="Ada L. on Earth Forum"');
    expect(out).toContain('og:description" content="Civic hacker"');
  });

  test("escapes markup in user content and truncates long descriptions", async () => {
    rows = [{ title: "x", description: `<script>alert(1)</script>"><img src=x> ${"a".repeat(500)}`, category: "c" }];
    const out = await render("/article-workbench?challengeId=1");
    expect(out).not.toContain("<img");
    const description = out.match(/property="og:description" content="([^"]*)"/)![1];
    expect(description.length).toBeLessThanOrEqual(260);
  });

  test("respects forwarded headers behind a proxy", async () => {
    const out = await render("/", { "x-forwarded-proto": "https", "x-forwarded-host": "earthforum.org" });
    expect(out).toContain('og:url" content="https://earthforum.org/"');
  });
});
