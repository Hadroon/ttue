import { db } from "../db";
import { challenges, ideas, challengeActions } from "../db/schema";
import { sql } from "drizzle-orm";

// Public platform totals shown on the home page
export async function handleGetPublicStats(): Promise<Response> {
  try {
    const [[c], [i], [a]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(challenges),
      db.select({ count: sql<number>`count(*)::int` }).from(ideas),
      db.select({ count: sql<number>`count(*)::int` }).from(challengeActions),
    ]);
    return new Response(
      JSON.stringify({ challenges: c.count, ideas: i.count, actions: a.count }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching public stats:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch stats" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
