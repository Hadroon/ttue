import { db } from "../db";
import { users } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken } from "../utils/auth";
import { authenticate } from "../middleware/auth";
import { config } from "../config/app.config";
import { clientIp, rateLimit, resetRateLimit, tooManyRequests } from "../utils/rate-limit";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Shift last login into previous_login_at so "since last login" stays stable during the session
export async function recordLogin(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ previousLoginAt: users.lastLoginAt, lastLoginAt: sql`now()` })
    .where(eq(users.id, userId));
}

/**
 * Tells the frontend which email/password features are available.
 */
export async function handleGetAuthConfig(): Promise<Response> {
  return json({
    registration: config.features.registration,
    passwordReset: config.features.passwordReset,
  });
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
let dummyHash: Promise<string> | null = null;

// Login user with username or email
export async function handleLogin(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const identifier = body.identifier ?? body.email ?? body.username;
    const { password } = body;

    // Validate input
    if (typeof identifier !== "string" || !identifier.trim() || typeof password !== "string" || !password) {
      return json({ error: "Email or username and password are required" }, 400);
    }

    const lookup = identifier.trim().toLowerCase();
    // Throttle password guessing per client and per account
    const ipKey = `login-ip:${clientIp(req)}`;
    const accountKey = `login-account:${lookup}`;
    if (!rateLimit(ipKey, 30, LOGIN_WINDOW_MS) || !rateLimit(accountKey, 10, LOGIN_WINDOW_MS)) {
      return tooManyRequests();
    }

    const [user] = await db
      .select()
      .from(users)
      .where(lookup.includes("@")
        ? sql`lower(${users.email}) = ${lookup}`
        : sql`lower(${users.username}) = ${lookup}`)
      .limit(1);

    // Hash against a dummy when there's no password so response time doesn't reveal which accounts exist.
    // Accounts created via Google have no password until one is set through "Forgot password".
    dummyHash ??= hashPassword("not-a-real-password");
    const passwordOk = await comparePassword(password, user?.passwordHash ?? (await dummyHash));
    if (!user || !user.passwordHash || !passwordOk) {
      return json({ error: "Invalid email/username or password" }, 401);
    }
    resetRateLimit(accountKey);

    if (!user.emailVerified) {
      return json({
        error: "Please confirm your email address first. Use \"Forgot password?\" to get a confirmation link.",
        code: "email_not_verified",
      }, 403);
    }

    // Auto-promote to admin if email matches the configured admin list
    if (config.adminEmails.includes(user.email.toLowerCase()) && !user.isAdmin) {
      await db
        .update(users)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      user.isAdmin = true;
    }

    await recordLogin(user.id);

    // Generate token
    const token = generateToken(user.id, user.username);

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;

    return new Response(
      JSON.stringify({ 
        user: userWithoutPassword,
        token,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ error: "Login failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get current user profile
export async function handleGetProfile(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
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
        isAdmin: users.isAdmin,
        joinedAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, authResult.user.userId))
      .limit(1);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ user }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get profile error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get profile" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Update user profile
export async function handleUpdateProfile(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { displayName, bio, location, websiteUrl } = await req.json();

    const fields = { displayName, bio, location, websiteUrl };
    if (Object.values(fields).some((value) => value !== undefined && value !== null && typeof value !== "string")) {
      return new Response(
        JSON.stringify({ error: "Profile fields must be strings or null" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (displayName?.trim().length > 100 || location?.trim().length > 100 || websiteUrl?.trim().length > 500 || bio?.trim().length > 2000) {
      return new Response(
        JSON.stringify({ error: "One or more profile fields exceed the allowed length" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const normalizedWebsiteUrl = websiteUrl?.trim() || null;
    if (normalizedWebsiteUrl) {
      try {
        const parsedWebsite = new URL(normalizedWebsiteUrl);
        if (parsedWebsite.protocol !== "http:" && parsedWebsite.protocol !== "https:") {
          throw new Error("Unsupported protocol");
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Website must be a valid HTTP or HTTPS URL" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        displayName: displayName === undefined ? undefined : displayName?.trim() || null,
        bio: bio === undefined ? undefined : bio?.trim() || null,
        location: location === undefined ? undefined : location?.trim() || null,
        websiteUrl: websiteUrl === undefined ? undefined : normalizedWebsiteUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authResult.user.userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        location: users.location,
        websiteUrl: users.websiteUrl,
        reputation: users.reputation,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return new Response(
      JSON.stringify({ user: updatedUser }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update profile error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update profile" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
