import { db } from "../db";
import { challenges, challengeLinks, users } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth";
import { normalizeUrl } from "../utils/url";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const MAX_URL = 200;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;

const linkColumns = {
  id: challengeLinks.id,
  challengeId: challengeLinks.challengeId,
  userId: challengeLinks.userId,
  url: challengeLinks.url,
  title: challengeLinks.title,
  description: challengeLinks.description,
  createdAt: challengeLinks.createdAt,
  authorUsername: users.username,
  authorDisplayName: users.displayName,
};

async function loadLink(linkId: number) {
  const [link] = await db
    .select(linkColumns)
    .from(challengeLinks)
    .innerJoin(users, eq(challengeLinks.userId, users.id))
    .where(eq(challengeLinks.id, linkId))
    .limit(1);
  return link;
}

// GET /api/challenges/:id/links
export async function handleGetChallengeLinks(_req: Request, challengeId: number): Promise<Response> {
  try {
    const links = await db
      .select(linkColumns)
      .from(challengeLinks)
      .innerJoin(users, eq(challengeLinks.userId, users.id))
      .where(eq(challengeLinks.challengeId, challengeId))
      .orderBy(desc(challengeLinks.createdAt), desc(challengeLinks.id));
    return json(links);
  } catch (error) {
    console.error("Get challenge links error:", error);
    return json({ error: "Failed to load links" }, 500);
  }
}

// POST /api/challenges/:id/links  { url, title?, description? }
export async function handleCreateChallengeLink(req: Request, challengeId: number): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request body" }, 400);

    if (typeof body.url === "string" && body.url.trim().length > MAX_URL) {
      return json({ error: `Link must be at most ${MAX_URL} characters` }, 400);
    }
    const url = normalizeUrl(body.url);
    if (!url) return json({ error: "Enter a valid http(s) link" }, 400);
    if (url.length > MAX_URL) return json({ error: `Link must be at most ${MAX_URL} characters` }, 400);

    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
    if (rawTitle.length > MAX_TITLE) return json({ error: `Title must be at most ${MAX_TITLE} characters` }, 400);
    const title = rawTitle || new URL(url).hostname.replace(/^www\./, "");

    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > MAX_DESCRIPTION) {
      return json({ error: `Description must be at most ${MAX_DESCRIPTION} characters` }, 400);
    }

    const [challenge] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return json({ error: "Challenge not found" }, 404);

    const [created] = await db
      .insert(challengeLinks)
      .values({ challengeId, userId: auth.user.userId, url, title, description: description || null })
      .onConflictDoNothing()
      .returning({ id: challengeLinks.id });
    if (!created) return json({ error: "This link has already been added" }, 409);

    return json(await loadLink(created.id), 201);
  } catch (error) {
    console.error("Create challenge link error:", error);
    return json({ error: "Failed to add link" }, 500);
  }
}

// DELETE /api/challenges/:id/links/:linkId - the author or an admin
export async function handleDeleteChallengeLink(req: Request, challengeId: number, linkId: number): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  try {
    const [link] = await db
      .select({ userId: challengeLinks.userId })
      .from(challengeLinks)
      .where(and(eq(challengeLinks.id, linkId), eq(challengeLinks.challengeId, challengeId)))
      .limit(1);
    if (!link) return json({ error: "Link not found" }, 404);

    if (link.userId !== auth.user.userId) {
      const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, auth.user.userId)).limit(1);
      if (!user?.isAdmin) return json({ error: "Only the author or an admin can remove this link" }, 403);
    }

    await db.delete(challengeLinks).where(eq(challengeLinks.id, linkId));
    return json({ message: "Link removed" });
  } catch (error) {
    console.error("Delete challenge link error:", error);
    return json({ error: "Failed to remove link" }, 500);
  }
}
