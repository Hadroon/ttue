import { db } from "../db";
import { challenges, challengeActions, challengeActionItems, donations, users } from "../db/schema";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";
import { KINDS, ValidationError, getKind, parseItemData, type ActionKey, type KindDef } from "../services/action-items";

const ACTION_KEYS: readonly string[] = ["legal", "economic", "direct", "policy", "info"];
const MAX_BODY_BYTES = 50_000;

// Child entries that move their parent task forward: the statuses it must be in, and where it goes
const TASK_FLOW: Record<string, { from: string[]; to: string; error: string } | undefined> = {
  application: { from: ["Funded", "In Progress"], to: "In Progress", error: "This task is not open for applications yet" },
  proof: { from: ["In Progress", "Verification"], to: "Verification", error: "Work on this task has not started" },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const itemColumns = {
  id: challengeActionItems.id,
  challengeId: challengeActionItems.challengeId,
  actionKey: challengeActionItems.actionKey,
  kind: challengeActionItems.kind,
  parentId: challengeActionItems.parentId,
  userId: challengeActionItems.userId,
  data: challengeActionItems.data,
  createdAt: challengeActionItems.createdAt,
  updatedAt: challengeActionItems.updatedAt,
  authorUsername: users.username,
  authorDisplayName: users.displayName,
};

async function loadItem(itemId: number) {
  const [item] = await db
    .select(itemColumns)
    .from(challengeActionItems)
    .leftJoin(users, eq(challengeActionItems.userId, users.id))
    .where(eq(challengeActionItems.id, itemId))
    .limit(1);
  return item;
}

async function isAdmin(userId: number): Promise<boolean> {
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.isAdmin === true;
}

async function isApproved(challengeId: number, actionKey: string): Promise<boolean> {
  const [row] = await db
    .select({ key: challengeActions.actionKey })
    .from(challengeActions)
    .where(and(eq(challengeActions.challengeId, challengeId), eq(challengeActions.actionKey, actionKey)))
    .limit(1);
  return !!row;
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return null;
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
}

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string })?.code === "23505" || (error as { cause?: { code?: string } })?.cause?.code === "23505";

/** Checks that need the database, on top of the field validation in the registry */
async function checkRelations(
  def: KindDef,
  kind: string,
  data: Record<string, unknown>,
  ctx: { challengeId: number; userId: number; parent: { id: number; userId: number | null } | null },
): Promise<string | null> {
  if (kind === "allocation") {
    const ids = Object.keys(data.votes as Record<string, number>).map(Number);
    if (ids.length) {
      const found = await db
        .select({ id: challengeActionItems.id })
        .from(challengeActionItems)
        .where(and(
          eq(challengeActionItems.challengeId, ctx.challengeId),
          eq(challengeActionItems.kind, "task"),
          inArray(challengeActionItems.id, ids),
        ));
      if (found.length !== ids.length) return "Votes can only go to tasks of this challenge";
    }
  }

  if (kind === "proof" && ctx.parent && ctx.parent.userId !== ctx.userId && !(await isAdmin(ctx.userId))) {
    const [applied] = await db
      .select({ id: challengeActionItems.id })
      .from(challengeActionItems)
      .where(and(
        eq(challengeActionItems.kind, "application"),
        eq(challengeActionItems.parentId, ctx.parent.id),
        eq(challengeActionItems.userId, ctx.userId),
      ))
      .limit(1);
    if (!applied) return "Only the task owner or someone who applied can add proof";
  }
  return null;
}

async function loadAggregates(challengeId: number, actionKey: string | null) {
  const summed = Object.entries(KINDS).filter(([, d]) => d.sumField);
  const counted = Object.entries(KINDS).filter(([, d]) => d.scope === "personal" && d.parent);
  const total = summed.length
    ? sql<number>`coalesce(sum(case ${challengeActionItems.kind} ${sql.join(
      summed.map(([kind, d]) => {
        const value = sql`(${challengeActionItems.data}->>${d.sumField!}::text)::numeric`;
        return d.sumWhen
          ? sql`when ${kind}::text then (case when ${challengeActionItems.data}->>${d.sumWhen}::text = 'true' then ${value} else 0 end)`
          : sql`when ${kind}::text then ${value}`;
      }),
      sql` `,
    )} else 0 end), 0)::float8`
    : sql<number>`0`;

  const [entries, paid] = await Promise.all([
    db
      .select({ kind: challengeActionItems.kind, parentId: challengeActionItems.parentId, count: sql<number>`count(*)::int`, total })
      .from(challengeActionItems)
      .where(and(
        eq(challengeActionItems.challengeId, challengeId),
        actionKey ? eq(challengeActionItems.actionKey, actionKey) : undefined,
        inArray(challengeActionItems.kind, counted.map(([kind]) => kind)),
        isNotNull(challengeActionItems.parentId),
      ))
      .groupBy(challengeActionItems.kind, challengeActionItems.parentId),
    // Paid donations to cases and bounty-board tasks, in the smallest currency unit
    actionKey && actionKey !== "direct" && actionKey !== "legal"
      ? Promise.resolve([] as { targetId: string | null; count: number; total: number }[])
      : db
          .select({ targetId: donations.targetId, count: sql<number>`count(*)::int`, total: sql<number>`sum(${donations.amount})::float8` })
          .from(donations)
          .where(and(
            eq(donations.challengeId, challengeId),
            inArray(donations.actionKey, ["direct", "legal"]),
            isNotNull(donations.targetId),
          ))
          .groupBy(donations.targetId),
  ]);

  return [
    ...entries.map(e => ({ kind: e.kind, parentId: e.parentId, count: e.count, total: e.total })),
    // Paid donations to cases and bounty-board tasks, in the smallest currency unit (item ids are unique, so targetId is enough)
    ...paid
      .filter(p => p.targetId && /^\d+$/.test(p.targetId))
      .map(p => ({ kind: "donation", parentId: Number(p.targetId), count: p.count, total: p.total })),
  ];
}

// GET /api/challenges/:id/action-items?action=legal
// Shared entries for everyone, personal entries only for their author, plus per-parent totals.
export async function handleGetActionItems(req: Request, challengeId: number): Promise<Response> {
  const { user } = await optionalAuth(req);
  const actionKey = new URL(req.url).searchParams.get("action");
  if (actionKey !== null && !ACTION_KEYS.includes(actionKey)) return json({ error: "Unknown action" }, 400);

  try {
    const [challenge] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return json({ error: "Challenge not found" }, 404);

    const sharedKinds = Object.entries(KINDS).filter(([, d]) => d.scope === "shared").map(([kind]) => kind);
    const items = await db
      .select(itemColumns)
      .from(challengeActionItems)
      .leftJoin(users, eq(challengeActionItems.userId, users.id))
      .where(and(
        eq(challengeActionItems.challengeId, challengeId),
        actionKey ? eq(challengeActionItems.actionKey, actionKey) : undefined,
        or(
          inArray(challengeActionItems.kind, sharedKinds),
          user ? eq(challengeActionItems.userId, user.userId) : undefined,
        ),
      ))
      .orderBy(challengeActionItems.createdAt, challengeActionItems.id);

    return json({ items, aggregates: await loadAggregates(challengeId, actionKey) });
  } catch (error) {
    console.error("Get action items error:", error);
    return json({ error: "Failed to load entries" }, 500);
  }
}

// POST /api/challenges/:id/action-items  { kind, parentId?, data }
// Kinds that allow one entry per user (or per user and parent) update the existing entry instead.
export async function handleCreateActionItem(req: Request, challengeId: number): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const userId = auth.user.userId;

  try {
    const body = await readBody(req);
    if (!body) return json({ error: "Invalid request body" }, 400);

    const def = getKind(body.kind);
    if (!def) return json({ error: "Unknown kind" }, 400);
    const kind = body.kind as string;

    const [challenge] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return json({ error: "Challenge not found" }, 404);
    if (!(await isApproved(challengeId, def.actionKey))) return json({ error: "This action is not approved yet" }, 403);

    let parent: { id: number; userId: number | null; data: Record<string, unknown> } | null = null;
    const hasParentId = body.parentId !== undefined && body.parentId !== null;
    if (!def.parent && hasParentId) return json({ error: "This kind cannot have a parent" }, 400);
    if (def.parent) {
      if (!hasParentId) {
        if (def.parent.required) return json({ error: `parentId (a ${def.parent.kind}) is required` }, 400);
      } else {
        if (typeof body.parentId !== "number" || !Number.isInteger(body.parentId) || body.parentId <= 0) {
          return json({ error: "parentId must be a positive whole number" }, 400);
        }
        const [found] = await db
          .select({ id: challengeActionItems.id, userId: challengeActionItems.userId, data: challengeActionItems.data })
          .from(challengeActionItems)
          .where(and(
            eq(challengeActionItems.id, body.parentId),
            eq(challengeActionItems.challengeId, challengeId),
            eq(challengeActionItems.kind, def.parent.kind),
          ))
          .limit(1);
        if (!found) return json({ error: `The ${def.parent.kind} was not found` }, 404);
        parent = found;
      }
    }

    const data = parseItemData(def, body.data);
    if (kind === "task") data.status = "Open";
    if (def.approval) data.approval = "Pending";

    // Work moves a task along: applying starts it, proof sends it to verification
    const taskStatus = parent?.data.status;
    const advanceTask = TASK_FLOW[kind];
    if (advanceTask && parent && !advanceTask.from.includes(String(taskStatus))) {
      return json({ error: advanceTask.error }, 400);
    }
    const finish = async (itemId: number, status: number) => {
      if (advanceTask && parent) {
        await db
          .update(challengeActionItems)
          .set({ data: { ...parent.data, status: advanceTask.to }, updatedAt: new Date() })
          .where(eq(challengeActionItems.id, parent.id));
      }
      return json(await loadItem(itemId), status);
    };

    const relationError = await checkRelations(def, kind, data, { challengeId, userId, parent });
    if (relationError) return json({ error: relationError }, kind === "proof" ? 403 : 400);

    const own = and(
      eq(challengeActionItems.challengeId, challengeId),
      eq(challengeActionItems.kind, kind),
      eq(challengeActionItems.userId, userId),
    );

    if (def.unique) {
      const [existing] = await db
        .select({ id: challengeActionItems.id })
        .from(challengeActionItems)
        .where(and(own, parent ? eq(challengeActionItems.parentId, parent.id) : sql`${challengeActionItems.parentId} IS NULL`))
        .limit(1);
      if (existing) {
        await db.update(challengeActionItems).set({ data, updatedAt: new Date() }).where(eq(challengeActionItems.id, existing.id));
        return finish(existing.id, 200);
      }
    }

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(challengeActionItems).where(own);
    if (count >= def.maxPerUser) return json({ error: `You can add at most ${def.maxPerUser} of these` }, 429);

    const [created] = await db
      .insert(challengeActionItems)
      .values({ challengeId, actionKey: def.actionKey as ActionKey, kind, parentId: parent?.id ?? null, userId, data })
      .returning({ id: challengeActionItems.id });
    return finish(created.id, 201);
  } catch (error) {
    if (error instanceof ValidationError) return json({ error: error.message }, 400);
    if (isUniqueViolation(error)) return json({ error: "You have already added this" }, 409);
    console.error("Create action item error:", error);
    return json({ error: "Failed to save entry" }, 500);
  }
}

// PUT /api/challenges/:id/action-items/:itemId  { data } - the author or an admin
export async function handleUpdateActionItem(req: Request, challengeId: number, itemId: number): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const userId = auth.user.userId;

  try {
    const body = await readBody(req);
    if (!body) return json({ error: "Invalid request body" }, 400);

    const [item] = await db
      .select({
        id: challengeActionItems.id, kind: challengeActionItems.kind, userId: challengeActionItems.userId,
        parentId: challengeActionItems.parentId, data: challengeActionItems.data,
      })
      .from(challengeActionItems)
      .where(and(eq(challengeActionItems.id, itemId), eq(challengeActionItems.challengeId, challengeId)))
      .limit(1);
    const def = item ? getKind(item.kind) : null;
    if (!item || !def) return json({ error: "Entry not found" }, 404);

    const admin = await isAdmin(userId);
    if (item.userId !== userId && !admin) {
      return json({ error: "Only the author or an admin can change this entry" }, 403);
    }
    if (!(await isApproved(challengeId, def.actionKey))) return json({ error: "This action is not approved yet" }, 403);

    const data = parseItemData(def, body.data);
    // Approval is only ever granted by an admin; an author's edit sends the entry back for review
    if (def.approval) data.approval = admin ? item.data.approval ?? "Pending" : "Pending";
    // A task's progress is moved by the server (funding, applications, proof), not by edits
    if (item.kind === "task" && (!admin || (body.data as Record<string, unknown> | undefined)?.status === undefined)) {
      data.status = item.data.status ?? "Open";
    }
    const relationError = await checkRelations(def, item.kind, data, { challengeId, userId, parent: null });
    if (relationError) return json({ error: relationError }, 400);

    await db.update(challengeActionItems).set({ data, updatedAt: new Date() }).where(eq(challengeActionItems.id, itemId));
    return json(await loadItem(itemId));
  } catch (error) {
    if (error instanceof ValidationError) return json({ error: error.message }, 400);
    console.error("Update action item error:", error);
    return json({ error: "Failed to update entry" }, 500);
  }
}

// DELETE /api/challenges/:id/action-items/:itemId - the author or an admin; child entries go with it
export async function handleDeleteActionItem(req: Request, challengeId: number, itemId: number): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const userId = auth.user.userId;

  try {
    const [item] = await db
      .select({ userId: challengeActionItems.userId })
      .from(challengeActionItems)
      .where(and(eq(challengeActionItems.id, itemId), eq(challengeActionItems.challengeId, challengeId)))
      .limit(1);
    if (!item) return json({ error: "Entry not found" }, 404);

    if (item.userId !== userId && !(await isAdmin(userId))) {
      return json({ error: "Only the author or an admin can remove this entry" }, 403);
    }

    await db.delete(challengeActionItems).where(eq(challengeActionItems.id, itemId));
    return json({ message: "Entry removed" });
  } catch (error) {
    console.error("Delete action item error:", error);
    return json({ error: "Failed to remove entry" }, 500);
  }
}
