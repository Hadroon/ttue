import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken } from "../utils/auth";
import { authenticate } from "../middleware/auth";
import { config } from "../config/app.config";

// Register new user
export async function handleRegister(req: Request): Promise<Response> {
  try {
    const { username, email, password, displayName } = await req.json();

    // Validate input
    if (!username || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Username, email, and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      return new Response(
        JSON.stringify({ error: "Username already taken" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return new Response(
        JSON.stringify({ error: "Email already registered" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Auto-grant admin if email is in the configured admin list
    const isAdminEmail = config.adminEmails.includes(email.toLowerCase());

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        displayName: displayName || username,
        isAdmin: isAdminEmail,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        reputation: users.reputation,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      });

    // Generate token
    const token = generateToken(newUser.id, newUser.username);

    return new Response(
      JSON.stringify({ 
        user: newUser,
        token,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({ error: "Registration failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Login user
export async function handleLogin(req: Request): Promise<Response> {
  try {
    const { username, password } = await req.json();

    // Validate input
    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Auto-promote to admin if email matches the configured admin list
    if (config.adminEmails.includes(user.email.toLowerCase()) && !user.isAdmin) {
      await db
        .update(users)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      user.isAdmin = true;
    }

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
