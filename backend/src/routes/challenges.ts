import { db } from "../db";
import { challenges, challengeVotes, ideas, comments, users, ideaVotes, commentVotes, challengeDrafts, challengeDraftRevisions, challengeDraftProposals } from "../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";

// Get all challenges with top idea and comments
export async function handleGetChallenges(req: Request): Promise<Response> {
  const authResult = await optionalAuth(req);
  const userId = authResult instanceof Response ? null : (authResult.user?.userId ?? null);

  try {
    // Parse pagination parameters from query string
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const allChallenges = await db
      .select({
        id: challenges.id,
        category: challenges.category,
        title: challenges.title,
        description: challenges.description,
        urgency: challenges.urgency,
        participantCount: challenges.participantCount,
        rewardPool: challenges.rewardPool,
        deadline: challenges.deadline,
        tags: challenges.tags,
        votes: challenges.votes,
        isMarked: challenges.isMarked,
        createdAt: challenges.createdAt,
        updatedAt: challenges.updatedAt,
      })
      .from(challenges)
      .orderBy(desc(challenges.votes), desc(challenges.createdAt))
      .limit(limit)
      .offset(offset);

    // If user is authenticated, check which items they've voted on
    let userVotedChallengeIds: number[] = [];
    let userVotedIdeaIds: number[] = [];
    let userVotedCommentIds: number[] = [];
    
    if (userId) {
      const challengeVotesData = await db
        .select({ challengeId: challengeVotes.challengeId })
        .from(challengeVotes)
        .where(eq(challengeVotes.userId, userId));
      userVotedChallengeIds = challengeVotesData.map(v => v.challengeId);

      const ideaVotesData = await db
        .select({ ideaId: ideaVotes.ideaId })
        .from(ideaVotes)
        .where(eq(ideaVotes.userId, userId));
      userVotedIdeaIds = ideaVotesData.map(v => v.ideaId);

      const commentVotesData = await db
        .select({ commentId: commentVotes.commentId })
        .from(commentVotes)
        .where(eq(commentVotes.userId, userId));
      userVotedCommentIds = commentVotesData.map(v => v.commentId);
    }

    // Build challenge data with top idea and comments
    const challengesWithData = await Promise.all(
      allChallenges.map(async (challenge) => {
        const voted = userVotedChallengeIds.includes(challenge.id);

        // Get the most voted idea (post) for this challenge
        const topIdeas = await db
          .select({
            id: ideas.id,
            title: ideas.title,
            content: ideas.content,
            authorId: ideas.authorId,
            challengeId: ideas.challengeId,
            score: ideas.score,
            viewCount: ideas.viewCount,
            isPinned: ideas.isPinned,
            isClosed: ideas.isClosed,
            isMarked: ideas.isMarked,
            createdAt: ideas.createdAt,
            updatedAt: ideas.updatedAt,
            authorUsername: users.username,
            authorDisplayName: users.displayName,
            authorAvatarUrl: users.avatarUrl,
          })
          .from(ideas)
          .innerJoin(users, eq(ideas.authorId, users.id))
          .where(eq(ideas.challengeId, challenge.id))
          .orderBy(desc(ideas.score), desc(ideas.createdAt))
          .limit(1);

        let topIdea = null;
        if (topIdeas.length > 0) {
          const idea = topIdeas[0];
          topIdea = {
            ...idea,
            voted: userVotedIdeaIds.includes(idea.id),
          };
        }

        // Get top 3 comments for the top idea
        let challengeComments: any[] = [];
        if (topIdea) {
          const commentsData = await db
            .select({
              id: comments.id,
              content: comments.content,
              ideaId: comments.ideaId,
              authorId: comments.authorId,
              parentId: comments.parentId,
              score: comments.score,
              isAccepted: comments.isAccepted,
              isMarked: comments.isMarked,
              createdAt: comments.createdAt,
              updatedAt: comments.updatedAt,
              authorUsername: users.username,
              authorDisplayName: users.displayName,
              authorAvatarUrl: users.avatarUrl,
            })
            .from(comments)
            .innerJoin(users, eq(comments.authorId, users.id))
            .where(eq(comments.ideaId, topIdea.id))
            .orderBy(desc(comments.score), desc(comments.createdAt))
            .limit(3);
          
          // Add voted status to comments
          challengeComments = commentsData.map(comment => ({
            ...comment,
            voted: userVotedCommentIds.includes(comment.id),
          }));
        }

        return {
          challenge: {
            ...challenge,
            voted,
          },
          topIdea,
          comments: challengeComments,
        };
      })
    );

    return new Response(
      JSON.stringify(challengesWithData),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching challenges:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch challenges" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Create new challenge
export async function handleCreateChallenge(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { category, title, description, urgency, rewardPool, deadline, tags: tagList } = await req.json();

    // Validate input
    if (!category || !title || !description || !urgency) {
      return new Response(
        JSON.stringify({ error: "Category, title, description, and urgency are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate urgency value
    const validUrgencies = ['Low', 'Medium', 'High', 'Critical'];
    if (!validUrgencies.includes(urgency)) {
      return new Response(
        JSON.stringify({ error: "Invalid urgency value. Must be Low, Medium, High, or Critical" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create challenge
    const [newChallenge] = await db
      .insert(challenges)
      .values({
        category,
        title,
        description,
        urgency,
        rewardPool: rewardPool || null,
        deadline: deadline ? new Date(deadline) : null,
        tags: tagList || [],
        participantCount: 0,
        votes: 0,
      })
      .returning();

    return new Response(
      JSON.stringify(newChallenge),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating challenge:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create challenge" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Vote on challenge
export async function handleVoteChallenge(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { challengeId } = await req.json();

    if (!challengeId) {
      return new Response(
        JSON.stringify({ error: "Challenge ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if challenge is marked
    const [challenge] = await db
      .select({ isMarked: challenges.isMarked })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (challenge?.isMarked) {
      return new Response(
        JSON.stringify({ error: "This content has been reviewed by a moderator and cannot be voted on" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user already voted
    const existingVote = await db
      .select()
      .from(challengeVotes)
      .where(
        and(
          eq(challengeVotes.challengeId, challengeId),
          eq(challengeVotes.userId, authResult.user.userId)
        )
      )
      .limit(1);

    if (existingVote.length > 0) {
      // Remove vote
      await db
        .delete(challengeVotes)
        .where(
          and(
            eq(challengeVotes.challengeId, challengeId),
            eq(challengeVotes.userId, authResult.user.userId)
          )
        );

      // Decrement challenge votes counter
      await db
        .update(challenges)
        .set({
          votes: sql`${challenges.votes} - 1`,
        })
        .where(eq(challenges.id, challengeId));

      return new Response(
        JSON.stringify({ message: "Vote removed", voted: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      // Add vote
      await db.insert(challengeVotes).values({
        challengeId,
        userId: authResult.user.userId,
        value: 1,
      });

      // Increment challenge votes counter
      await db
        .update(challenges)
        .set({
          votes: sql`${challenges.votes} + 1`,
        })
        .where(eq(challenges.id, challengeId));

      return new Response(
        JSON.stringify({ message: "Vote added", voted: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error voting on challenge:", error);
    return new Response(
      JSON.stringify({ error: "Failed to vote on challenge" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get single challenge by ID
export async function handleGetChallenge(req: Request, challengeId: number): Promise<Response> {
  const authResult = await optionalAuth(req);
  const userId = authResult instanceof Response ? null : (authResult.user?.userId ?? null);

  try {
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

    // Check if user voted on this challenge
    let voted = false;
    if (userId) {
      const vote = await db
        .select()
        .from(challengeVotes)
        .where(
          and(
            eq(challengeVotes.challengeId, challengeId),
            eq(challengeVotes.userId, userId)
          )
        )
        .limit(1);
      voted = vote.length > 0;
    }

    return new Response(
      JSON.stringify({ ...challenge, voted }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching challenge:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch challenge" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get featured challenges (top 3 highest voted) with top idea and comments for each
export async function handleGetFeaturedChallenge(req: Request): Promise<Response> {
  const authResult = await optionalAuth(req);
  const userId = authResult instanceof Response ? null : (authResult.user?.userId ?? null);

  try {
    // Get the top 3 highest voted challenges with minimum 1 vote
    const topChallenges = await db
      .select()
      .from(challenges)
      .where(sql`${challenges.votes} >= 1`)
      .orderBy(desc(challenges.votes), desc(challenges.createdAt))
      .limit(3);

    if (topChallenges.length === 0) {
      return new Response(
        JSON.stringify({ error: "No featured challenges available" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get user's votes for all these challenges
    let userVotedChallengeIds: number[] = [];
    if (userId) {
      const votes = await db
        .select({ challengeId: challengeVotes.challengeId })
        .from(challengeVotes)
        .where(eq(challengeVotes.userId, userId));
      userVotedChallengeIds = votes.map(v => v.challengeId);
    }

    // Get user's votes for ideas and comments if authenticated
    let userVotedIdeaIds: number[] = [];
    let userVotedCommentIds: number[] = [];
    if (userId) {
      const ideaVotesData = await db
        .select({ ideaId: ideaVotes.ideaId })
        .from(ideaVotes)
        .where(eq(ideaVotes.userId, userId));
      userVotedIdeaIds = ideaVotesData.map(v => v.ideaId);

      const commentVotesData = await db
        .select({ commentId: commentVotes.commentId })
        .from(commentVotes)
        .where(eq(commentVotes.userId, userId));
      userVotedCommentIds = commentVotesData.map(v => v.commentId);
    }

    // Build featured data for each challenge
    const featuredChallenges = await Promise.all(
      topChallenges.map(async (challenge) => {
        const voted = userVotedChallengeIds.includes(challenge.id);

        // Get the most voted idea (post) for this challenge
        const topIdeas = await db
          .select({
            id: ideas.id,
            title: ideas.title,
            content: ideas.content,
            authorId: ideas.authorId,
            challengeId: ideas.challengeId,
            score: ideas.score,
            viewCount: ideas.viewCount,
            isPinned: ideas.isPinned,
            isClosed: ideas.isClosed,
            isMarked: ideas.isMarked,
            createdAt: ideas.createdAt,
            updatedAt: ideas.updatedAt,
            authorUsername: users.username,
            authorDisplayName: users.displayName,
            authorAvatarUrl: users.avatarUrl,
          })
          .from(ideas)
          .innerJoin(users, eq(ideas.authorId, users.id))
          .where(eq(ideas.challengeId, challenge.id))
          .orderBy(desc(ideas.score), desc(ideas.createdAt))
          .limit(1);

        let topIdea = null;
        if (topIdeas.length > 0) {
          const idea = topIdeas[0];
          topIdea = {
            ...idea,
            voted: userVotedIdeaIds.includes(idea.id),
          };
        }

        // Get comments for the top idea
        let challengeComments: any[] = [];
        if (topIdea) {
          const commentsData = await db
            .select({
              id: comments.id,
              content: comments.content,
              ideaId: comments.ideaId,
              authorId: comments.authorId,
              parentId: comments.parentId,
              score: comments.score,
              isAccepted: comments.isAccepted,
              isMarked: comments.isMarked,
              createdAt: comments.createdAt,
              updatedAt: comments.updatedAt,
              authorUsername: users.username,
              authorDisplayName: users.displayName,
              authorAvatarUrl: users.avatarUrl,
            })
            .from(comments)
            .innerJoin(users, eq(comments.authorId, users.id))
            .where(eq(comments.ideaId, topIdea.id))
            .orderBy(desc(comments.score), desc(comments.createdAt))
            .limit(10);
          
          // Add voted status to comments
          challengeComments = commentsData.map(comment => ({
            ...comment,
            voted: userVotedCommentIds.includes(comment.id),
          }));
        }

        return {
          challenge: {
            ...challenge,
            voted,
          },
          topIdea,
          comments: challengeComments,
        };
      })
    );

    return new Response(
      JSON.stringify(featuredChallenges),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching featured challenges:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch featured challenges" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Create challenge draft
export async function handleCreateChallengeDraft(req: Request, challengeId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { content } = await req.json();

    // Validate input
    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate content length (max 5000 characters)
    if (content.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Content must be less than 5000 characters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if challenge exists
    const challenge = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (challenge.length === 0) {
      return new Response(
        JSON.stringify({ error: "Challenge not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if draft already exists
    const existingDraft = await db
      .select()
      .from(challengeDrafts)
      .where(eq(challengeDrafts.challengeId, challengeId))
      .limit(1);

    if (existingDraft.length > 0) {
      return new Response(
        JSON.stringify({ error: "A draft already exists for this challenge" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create draft
    const [newDraft] = await db
      .insert(challengeDrafts)
      .values({
        challengeId,
        creatorId: authResult.user.userId,
        content: content.trim(),
      })
      .returning();

    // Get creator username
    const creator = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, authResult.user.userId))
      .limit(1);

    return new Response(
      JSON.stringify({
        ...newDraft,
        creatorUsername: creator[0]?.username || 'Unknown',
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating challenge draft:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create draft" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get challenge draft
export async function handleGetChallengeDraft(req: Request, challengeId: number): Promise<Response> {
  const authResult = await optionalAuth(req);

  try {
    const draft = await db
      .select({
        id: challengeDrafts.id,
        challengeId: challengeDrafts.challengeId,
        creatorId: challengeDrafts.creatorId,
        content: challengeDrafts.content,
        createdAt: challengeDrafts.createdAt,
        updatedAt: challengeDrafts.updatedAt,
        creatorUsername: users.username,
      })
      .from(challengeDrafts)
      .innerJoin(users, eq(challengeDrafts.creatorId, users.id))
      .where(eq(challengeDrafts.challengeId, challengeId))
      .limit(1);

    if (draft.length === 0) {
      return new Response(
        JSON.stringify({ error: "Draft not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(draft[0]),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching challenge draft:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch draft" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Update challenge draft
export async function handleUpdateChallengeDraft(req: Request, challengeId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { content } = await req.json();

    // Validate input
    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate content length (max 5000 characters)
    if (content.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Content must be less than 5000 characters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get existing draft
    const existingDraft = await db
      .select()
      .from(challengeDrafts)
      .where(eq(challengeDrafts.challengeId, challengeId))
      .limit(1);

    if (existingDraft.length === 0) {
      return new Response(
        JSON.stringify({ error: "Draft not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check ownership - non-creators create a proposal instead
    if (existingDraft[0].creatorId !== authResult.user.userId) {
      // Create a proposal for the draft creator to review
      const [proposal] = await db
        .insert(challengeDraftProposals)
        .values({
          draftId: existingDraft[0].id,
          proposerId: authResult.user.userId,
          content: content.trim(),
        })
        .returning();

      // Get proposer username
      const proposer = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, authResult.user.userId))
        .limit(1);

      return new Response(
        JSON.stringify({
          type: 'proposal',
          data: {
            ...proposal,
            proposerUsername: proposer[0]?.username || 'Unknown',
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save current version to revision history
    await db
      .insert(challengeDraftRevisions)
      .values({
        draftId: existingDraft[0].id,
        editorId: authResult.user.userId,
        content: existingDraft[0].content,
      });

    // Update draft
    const [updatedDraft] = await db
      .update(challengeDrafts)
      .set({
        content: content.trim(),
        updatedAt: new Date(),
      })
      .where(eq(challengeDrafts.challengeId, challengeId))
      .returning();

    // Get creator username
    const creator = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, updatedDraft.creatorId))
      .limit(1);

    return new Response(
      JSON.stringify({
        ...updatedDraft,
        creatorUsername: creator[0]?.username || 'Unknown',
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating challenge draft:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update draft" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get challenge draft revision history
export async function handleGetChallengeDraftRevisions(req: Request, challengeId: number): Promise<Response> {
  const authResult = await optionalAuth(req);

  try {
    // Get draft ID for this challenge
    const draft = await db
      .select({ id: challengeDrafts.id })
      .from(challengeDrafts)
      .where(eq(challengeDrafts.challengeId, challengeId))
      .limit(1);

    if (draft.length === 0) {
      return new Response(
        JSON.stringify({ error: "Draft not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get all revisions
    const revisions = await db
      .select({
        id: challengeDraftRevisions.id,
        draftId: challengeDraftRevisions.draftId,
        editorId: challengeDraftRevisions.editorId,
        content: challengeDraftRevisions.content,
        createdAt: challengeDraftRevisions.createdAt,
        editorUsername: users.username,
      })
      .from(challengeDraftRevisions)
      .innerJoin(users, eq(challengeDraftRevisions.editorId, users.id))
      .where(eq(challengeDraftRevisions.draftId, draft[0].id))
      .orderBy(desc(challengeDraftRevisions.createdAt));

    return new Response(
      JSON.stringify(revisions),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching draft revisions:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch revisions" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get draft proposals (pending, for draft creator)
export async function handleGetDraftProposals(req: Request, challengeId: number): Promise<Response> {
  const authResult = await optionalAuth(req);

  try {
    // Get draft for this challenge
    const draft = await db
      .select({ id: challengeDrafts.id, creatorId: challengeDrafts.creatorId })
      .from(challengeDrafts)
      .where(eq(challengeDrafts.challengeId, challengeId))
      .limit(1);

    if (draft.length === 0) {
      return new Response(
        JSON.stringify({ error: "Draft not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get all proposals (pending first, then resolved)
    const proposals = await db
      .select({
        id: challengeDraftProposals.id,
        draftId: challengeDraftProposals.draftId,
        proposerId: challengeDraftProposals.proposerId,
        content: challengeDraftProposals.content,
        status: challengeDraftProposals.status,
        resolvedAt: challengeDraftProposals.resolvedAt,
        createdAt: challengeDraftProposals.createdAt,
        proposerUsername: users.username,
      })
      .from(challengeDraftProposals)
      .innerJoin(users, eq(challengeDraftProposals.proposerId, users.id))
      .where(eq(challengeDraftProposals.draftId, draft[0].id))
      .orderBy(desc(challengeDraftProposals.createdAt));

    return new Response(
      JSON.stringify(proposals),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching draft proposals:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch proposals" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Resolve a draft proposal (accept or reject) - only draft creator
export async function handleResolveDraftProposal(req: Request, challengeId: number, proposalId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { action, editedContent } = await req.json(); // 'accept' or 'reject', optional editedContent

    if (!action || !['accept', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Action must be 'accept' or 'reject'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get draft and verify creator
    const draft = await db
      .select()
      .from(challengeDrafts)
      .where(eq(challengeDrafts.challengeId, challengeId))
      .limit(1);

    if (draft.length === 0) {
      return new Response(
        JSON.stringify({ error: "Draft not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (draft[0].creatorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "Only the draft creator can resolve proposals" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the proposal
    const proposal = await db
      .select()
      .from(challengeDraftProposals)
      .where(and(
        eq(challengeDraftProposals.id, proposalId),
        eq(challengeDraftProposals.draftId, draft[0].id),
      ))
      .limit(1);

    if (proposal.length === 0) {
      return new Response(
        JSON.stringify({ error: "Proposal not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (proposal[0].status !== 'pending') {
      return new Response(
        JSON.stringify({ error: "Proposal has already been resolved" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (action === 'accept') {
      // Use editedContent if provided (creator modified the proposal), otherwise use original proposal content
      const mergeContent = (editedContent && editedContent.trim().length > 0)
        ? editedContent.trim()
        : proposal[0].content;

      // Save current draft content to revision history
      await db
        .insert(challengeDraftRevisions)
        .values({
          draftId: draft[0].id,
          editorId: proposal[0].proposerId,
          content: draft[0].content,
        });

      // Update draft with merged content
      await db
        .update(challengeDrafts)
        .set({
          content: mergeContent,
          updatedAt: new Date(),
        })
        .where(eq(challengeDrafts.id, draft[0].id));
    }

    // Mark proposal as resolved
    const [resolved] = await db
      .update(challengeDraftProposals)
      .set({
        status: action === 'accept' ? 'accepted' : 'rejected',
        resolvedAt: new Date(),
      })
      .where(eq(challengeDraftProposals.id, proposalId))
      .returning();

    // Get proposer username
    const proposer = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, resolved.proposerId))
      .limit(1);

    return new Response(
      JSON.stringify({
        ...resolved,
        proposerUsername: proposer[0]?.username || 'Unknown',
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error resolving draft proposal:", error);
    return new Response(
      JSON.stringify({ error: "Failed to resolve proposal" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
