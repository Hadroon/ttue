import { db } from "../db";
import { comments, users, ideas } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

// Create new comment
export async function handleCreateComment(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { content, ideaId, parentId } = await req.json();

    // Validate input
    if (!content || !ideaId) {
      return new Response(
        JSON.stringify({ error: "Content and ideaId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if idea exists
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

    if (idea.isMarked) {
      return new Response(
        JSON.stringify({ error: "This content has been reviewed by a moderator and cannot be commented on" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create comment
    const [newComment] = await db
      .insert(comments)
      .values({
        content,
        ideaId,
        authorId: authResult.user.userId,
        parentId: parentId || null,
      })
      .returning();

    return new Response(
      JSON.stringify({ comment: newComment }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create comment error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get comments for an idea
export async function handleGetComments(req: Request, ideaId: number): Promise<Response> {
  try {
    const allComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        ideaId: comments.ideaId,
        parentId: comments.parentId,
        score: comments.score,
        isAccepted: comments.isAccepted,
        isMarked: comments.isMarked,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          reputation: users.reputation,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.ideaId, ideaId))
      .orderBy(desc(comments.isAccepted), desc(comments.score), comments.createdAt);

    return new Response(
      JSON.stringify({ comments: allComments }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get comments error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get comments" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Update comment
export async function handleUpdateComment(req: Request, commentId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { content } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user owns the comment
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!comment) {
      return new Response(
        JSON.stringify({ error: "Comment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (comment.authorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to edit this comment" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (comment.isMarked) {
      return new Response(
        JSON.stringify({ error: "This content has been reviewed by a moderator and cannot be edited" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update comment
    const [updatedComment] = await db
      .update(comments)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
      .returning();

    return new Response(
      JSON.stringify({ comment: updatedComment }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update comment error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Delete comment
export async function handleDeleteComment(req: Request, commentId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    // Check if user owns the comment
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!comment) {
      return new Response(
        JSON.stringify({ error: "Comment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (comment.authorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to delete this comment" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete comment (cascades to child comments)
    await db.delete(comments).where(eq(comments.id, commentId));

    return new Response(
      JSON.stringify({ message: "Comment deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delete comment error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Accept comment as answer (post author only)
export async function handleAcceptComment(req: Request, commentId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    // Get comment and post
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!comment) {
      return new Response(
        JSON.stringify({ error: "Comment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.postId))
      .limit(1);

    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Only post author can accept answers
    if (post.authorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "Only the post author can accept answers" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Unaccept all other comments on this post
    await db
      .update(comments)
      .set({ isAccepted: false })
      .where(eq(comments.postId, comment.postId));

    // Accept this comment
    const [updatedComment] = await db
      .update(comments)
      .set({ isAccepted: true })
      .where(eq(comments.id, commentId))
      .returning();

    return new Response(
      JSON.stringify({ comment: updatedComment }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Accept comment error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to accept comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
