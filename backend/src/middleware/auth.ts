import { verifyToken, extractToken } from "../utils/auth";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
  };
}

// Middleware to authenticate requests
export async function authenticate(req: Request): Promise<{ user: { userId: number; username: string } } | Response> {
  const authHeader = req.headers.get("Authorization");
  const token = extractToken(authHeader);

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const user = verifyToken(token);
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // A valid token may reference a user that no longer exists (e.g. after a DB reset),
  // or predate a password change, which signs out all earlier sessions
  const [row] = await db
    .select({ id: users.id, passwordChangedAt: users.passwordChangedAt })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);
  const revoked = row?.passwordChangedAt && (user.iat ?? 0) < Math.floor(row.passwordChangedAt.getTime() / 1000);
  if (!row || revoked) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return { user };
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(req: Request): Promise<{ user: { userId: number; username: string } | null }> {
  const authHeader = req.headers.get("Authorization");
  const token = extractToken(authHeader);

  if (!token) {
    return { user: null };
  }

  const user = verifyToken(token);
  return { user };
}
