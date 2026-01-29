import { db } from "../db";
import { challenges, challengeVotes } from "../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";

// Get all challenges
export async function handleGetChallenges(req: Request): Promise<Response> {
  const authResult = await optionalAuth(req);
  const userId = authResult instanceof Response ? null : (authResult.user?.userId ?? null);

  try {
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
        createdAt: challenges.createdAt,
        updatedAt: challenges.updatedAt,
      })
      .from(challenges)
      .orderBy(desc(challenges.votes), desc(challenges.createdAt));

    // If user is authenticated, check which challenges they've voted on
    let userVotes: number[] = [];
    if (userId) {
      const votes = await db
        .select({ challengeId: challengeVotes.challengeId })
        .from(challengeVotes)
        .where(eq(challengeVotes.userId, userId));
      userVotes = votes.map(v => v.challengeId);
    }

    // Add voted flag to challenges
    const challengesWithVotes = allChallenges.map(challenge => ({
      ...challenge,
      voted: userVotes.includes(challenge.id),
    }));

    return new Response(
      JSON.stringify(challengesWithVotes),
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
