import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  challengeDraftProposals,
  challengeDrafts,
  challenges,
  comments,
  domains,
  ideas,
  reputationAuditLogs,
  userDomainReputation,
  users,
} from "../db/schema";
import { optionalAuth } from "../middleware/auth";
import { CIVIC_RANKS, getCivicRank, getNextCivicRank } from "../services/reputation";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function getPagination(req: Request) {
  const url = new URL(req.url);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_PAGE_SIZE}`, 10);
  const requestedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);

  return {
    limit: Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
    offset: Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0,
  };
}

async function findUserByUsername(username: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      location: users.location,
      websiteUrl: users.websiteUrl,
      reputation: users.reputation,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user;
}

async function getActivity(userId: number, kind: string, limit: number, offset: number) {
  const kindFilter = kind === "all" ? sql`true` : sql`activity."kind" = ${kind}`;
  const rows = await db.execute(sql`
    WITH activity AS (
      SELECT
        'challenge'::text AS "kind",
        challenge."id" AS "contentId",
        challenge."title" AS "title",
        challenge."description" AS "summary",
        CASE WHEN challenge."is_marked" THEN 'Marked' ELSE 'Open' END::text AS "status",
        challenge."votes" AS "score",
        challenge."id" AS "challengeId",
        domain."name" AS "domainName",
        challenge."created_at" AS "createdAt"
      FROM "challenges" AS challenge
      JOIN "domains" AS domain ON domain."id" = challenge."domain_id"
      WHERE challenge."creator_id" = ${userId} AND challenge."is_marked" = false

      UNION ALL

      SELECT
        'idea'::text AS "kind",
        idea."id" AS "contentId",
        idea."title" AS "title",
        idea."content" AS "summary",
        CASE WHEN idea."is_closed" THEN 'Closed' ELSE 'Open' END::text AS "status",
        idea."score" AS "score",
        idea."challenge_id" AS "challengeId",
        COALESCE(domain."name", 'General Civic') AS "domainName",
        idea."created_at" AS "createdAt"
      FROM "ideas" AS idea
      LEFT JOIN "challenges" AS challenge ON challenge."id" = idea."challenge_id"
      LEFT JOIN "domains" AS domain ON domain."id" = challenge."domain_id"
      WHERE idea."author_id" = ${userId} AND idea."is_marked" = false

      UNION ALL

      SELECT
        'comment'::text AS "kind",
        comment."id" AS "contentId",
        CASE
          WHEN idea."title" IS NOT NULL THEN 'Comment on ' || idea."title"
          WHEN direct_challenge."title" IS NOT NULL THEN 'Comment on ' || direct_challenge."title"
          ELSE 'Civic comment'
        END::text AS "title",
        comment."content" AS "summary",
        CASE WHEN comment."is_accepted" THEN 'Accepted' ELSE 'Published' END::text AS "status",
        comment."score" AS "score",
        COALESCE(comment."challenge_id", idea."challenge_id") AS "challengeId",
        COALESCE(direct_domain."name", idea_domain."name", 'General Civic') AS "domainName",
        comment."created_at" AS "createdAt"
      FROM "comments" AS comment
      LEFT JOIN "ideas" AS idea ON idea."id" = comment."idea_id"
      LEFT JOIN "challenges" AS direct_challenge ON direct_challenge."id" = comment."challenge_id"
      LEFT JOIN "domains" AS direct_domain ON direct_domain."id" = direct_challenge."domain_id"
      LEFT JOIN "challenges" AS idea_challenge ON idea_challenge."id" = idea."challenge_id"
      LEFT JOIN "domains" AS idea_domain ON idea_domain."id" = idea_challenge."domain_id"
      WHERE comment."author_id" = ${userId} AND comment."is_marked" = false

      UNION ALL

      SELECT
        'proposal'::text AS "kind",
        proposal."id" AS "contentId",
        'Accepted draft contribution'::text AS "title",
        proposal."content" AS "summary",
        'Accepted'::text AS "status",
        0::integer AS "score",
        draft."challenge_id" AS "challengeId",
        domain."name" AS "domainName",
        proposal."created_at" AS "createdAt"
      FROM "challenge_draft_proposals" AS proposal
      JOIN "challenge_drafts" AS draft ON draft."id" = proposal."draft_id"
      JOIN "challenges" AS challenge ON challenge."id" = draft."challenge_id"
      JOIN "domains" AS domain ON domain."id" = challenge."domain_id"
      WHERE proposal."proposer_id" = ${userId} AND proposal."status" = 'accepted'
    )
    SELECT activity.*, count(*) OVER()::integer AS "total"
    FROM activity
    WHERE ${kindFilter}
    ORDER BY activity."createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const items = Array.from(rows) as Array<Record<string, unknown> & { total?: number }>;
  const total = items.length > 0 ? Number(items[0].total ?? 0) : 0;
  return {
    items: items.map(({ total: _total, ...item }) => item),
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function getReputationHistory(userId: number, limit: number, offset: number) {
  const rows = await db
    .select({
      id: reputationAuditLogs.id,
      amount: reputationAuditLogs.amount,
      actionType: reputationAuditLogs.actionType,
      contentType: reputationAuditLogs.contentType,
      contentId: reputationAuditLogs.contentId,
      domainSlug: domains.slug,
      domainName: domains.name,
      createdAt: reputationAuditLogs.createdAt,
    })
    .from(reputationAuditLogs)
    .innerJoin(domains, eq(reputationAuditLogs.domainId, domains.id))
    .where(eq(reputationAuditLogs.userId, userId))
    .orderBy(desc(reputationAuditLogs.createdAt), desc(reputationAuditLogs.id))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reputationAuditLogs)
    .where(eq(reputationAuditLogs.userId, userId));

  return { rows, total, limit, offset, hasMore: offset + rows.length < total };
}

export async function handleGetDomains(): Promise<Response> {
  try {
    const allDomains = await db
      .select({
        id: domains.id,
        slug: domains.slug,
        name: domains.name,
        description: domains.description,
      })
      .from(domains)
      .orderBy(domains.displayOrder);

    return Response.json({ domains: allDomains });
  } catch (error) {
    console.error("Get domains error:", error);
    return Response.json({ error: "Failed to get civic domains" }, { status: 500 });
  }
}

export async function handleGetCivicProfile(req: Request, username: string): Promise<Response> {
  try {
    const auth = await optionalAuth(req);
    const user = await findUserByUsername(username);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const isOwner = auth.user?.userId === user.id;
    const reputationBreakdown = await db
      .select({
        domainId: domains.id,
        domainSlug: domains.slug,
        domainName: domains.name,
        description: domains.description,
        score: sql<number>`coalesce(${userDomainReputation.score}, 0)::int`,
        lastActivityAt: userDomainReputation.lastActivityAt,
      })
      .from(domains)
      .leftJoin(
        userDomainReputation,
        and(
          eq(userDomainReputation.domainId, domains.id),
          eq(userDomainReputation.userId, user.id),
        ),
      )
      .orderBy(domains.displayOrder);

    const [counts] = await db.execute(sql`
      SELECT
        (SELECT count(*)::integer FROM "challenges" WHERE "creator_id" = ${user.id} AND "is_marked" = false) AS "challenges",
        (SELECT count(*)::integer FROM "ideas" WHERE "author_id" = ${user.id} AND "is_marked" = false) AS "ideas",
        (SELECT count(*)::integer FROM "comments" WHERE "author_id" = ${user.id} AND "is_marked" = false) AS "comments",
        (SELECT count(*)::integer FROM "challenge_drafts" WHERE "creator_id" = ${user.id}) AS "drafts",
        (SELECT count(*)::integer FROM "challenge_draft_proposals" WHERE "proposer_id" = ${user.id} AND "status" = 'accepted') AS "acceptedProposals"
    `);

    const activity = await getActivity(user.id, "all", 10, 0);
    const reputationHistory = await getReputationHistory(user.id, 10, 0);
    const rank = getCivicRank(user.reputation);
    const nextRank = getNextCivicRank(user.reputation);
    const currentMinimum = CIVIC_RANKS.find((candidate) => candidate.title === rank)?.minimumReputation ?? 0;
    const rankProgress = nextRank
      ? Math.max(0, Math.min(1, (user.reputation - currentMinimum) / (nextRank.minimumReputation - currentMinimum)))
      : 1;

    return Response.json({
      identity: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        location: user.location,
        websiteUrl: user.websiteUrl,
        joinedAt: user.createdAt,
        email: isOwner ? user.email : undefined,
      },
      isOwner,
      civicStatus: {
        rank,
        reputation: user.reputation,
        nextRank,
        rankProgress,
      },
      reputationBreakdown,
      contributionCounts: counts,
      activity,
      reputationHistory,
    });
  } catch (error) {
    console.error("Get civic profile error:", error);
    return Response.json({ error: "Failed to get civic profile" }, { status: 500 });
  }
}

export async function handleGetUserActivity(req: Request, username: string): Promise<Response> {
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "all";
    const allowedKinds = new Set(["all", "challenge", "idea", "comment", "proposal"]);
    if (!allowedKinds.has(kind)) {
      return Response.json({ error: "Invalid activity kind" }, { status: 400 });
    }

    const { limit, offset } = getPagination(req);
    return Response.json(await getActivity(user.id, kind, limit, offset));
  } catch (error) {
    console.error("Get user activity error:", error);
    return Response.json({ error: "Failed to get user activity" }, { status: 500 });
  }
}

export async function handleGetUserReputation(req: Request, username: string): Promise<Response> {
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { limit, offset } = getPagination(req);
    return Response.json(await getReputationHistory(user.id, limit, offset));
  } catch (error) {
    console.error("Get user reputation error:", error);
    return Response.json({ error: "Failed to get reputation history" }, { status: 500 });
  }
}