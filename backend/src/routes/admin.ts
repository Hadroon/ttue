import { db } from "../db";
import { users, ideas, comments, challenges } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

/**
 * Middleware: verify JWT and confirm isAdmin=true from DB
 */
async function adminAuth(req: Request) {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, authResult.user.userId))
    .limit(1);

  if (!user?.isAdmin) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return authResult;
}

// GET /api/admin/stats
export async function handleAdminStats(req: Request): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const [userCount] = await db.select({ count: sql<string>`count(*)` }).from(users);
    const [ideaCount] = await db.select({ count: sql<string>`count(*)` }).from(ideas);
    const [commentCount] = await db.select({ count: sql<string>`count(*)` }).from(comments);
    const [challengeCount] = await db.select({ count: sql<string>`count(*)` }).from(challenges);

    return new Response(
      JSON.stringify({
        userCount: parseInt(userCount.count),
        ideaCount: parseInt(ideaCount.count),
        commentCount: parseInt(commentCount.count),
        challengeCount: parseInt(challengeCount.count),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin stats error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load stats" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// GET /api/admin/users
export async function handleAdminGetUsers(req: Request): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        isAdmin: users.isAdmin,
        reputation: users.reputation,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    return new Response(
      JSON.stringify(allUsers),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin get users error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load users" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// PATCH /api/admin/users/:id
export async function handleAdminUpdateUser(req: Request, userId: number): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { isAdmin } = await req.json();

    if (typeof isAdmin !== "boolean") {
      return new Response(
        JSON.stringify({ error: "isAdmin must be a boolean" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const [updated] = await db
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        isAdmin: users.isAdmin,
        reputation: users.reputation,
        createdAt: users.createdAt,
      });

    if (!updated) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(updated),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin update user error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update user" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// GET /api/admin/ideas
export async function handleAdminGetIdeas(req: Request): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const allIdeas = await db
      .select({
        id: ideas.id,
        title: ideas.title,
        score: ideas.score,
        createdAt: ideas.createdAt,
        authorUsername: users.username,
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.authorId, users.id))
      .orderBy(ideas.createdAt);

    return new Response(
      JSON.stringify(allIdeas),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin get ideas error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load ideas" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// DELETE /api/admin/ideas/:id
export async function handleAdminDeleteIdea(req: Request, ideaId: number): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const deleted = await db.delete(ideas).where(eq(ideas.id, ideaId)).returning({ id: ideas.id });

    if (deleted.length === 0) {
      return new Response(
        JSON.stringify({ error: "Idea not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Idea deleted" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin delete idea error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete idea" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// GET /api/admin/comments
export async function handleAdminGetComments(req: Request): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const allComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorUsername: users.username,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .orderBy(comments.createdAt);

    return new Response(
      JSON.stringify(allComments),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin get comments error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load comments" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// DELETE /api/admin/comments/:id
export async function handleAdminDeleteComment(req: Request, commentId: number): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const deleted = await db.delete(comments).where(eq(comments.id, commentId)).returning({ id: comments.id });

    if (deleted.length === 0) {
      return new Response(
        JSON.stringify({ error: "Comment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Comment deleted" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin delete comment error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// GET /api/admin/challenges
export async function handleAdminGetChallenges(req: Request): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const allChallenges = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        category: challenges.category,
        urgency: challenges.urgency,
        votes: challenges.votes,
        createdAt: challenges.createdAt,
      })
      .from(challenges)
      .orderBy(challenges.createdAt);

    return new Response(
      JSON.stringify(allChallenges),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin get challenges error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load challenges" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// DELETE /api/admin/challenges/:id
export async function handleAdminDeleteChallenge(req: Request, challengeId: number): Promise<Response> {
  const auth = await adminAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const deleted = await db.delete(challenges).where(eq(challenges.id, challengeId)).returning({ id: challenges.id });

    if (deleted.length === 0) {
      return new Response(
        JSON.stringify({ error: "Challenge not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Challenge deleted" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin delete challenge error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete challenge" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
