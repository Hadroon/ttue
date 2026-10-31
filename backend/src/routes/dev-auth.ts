import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateToken } from "../utils/auth";
import { config } from "../config/app.config";
import { recordLogin } from "./auth";

const DEFAULT_DEV_USERNAME = "devuser";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Tells the frontend whether the mock dev login is available.
 */
export async function handleGetDevLoginConfig(): Promise<Response> {
  return json({ enabled: config.devLogin.enabled });
}

/**
 * Passwordless login as a mock user, for local development only.
 * Body (optional): { username?: string, isAdmin?: boolean }
 * The user is created on first use; different usernames give different mock users.
 */
export async function handleDevLogin(req: Request): Promise<Response> {
  if (!config.devLogin.enabled) {
    return json({ error: "Not found" }, 404);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawUsername = typeof body?.username === "string" ? body.username : "";
    const username = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30) || DEFAULT_DEV_USERNAME;
    const isAdmin = body?.isAdmin === true;

    let [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          username,
          email: `${username}@dev.localhost`,
          displayName: `Dev ${username}`,
          authProvider: "dev",
          passwordHash: null,
          isAdmin,
        })
        .returning();
    } else if (isAdmin && !user.isAdmin) {
      [user] = await db
        .update(users)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
    }

    await recordLogin(user.id);

    const token = generateToken(user.id, user.username);
    const { passwordHash, ...userWithoutPassword } = user;

    return json({ user: userWithoutPassword, token, isNewUser: false });
  } catch (error) {
    console.error("Dev login error:", error);
    return json({ error: "Dev login failed" }, 500);
  }
}
