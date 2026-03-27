import { db } from "../db";
import { flags, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

// POST /api/flags  — create a flag (or 409 if already flagged by this user)
export async function handleCreateFlag(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { contentType, contentId, reason } = await req.json();

    if (!contentType || !contentId || !reason) {
      return new Response(
        JSON.stringify({ error: "contentType, contentId, and reason are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!["idea", "comment", "challenge"].includes(contentType)) {
      return new Response(
        JSON.stringify({ error: "contentType must be 'idea', 'comment', or 'challenge'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (typeof reason !== "string" || reason.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Please provide a reason (at least 5 characters)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for existing flag by this user on this content
    const [existing] = await db
      .select({ id: flags.id })
      .from(flags)
      .where(and(
        eq(flags.userId, authResult.user.userId),
        eq(flags.contentType, contentType),
        eq(flags.contentId, contentId)
      ))
      .limit(1);

    if (existing) {
      return new Response(
        JSON.stringify({ error: "You have already reported this content" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const [newFlag] = await db
      .insert(flags)
      .values({
        userId: authResult.user.userId,
        contentType,
        contentId,
        reason: reason.trim(),
      })
      .returning({
        id: flags.id,
        contentType: flags.contentType,
        contentId: flags.contentId,
        status: flags.status,
        createdAt: flags.createdAt,
      });

    return new Response(
      JSON.stringify(newFlag),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create flag error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to submit report" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// DELETE /api/flags/:contentType/:contentId  — remove own flag
export async function handleDeleteFlag(req: Request, contentType: string, contentId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const deleted = await db
      .delete(flags)
      .where(and(
        eq(flags.userId, authResult.user.userId),
        eq(flags.contentType, contentType),
        eq(flags.contentId, contentId)
      ))
      .returning({ id: flags.id });

    if (deleted.length === 0) {
      return new Response(
        JSON.stringify({ error: "Flag not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Report removed" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delete flag error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to remove report" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// GET /api/flags/me?contentType=&contentId=  — check if current user has flagged an item
export async function handleCheckFlag(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  const url = new URL(req.url);
  const contentType = url.searchParams.get("contentType");
  const contentId = parseInt(url.searchParams.get("contentId") || "");

  if (!contentType || isNaN(contentId)) {
    return new Response(
      JSON.stringify({ error: "contentType and contentId query params are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const [existing] = await db
      .select({ id: flags.id })
      .from(flags)
      .where(and(
        eq(flags.userId, authResult.user.userId),
        eq(flags.contentType, contentType),
        eq(flags.contentId, contentId)
      ))
      .limit(1);

    return new Response(
      JSON.stringify({ flagged: !!existing }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Check flag error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to check flag status" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
