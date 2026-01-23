import { db } from "../db";
import { postVotes, commentVotes, posts, comments, users } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

// Vote on a post
export async function handleVotePost(req: Request, postId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { value } = await req.json();

    // Validate vote value (1 for upvote, -1 for downvote)
    if (value !== 1 && value !== -1) {
      return new Response(
        JSON.stringify({ error: "Vote value must be 1 (upvote) or -1 (downvote)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if post exists
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for existing vote
    const [existingVote] = await db
      .select()
      .from(postVotes)
      .where(and(
        eq(postVotes.postId, postId),
        eq(postVotes.userId, authResult.user.userId)
      ))
      .limit(1);

    if (existingVote) {
      if (existingVote.value === value) {
        // Remove vote if same value (toggle off)
        await db
          .delete(postVotes)
          .where(eq(postVotes.id, existingVote.id));

        // Update post score
        await db
          .update(posts)
          .set({ score: sql`${posts.score} - ${value}` })
          .where(eq(posts.id, postId));

        return new Response(
          JSON.stringify({ message: "Vote removed", score: post.score - value }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Update vote to opposite value
        await db
          .update(postVotes)
          .set({ value })
          .where(eq(postVotes.id, existingVote.id));

        // Update post score (swing of 2 points)
        await db
          .update(posts)
          .set({ score: sql`${posts.score} + ${value * 2}` })
          .where(eq(posts.id, postId));

        return new Response(
          JSON.stringify({ message: "Vote updated", score: post.score + (value * 2) }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Create new vote
    await db.insert(postVotes).values({
      postId,
      userId: authResult.user.userId,
      value,
    });

    // Update post score
    await db
      .update(posts)
      .set({ score: sql`${posts.score} + ${value}` })
      .where(eq(posts.id, postId));

    return new Response(
      JSON.stringify({ message: "Vote recorded", score: post.score + value }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Vote post error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to vote on post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Vote on a comment
export async function handleVoteComment(req: Request, commentId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { value } = await req.json();

    // Validate vote value
    if (value !== 1 && value !== -1) {
      return new Response(
        JSON.stringify({ error: "Vote value must be 1 (upvote) or -1 (downvote)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if comment exists
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

    // Check for existing vote
    const [existingVote] = await db
      .select()
      .from(commentVotes)
      .where(and(
        eq(commentVotes.commentId, commentId),
        eq(commentVotes.userId, authResult.user.userId)
      ))
      .limit(1);

    if (existingVote) {
      if (existingVote.value === value) {
        // Remove vote if same value (toggle off)
        await db
          .delete(commentVotes)
          .where(eq(commentVotes.id, existingVote.id));

        // Update comment score
        await db
          .update(comments)
          .set({ score: sql`${comments.score} - ${value}` })
          .where(eq(comments.id, commentId));

        return new Response(
          JSON.stringify({ message: "Vote removed", score: comment.score - value }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Update vote to opposite value
        await db
          .update(commentVotes)
          .set({ value })
          .where(eq(commentVotes.id, existingVote.id));

        // Update comment score (swing of 2 points)
        await db
          .update(comments)
          .set({ score: sql`${comments.score} + ${value * 2}` })
          .where(eq(comments.id, commentId));

        return new Response(
          JSON.stringify({ message: "Vote updated", score: comment.score + (value * 2) }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Create new vote
    await db.insert(commentVotes).values({
      commentId,
      userId: authResult.user.userId,
      value,
    });

    // Update comment score
    await db
      .update(comments)
      .set({ score: sql`${comments.score} + ${value}` })
      .where(eq(comments.id, commentId));

    return new Response(
      JSON.stringify({ message: "Vote recorded", score: comment.score + value }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Vote comment error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to vote on comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get user's vote on a post
export async function handleGetPostVote(req: Request, postId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const [vote] = await db
      .select()
      .from(postVotes)
      .where(and(
        eq(postVotes.postId, postId),
        eq(postVotes.userId, authResult.user.userId)
      ))
      .limit(1);

    return new Response(
      JSON.stringify({ vote: vote?.value || null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get post vote error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get vote" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
