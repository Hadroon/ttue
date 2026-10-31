import { db } from "../db";
import { challengeDrafts, challengeDraftVotes } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function loadSummary(draftId: number, userId: number | null) {
  const [counts] = await db
    .select({
      support: sql<number>`count(*) filter (where ${challengeDraftVotes.value} = 1)::int`,
      oppose: sql<number>`count(*) filter (where ${challengeDraftVotes.value} = -1)::int`,
    })
    .from(challengeDraftVotes)
    .where(eq(challengeDraftVotes.draftId, draftId));

  let myVote: "support" | "oppose" | null = null;
  if (userId != null) {
    const [mine] = await db
      .select({ value: challengeDraftVotes.value })
      .from(challengeDraftVotes)
      .where(and(eq(challengeDraftVotes.draftId, draftId), eq(challengeDraftVotes.userId, userId)))
      .limit(1);
    if (mine) myVote = mine.value === 1 ? "support" : "oppose";
  }

  return { support: counts?.support ?? 0, oppose: counts?.oppose ?? 0, myVote };
}

async function findDraft(challengeId: number) {
  const [draft] = await db
    .select({ id: challengeDrafts.id, creatorId: challengeDrafts.creatorId })
    .from(challengeDrafts)
    .where(eq(challengeDrafts.challengeId, challengeId))
    .limit(1);
  return draft;
}

// GET /api/challenges/:id/draft/votes
export async function handleGetDraftVotes(req: Request, challengeId: number): Promise<Response> {
  const auth = await optionalAuth(req);
  try {
    const draft = await findDraft(challengeId);
    // No draft yet means nothing to vote on, not an error
    if (!draft) return json({ support: 0, oppose: 0, myVote: null });
    return json(await loadSummary(draft.id, auth.user?.userId ?? null));
  } catch (error) {
    console.error("Get draft votes error:", error);
    return json({ error: "Failed to load votes" }, 500);
  }
}

// POST /api/challenges/:id/draft/votes  { choice: 'support' | 'oppose' }
// Repeating the current choice removes the vote; the other choice switches it.
export async function handleVoteDraft(req: Request, challengeId: number): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => null);
    if (!body || (body.choice !== "support" && body.choice !== "oppose")) {
      return json({ error: "Choice must be 'support' or 'oppose'" }, 400);
    }
    const value = body.choice === "support" ? 1 : -1;

    const draft = await findDraft(challengeId);
    if (!draft) return json({ error: "No draft to vote on yet" }, 404);

    const userId = auth.user.userId;
    if (draft.creatorId === userId) {
      return json({ error: "You cannot vote on your own content" }, 403);
    }

    const [existing] = await db
      .select({ value: challengeDraftVotes.value })
      .from(challengeDraftVotes)
      .where(and(eq(challengeDraftVotes.draftId, draft.id), eq(challengeDraftVotes.userId, userId)))
      .limit(1);

    if (existing?.value === value) {
      await db
        .delete(challengeDraftVotes)
        .where(and(eq(challengeDraftVotes.draftId, draft.id), eq(challengeDraftVotes.userId, userId)));
    } else {
      await db
        .insert(challengeDraftVotes)
        .values({ draftId: draft.id, userId, value })
        .onConflictDoUpdate({
          target: [challengeDraftVotes.draftId, challengeDraftVotes.userId],
          set: { value },
        });
    }

    return json({
      message: existing?.value === value ? "Vote removed" : "Vote recorded",
      ...(await loadSummary(draft.id, userId)),
    });
  } catch (error) {
    console.error("Vote draft error:", error);
    return json({ error: "Failed to vote on draft" }, 500);
  }
}
