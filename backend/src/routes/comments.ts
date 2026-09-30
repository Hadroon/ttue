import { db } from "../db";
import { comments, users, ideas, challenges, challengeDrafts, commentVotes } from "../db/schema";
import { eq, desc, asc, and, sql, isNull, inArray, type SQL } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";

// Create new comment
export async function handleCreateComment(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { content, ideaId, challengeId, draftId, parentId } = await req.json();

    // Validate input — must have content and exactly one target
    if (!content || [ideaId, challengeId, draftId].filter(Boolean).length !== 1) {
      return new Response(
        JSON.stringify({ error: "Content and exactly one of ideaId, challengeId or draftId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (parentId) {
      const [parent] = await db
        .select({ ideaId: comments.ideaId, challengeId: comments.challengeId, draftId: comments.draftId })
        .from(comments)
        .where(eq(comments.id, parentId))
        .limit(1);

      if (
        !parent ||
        (parent.ideaId ?? null) !== (ideaId || null) ||
        (parent.challengeId ?? null) !== (challengeId || null) ||
        (parent.draftId ?? null) !== (draftId || null)
      ) {
        return new Response(
          JSON.stringify({ error: "Parent comment not found in this thread" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (draftId) {
      const [draft] = await db
        .select({ id: challengeDrafts.id })
        .from(challengeDrafts)
        .where(eq(challengeDrafts.id, draftId))
        .limit(1);

      if (!draft) {
        return new Response(
          JSON.stringify({ error: "Draft not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (ideaId) {
      // Validate the idea exists and is not marked
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
    }

    if (challengeId) {
      // Validate the challenge exists
      const [challenge] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, challengeId))
        .limit(1);

      if (!challenge) {
        return new Response(
          JSON.stringify({ error: "Challenge not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      if (challenge.isMarked) {
        return new Response(
          JSON.stringify({ error: "This content has been reviewed by a moderator and cannot be commented on" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Create comment
    const [newComment] = await db
      .insert(comments)
      .values({
        content,
        ideaId: ideaId || null,
        challengeId: challengeId || null,
        draftId: draftId || null,
        authorId: authResult.user.userId,
        parentId: parentId || null,
      })
      .returning();

    // Fetch author info to return in response
    const [author] = await db
      .select({ username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, authResult.user.userId))
      .limit(1);

    return new Response(
      JSON.stringify({ comment: { ...newComment, authorUsername: author?.username, authorDisplayName: author?.displayName, authorAvatarUrl: author?.avatarUrl } }),
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

export type CommentThread = "idea" | "challenge" | "draft";

const threadColumns = {
  idea: comments.ideaId,
  challenge: comments.challengeId,
  draft: comments.draftId,
} as const;

// Get a comment thread: paginated top-level comments (sorted) plus all their replies
export async function handleGetThreadComments(req: Request, thread: CommentThread, entityId: number): Promise<Response> {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20') || 20));
    const offset = (page - 1) * limit;
    const sort = url.searchParams.get('sort') || 'recent';
    const { user } = await optionalAuth(req);

    const replyCount = sql<number>`(select count(*)::int from ${comments} as r where r.parent_id = ${comments.id})`;
    const orderBy: Record<string, SQL[]> = {
      recent: [desc(comments.createdAt), desc(comments.id)],
      oldest: [asc(comments.createdAt), asc(comments.id)],
      votes: [desc(comments.score), desc(comments.createdAt), desc(comments.id)],
      replies: [desc(replyCount), desc(comments.createdAt), desc(comments.id)],
    };

    const commentFields = {
      id: comments.id,
      content: comments.content,
      ideaId: comments.ideaId,
      challengeId: comments.challengeId,
      draftId: comments.draftId,
      parentId: comments.parentId,
      score: comments.score,
      isAccepted: comments.isAccepted,
      isMarked: comments.isMarked,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    };

    const topLevelWhere = and(eq(threadColumns[thread], entityId), isNull(comments.parentId));

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(comments)
      .where(topLevelWhere);

    const topLevel = await db
      .select({ ...commentFields, replyCount })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(topLevelWhere)
      .orderBy(...(orderBy[sort] ?? orderBy.recent))
      .limit(limit)
      .offset(offset);

    const replies = topLevel.length
      ? await db
          .select(commentFields)
          .from(comments)
          .leftJoin(users, eq(comments.authorId, users.id))
          .where(inArray(comments.parentId, topLevel.map(c => c.id)))
          .orderBy(asc(comments.createdAt))
      : [];

    const all = [...topLevel, ...replies];
    let votedIds = new Set<number>();
    if (user && all.length) {
      const votes = await db
        .select({ commentId: commentVotes.commentId })
        .from(commentVotes)
        .where(and(eq(commentVotes.userId, user.userId), inArray(commentVotes.commentId, all.map(c => c.id))));
      votedIds = new Set(votes.map(v => v.commentId));
    }

    return new Response(
      JSON.stringify({
        comments: all.map(c => ({ ...c, voted: votedIds.has(c.id) })),
        total,
        page,
        limit,
        hasNext: offset + topLevel.length < total,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Get ${thread} comments error:`, error);
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
