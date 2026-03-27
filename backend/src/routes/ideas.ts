import { db } from "../db";
import { ideas, users, ideaVotes, ideaTags, tags } from "../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";

// Create new idea
export async function handleCreateIdea(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { title, content, tagNames } = await req.json();

    // Validate input
    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: "Title and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create idea
    const [newIdea] = await db
      .insert(ideas)
      .values({
        title,
        content,
        authorId: authResult.user.userId,
      })
      .returning();

    // Handle tags if provided
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      for (const tagName of tagNames) {
        // Find or create tag
        let [tag] = await db
          .select()
          .from(tags)
          .where(eq(tags.name, tagName.toLowerCase()))
          .limit(1);

        if (!tag) {
          [tag] = await db
            .insert(tags)
            .values({ name: tagName.toLowerCase() })
            .returning();
        }

        // Link idea to tag
        await db.insert(ideaTags).values({
          ideaId: newIdea.id,
          tagId: tag.id,
        });

        // Increment tag use count
        await db
          .update(tags)
          .set({ useCount: sql`${tags.useCount} + 1` })
          .where(eq(tags.id, tag.id));
      }
    }

    return new Response(
      JSON.stringify({ idea: newIdea }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create idea error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create idea" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get all ideas
export async function handleGetIdeas(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const allIdeas = await db
      .select({
        id: ideas.id,
        title: ideas.title,
        content: ideas.content,
        score: ideas.score,
        viewCount: ideas.viewCount,
        isPinned: ideas.isPinned,
        isClosed: ideas.isClosed,
        createdAt: ideas.createdAt,
        updatedAt: ideas.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          reputation: users.reputation,
        },
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.authorId, users.id))
      .orderBy(desc(ideas.isPinned), desc(ideas.createdAt))
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({ ideas: allIdeas, limit, offset }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get ideas error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get ideas" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get single idea by ID
export async function handleGetIdea(req: Request, ideaId: number): Promise<Response> {
  try {
    const [idea] = await db
      .select({
        id: ideas.id,
        title: ideas.title,
        content: ideas.content,
        score: ideas.score,
        viewCount: ideas.viewCount,
        isPinned: ideas.isPinned,
        isClosed: ideas.isClosed,
        isMarked: ideas.isMarked,
        createdAt: ideas.createdAt,
        updatedAt: ideas.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          reputation: users.reputation,
        },
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.authorId, users.id))
      .where(eq(ideas.id, ideaId))
      .limit(1);

    if (!idea) {
      return new Response(
        JSON.stringify({ error: "Idea not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Increment view count
    await db
      .update(ideas)
      .set({ viewCount: sql`${ideas.viewCount} + 1` })
      .where(eq(ideas.id, ideaId));

    return new Response(
      JSON.stringify({ idea }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get idea error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get idea" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Update idea
export async function handleUpdateIdea(req: Request, ideaId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { title, content } = await req.json();

    // Check if user owns the idea
    const [idea] = await db
      .select()
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);

    if (!idea) {
      return new Response(
        JSON.stringify({ error: "Idea not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (idea.authorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to edit this idea" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (idea.isMarked) {
      return new Response(
        JSON.stringify({ error: "This content has been reviewed by a moderator and cannot be edited" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update idea
    const [updatedIdea] = await db
      .update(ideas)
      .set({
        title: title || undefined,
        content: content || undefined,
        updatedAt: new Date(),
      })
      .where(eq(ideas.id, ideaId))
      .returning();

    return new Response(
      JSON.stringify({ idea: updatedIdea }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update idea error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update idea" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Delete idea
export async function handleDeleteIdea(req: Request, ideaId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    // Check if user owns the idea
    const [idea] = await db
      .select()
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);

    if (!idea) {
      return new Response(
        JSON.stringify({ error: "Idea not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (idea.authorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to delete this idea" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete idea (cascades to comments, votes, etc.)
    await db.delete(ideas).where(eq(ideas.id, ideaId));

    return new Response(
      JSON.stringify({ message: "Idea deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delete idea error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete idea" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
