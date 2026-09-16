import { db } from "../db";
import { ideaVotes, commentVotes, ideas, comments } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../middleware/auth";
import { applyReputationChange, getVoteDelta, resolveContentDomainId } from "../services/reputation";

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

    const result = await db.transaction(async (tx) => {
      const [idea] = await tx
        .select()
        .from(ideas)
        .where(eq(ideas.id, ideaId))
        .limit(1)
        .for("update");

      if (!idea) {
        return { status: 404, body: { error: "Idea not found" } };
      }

      if (idea.isMarked) {
        return { status: 403, body: { error: "This content has been reviewed by a moderator and cannot be voted on" } };
      }

      if (idea.authorId === authResult.user.userId) {
        return { status: 403, body: { error: "You cannot vote on your own content" } };
      }

      const [existingVote] = await tx
        .select()
        .from(ideaVotes)
        .where(and(
          eq(ideaVotes.ideaId, ideaId),
          eq(ideaVotes.userId, authResult.user.userId)
        ))
        .limit(1);

      const nextValue = existingVote?.value === value ? null : value;
      const reputationDelta = getVoteDelta(existingVote?.value ?? null, nextValue);

      if (existingVote && nextValue == null) {
        await tx.delete(ideaVotes).where(eq(ideaVotes.id, existingVote.id));
      } else if (existingVote) {
        await tx.update(ideaVotes).set({ value }).where(eq(ideaVotes.id, existingVote.id));
      } else {
        await tx.insert(ideaVotes).values({
          ideaId,
          userId: authResult.user.userId,
          value,
        });
      }

      await tx
        .update(ideas)
        .set({ score: sql`${ideas.score} + ${reputationDelta}` })
        .where(eq(ideas.id, ideaId));

      const domainId = await resolveContentDomainId(tx, idea.challengeId);
      await applyReputationChange(tx, {
        userId: idea.authorId,
        actorId: authResult.user.userId,
        domainId,
        amount: reputationDelta,
        actionType: "IDEA_VOTE",
        contentType: "idea",
        contentId: ideaId,
      });

      return {
        status: existingVote ? 200 : 201,
        body: {
          message: nextValue == null ? "Vote removed" : existingVote ? "Vote updated" : "Vote recorded",
          score: idea.score + reputationDelta,
          voted: nextValue != null,
        },
      };
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
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

    const result = await db.transaction(async (tx) => {
      const [comment] = await tx
        .select()
        .from(comments)
        .where(eq(comments.id, commentId))
        .limit(1)
        .for("update");

      if (!comment) {
        return { status: 404, body: { error: "Comment not found" } };
      }

      if (comment.isMarked) {
        return { status: 403, body: { error: "This content has been reviewed by a moderator and cannot be voted on" } };
      }

      if (comment.authorId === authResult.user.userId) {
        return { status: 403, body: { error: "You cannot vote on your own content" } };
      }

      const [existingVote] = await tx
        .select()
        .from(commentVotes)
        .where(and(
          eq(commentVotes.commentId, commentId),
          eq(commentVotes.userId, authResult.user.userId)
        ))
        .limit(1);

      const nextValue = existingVote?.value === value ? null : value;
      const reputationDelta = getVoteDelta(existingVote?.value ?? null, nextValue);

      if (existingVote && nextValue == null) {
        await tx.delete(commentVotes).where(eq(commentVotes.id, existingVote.id));
      } else if (existingVote) {
        await tx.update(commentVotes).set({ value }).where(eq(commentVotes.id, existingVote.id));
      } else {
        await tx.insert(commentVotes).values({
          commentId,
          userId: authResult.user.userId,
          value,
        });
      }

      await tx
        .update(comments)
        .set({ score: sql`${comments.score} + ${reputationDelta}` })
        .where(eq(comments.id, commentId));

      const domainId = await resolveContentDomainId(tx, comment.challengeId, comment.ideaId);
      await applyReputationChange(tx, {
        userId: comment.authorId,
        actorId: authResult.user.userId,
        domainId,
        amount: reputationDelta,
        actionType: "COMMENT_VOTE",
        contentType: "comment",
        contentId: commentId,
      });

      return {
        status: existingVote ? 200 : 201,
        body: {
          message: nextValue == null ? "Vote removed" : existingVote ? "Vote updated" : "Vote recorded",
          score: comment.score + reputationDelta,
          voted: nextValue != null,
        },
      };
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
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
