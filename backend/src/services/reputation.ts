import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { challenges, domains, ideas, reputationAuditLogs, userDomainReputation, users } from "../db/schema";

export const GENERAL_CIVIC_DOMAIN_SLUG = "general-civic";

export const CIVIC_RANKS = [
  { title: "CITIZEN", minimumReputation: 0 },
  { title: "SCRIBE", minimumReputation: 100 },
  { title: "TRIBUNE", minimumReputation: 500 },
  { title: "ARCHON", minimumReputation: 2000 },
] as const;

export type CivicRank = typeof CIVIC_RANKS[number]["title"];

export function getCivicRank(reputation: number): CivicRank {
  for (let index = CIVIC_RANKS.length - 1; index >= 0; index -= 1) {
    if (reputation >= CIVIC_RANKS[index].minimumReputation) {
      return CIVIC_RANKS[index].title;
    }
  }

  return "CITIZEN";
}

export function getNextCivicRank(reputation: number) {
  return CIVIC_RANKS.find((rank) => rank.minimumReputation > reputation) ?? null;
}

export function getVoteDelta(previousValue: number | null, nextValue: number | null): number {
  return (nextValue ?? 0) - (previousValue ?? 0);
}

export function mapCategoryToDomainSlug(category: string): string {
  switch (category.trim().toLowerCase()) {
    case "environment":
      return "climate-ecology";
    case "economy":
    case "housing":
    case "infrastructure":
      return "resource-economy";
    case "technology":
      return "algorithmic-governance";
    case "education":
    case "health":
      return "open-science";
    default:
      return GENERAL_CIVIC_DOMAIN_SLUG;
  }
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface ReputationChange {
  userId: number;
  actorId: number;
  domainId: number;
  amount: number;
  actionType: "IDEA_VOTE" | "COMMENT_VOTE" | "CHALLENGE_VOTE";
  contentType: "idea" | "comment" | "challenge";
  contentId: number;
}

export async function resolveContentDomainId(
  tx: DatabaseTransaction,
  challengeId: number | null,
  ideaId?: number | null,
): Promise<number> {
  let resolvedChallengeId = challengeId;

  if (resolvedChallengeId == null && ideaId != null) {
    const [idea] = await tx
      .select({ challengeId: ideas.challengeId })
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);
    resolvedChallengeId = idea?.challengeId ?? null;
  }

  if (resolvedChallengeId != null) {
    const [challenge] = await tx
      .select({ domainId: challenges.domainId })
      .from(challenges)
      .where(eq(challenges.id, resolvedChallengeId))
      .limit(1);

    if (challenge) {
      return challenge.domainId;
    }
  }

  const [generalDomain] = await tx
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.slug, GENERAL_CIVIC_DOMAIN_SLUG))
    .limit(1);

  if (!generalDomain) {
    throw new Error("General Civic domain is not configured");
  }

  return generalDomain.id;
}

export async function applyReputationChange(
  tx: DatabaseTransaction,
  change: ReputationChange,
): Promise<void> {
  if (change.amount === 0) {
    return;
  }

  const changedAt = new Date();

  await tx
    .update(users)
    .set({
      reputation: sql`${users.reputation} + ${change.amount}`,
      updatedAt: changedAt,
    })
    .where(eq(users.id, change.userId));

  await tx
    .insert(userDomainReputation)
    .values({
      userId: change.userId,
      domainId: change.domainId,
      score: change.amount,
      lastActivityAt: changedAt,
    })
    .onConflictDoUpdate({
      target: [userDomainReputation.userId, userDomainReputation.domainId],
      set: {
        score: sql`${userDomainReputation.score} + ${change.amount}`,
        lastActivityAt: changedAt,
      },
    });

  await tx.insert(reputationAuditLogs).values({
    userId: change.userId,
    actorId: change.actorId,
    domainId: change.domainId,
    amount: change.amount,
    actionType: change.actionType,
    contentType: change.contentType,
    contentId: change.contentId,
    createdAt: changedAt,
  });
}