import { verifyToken, extractToken } from "../utils/auth";

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
