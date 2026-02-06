import { db } from "../db";
import { ideaVotes, commentVotes, ideas, comments, users } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

// Vote on an idea
export async function handleVoteIdea(req: Request, ideaId: number): Promise<Response> {
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

    // Check for existing vote
    const [existingVote] = await db
      .select()
      .from(ideaVotes)
      .where(and(
        eq(ideaVotes.ideaId, ideaId),
        eq(ideaVotes.userId, authResult.user.userId)
      ))
      .limit(1);

    if (existingVote) {
      if (existingVote.value === value) {
        // Remove vote if same value (toggle off)
        await db
          .delete(ideaVotes)
          .where(eq(ideaVotes.id, existingVote.id));

        // Update idea score
        await db
          .update(ideas)
          .set({ score: sql`${ideas.score} - ${value}` })
          .where(eq(ideas.id, ideaId));

        return new Response(
          JSON.stringify({ message: "Vote removed", score: idea.score - value, voted: false }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Update vote to opposite value
        await db
          .update(ideaVotes)
          .set({ value })
          .where(eq(ideaVotes.id, existingVote.id));

        // Update idea score (swing of 2 points)
        await db
          .update(ideas)
          .set({ score: sql`${ideas.score} + ${value * 2}` })
          .where(eq(ideas.id, ideaId));

        return new Response(
          JSON.stringify({ message: "Vote updated", score: idea.score + (value * 2), voted: true }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Create new vote
    await db.insert(ideaVotes).values({
      ideaId,
      userId: authResult.user.userId,
      value,
    });

    // Update idea score
    await db
      .update(ideas)
      .set({ score: sql`${ideas.score} + ${value}` })
      .where(eq(ideas.id, ideaId));

    return new Response(
      JSON.stringify({ message: "Vote recorded", score: idea.score + value, voted: true }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Vote idea error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to vote on idea" }),
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
          JSON.stringify({ message: "Vote removed", score: comment.score - value, voted: false }),
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
          JSON.stringify({ message: "Vote updated", score: comment.score + (value * 2), voted: true }),
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
      JSON.stringify({ message: "Vote recorded", score: comment.score + value, voted: true }),
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

// Get user's vote on an idea
export async function handleGetIdeaVote(req: Request, ideaId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const [vote] = await db
      .select()
      .from(ideaVotes)
      .where(and(
        eq(ideaVotes.ideaId, ideaId),
        eq(ideaVotes.userId, authResult.user.userId)
      ))
      .limit(1);

    return new Response(
      JSON.stringify({ vote: vote?.value || null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get idea vote error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get vote" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
