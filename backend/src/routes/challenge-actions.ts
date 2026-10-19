import { db } from "../db";
import { challenges, challengeActionVotes, challengeActions, users } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";

// The community actions people can recommend for a challenge.
export const ACTION_KEYS = ["legal", "economic", "direct", "policy", "info"] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const isActionKey = (key: string): key is ActionKey => (ACTION_KEYS as readonly string[]).includes(key);

async function loadActions(challengeId: number, userId: number | null) {
  const [counts, mine, active] = await Promise.all([
    db
      .select({ actionKey: challengeActionVotes.actionKey, votes: sql<number>`count(*)::int` })
      .from(challengeActionVotes)
      .where(eq(challengeActionVotes.challengeId, challengeId))
      .groupBy(challengeActionVotes.actionKey),
    userId == null
      ? Promise.resolve([] as { actionKey: string }[])
      : db
          .select({ actionKey: challengeActionVotes.actionKey })
          .from(challengeActionVotes)
          .where(and(eq(challengeActionVotes.challengeId, challengeId), eq(challengeActionVotes.userId, userId))),
    db
      .select({ actionKey: challengeActions.actionKey, activatedAt: challengeActions.activatedAt })
      .from(challengeActions)
      .where(eq(challengeActions.challengeId, challengeId)),
  ]);

  const voteCount = new Map(counts.map(c => [c.actionKey, c.votes]));
  const voted = new Set(mine.map(m => m.actionKey));
  const activatedAt = new Map(active.map(a => [a.actionKey, a.activatedAt]));

  return ACTION_KEYS.map(key => ({
    key,
    votes: voteCount.get(key) ?? 0,
    voted: voted.has(key),
    activated: activatedAt.has(key),
    activatedAt: activatedAt.get(key) ?? null,
  }));
}

// GET /api/challenges/:id/actions
export async function handleGetChallengeActions(req: Request, challengeId: number): Promise<Response> {
  const auth = await optionalAuth(req);
  try {
    const [challenge] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return json({ error: "Challenge not found" }, 404);
    return json({ actions: await loadActions(challengeId, auth.user?.userId ?? null) });
  } catch (error) {
    console.error("Get challenge actions error:", error);
    return json({ error: "Failed to load actions" }, 500);
  }
}

// POST /api/challenges/:id/actions/:key/vote  (toggles the caller's recommendation)
export async function handleVoteChallengeAction(req: Request, challengeId: number, key: string): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!isActionKey(key)) return json({ error: "Unknown action" }, 404);

  try {
    const [challenge] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return json({ error: "Challenge not found" }, 404);

    const userId = auth.user.userId;
    const removed = await db
      .delete(challengeActionVotes)
      .where(and(
        eq(challengeActionVotes.challengeId, challengeId),
        eq(challengeActionVotes.actionKey, key),
        eq(challengeActionVotes.userId, userId),
      ))
      .returning({ userId: challengeActionVotes.userId });

    if (removed.length === 0) {
      // onConflictDoNothing keeps a double click from erroring on the primary key
      await db.insert(challengeActionVotes).values({ challengeId, actionKey: key, userId }).onConflictDoNothing();
    }

    const action = (await loadActions(challengeId, userId)).find(a => a.key === key)!;
    return json({ message: removed.length ? "Recommendation removed" : "Recommendation recorded", action });
  } catch (error) {
    console.error("Vote challenge action error:", error);
    return json({ error: "Failed to record recommendation" }, 500);
  }
}

// PUT /api/challenges/:id/actions/:key/activation  { active: boolean }
// Only a site admin or the challenge's creator may switch an action on or off.
export async function handleSetChallengeActionActivation(req: Request, challengeId: number, key: string): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!isActionKey(key)) return json({ error: "Unknown action" }, 404);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.active !== "boolean") {
      return json({ error: "Body must be { active: boolean }" }, 400);
    }

    const [challenge] = await db
      .select({ id: challenges.id, creatorId: challenges.creatorId })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);
    if (!challenge) return json({ error: "Challenge not found" }, 404);

    const userId = auth.user.userId;
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.isAdmin && challenge.creatorId !== userId) {
      return json({ error: "Only the challenge creator or an admin can activate actions" }, 403);
    }

    if (body.active) {
      await db.insert(challengeActions).values({ challengeId, actionKey: key, activatedBy: userId }).onConflictDoNothing();
    } else {
      await db.delete(challengeActions).where(and(eq(challengeActions.challengeId, challengeId), eq(challengeActions.actionKey, key)));
    }

    const action = (await loadActions(challengeId, userId)).find(a => a.key === key)!;
    return json({ message: body.active ? "Action activated" : "Action deactivated", action });
  } catch (error) {
    console.error("Set challenge action activation error:", error);
    return json({ error: "Failed to update action" }, 500);
  }
}
