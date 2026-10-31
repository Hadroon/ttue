import { eq } from "drizzle-orm";
import { db } from "../db";
import { challenges, users } from "../db/schema";

const SITE_NAME = "Earth Forum";
const DEFAULT_DESCRIPTION = "Turn real-world problems into shared solutions: discuss challenges, propose ideas and draft bills together.";
const MAX_DESCRIPTION = 200;

interface SocialMeta {
  title: string;
  description: string;
  type: "website" | "article" | "profile";
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

function toPlainText(html: string, maxLength = MAX_DESCRIPTION): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name])
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1).trimEnd() + "…" : text;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Social crawlers do not run JavaScript, so the shared link must carry its preview in the HTML itself
async function resolveMeta(url: URL): Promise<SocialMeta> {
  const fallback: SocialMeta = { title: SITE_NAME, description: DEFAULT_DESCRIPTION, type: "website" };

  try {
    if (url.pathname === "/article-workbench") {
      const id = Number(url.searchParams.get("challengeId"));
      if (!Number.isInteger(id) || id <= 0) {
        return fallback;
      }
      const [challenge] = await db
        .select({ title: challenges.title, description: challenges.description, category: challenges.category })
        .from(challenges)
        .where(eq(challenges.id, id))
        .limit(1);
      if (!challenge) {
        return fallback;
      }
      const isDraft = url.searchParams.get("section") === "draft";
      return {
        title: `${isDraft ? "Draft bill: " : ""}${challenge.title} | ${SITE_NAME}`,
        description: toPlainText(challenge.description) || DEFAULT_DESCRIPTION,
        type: "article",
      };
    }

    const profileMatch = url.pathname.match(/^\/profile\/([^/]+)$/);
    if (profileMatch) {
      const [user] = await db
        .select({ username: users.username, displayName: users.displayName, bio: users.bio })
        .from(users)
        .where(eq(users.username, decodeURIComponent(profileMatch[1])))
        .limit(1);
      if (!user) {
        return fallback;
      }
      return {
        title: `${user.displayName || user.username} on ${SITE_NAME}`,
        description: toPlainText(user.bio ?? "") || `Civic profile of @${user.username}.`,
        type: "profile",
      };
    }
  } catch (error) {
    console.error("Could not resolve social metadata:", error);
  }

  return fallback;
}

function publicOrigin(req: Request, url: URL): string {
  // DOMAIN is the app's public URL (also used for Stripe return URLs)
  const configured = process.env.DOMAIN?.trim().replace(/\/+$/, "");
  if (configured) {
    return configured;
  }
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if ((proto === "http" || proto === "https") && host) {
    return `${proto}://${host}`;
  }
  return url.origin;
}

export async function injectSocialMeta(html: string, req: Request, url: URL): Promise<string> {
  const meta = await resolveMeta(url);
  const origin = publicOrigin(req, url);
  const canonical = `${origin}${url.pathname}${url.search}`;

  const tags = [
    ["description", meta.description],
    ["og:type", meta.type],
    ["og:site_name", SITE_NAME],
    ["og:title", meta.title],
    ["og:description", meta.description],
    ["og:url", canonical],
    ["og:image", `${origin}/favicon.png`],
    ["twitter:card", "summary"],
    ["twitter:title", meta.title],
    ["twitter:description", meta.description],
    ["twitter:image", `${origin}/favicon.png`],
  ].map(([name, content]) => {
    const attr = name.startsWith("og:") ? "property" : "name";
    return `  <meta ${attr}="${name}" content="${escapeAttr(content)}">`;
  }).join("\n");

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeAttr(meta.title)}</title>`)
    .replace(/<\/head>/i, () => `${tags}\n</head>`);
}
