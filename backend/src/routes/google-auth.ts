import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import { users } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { generateToken } from "../utils/auth";
import { config } from "../config/app.config";

// Initialize OAuth2Client - only needs clientId for token verification
const client = new OAuth2Client(config.google.clientId);

interface GoogleTokenPayload {
  sub: string; // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Verify Google ID token and extract user info
 */
async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload | null> {
  try {
    if (!config.google.clientId) {
      console.error("Google Client ID not configured");
      return null;
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      console.error("No payload in Google token");
      return null;
    }

    if (!payload.email) {
      console.error("No email in Google token payload");
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified || false,
      name: payload.name || payload.email.split("@")[0],
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
    };
  } catch (error) {
    console.error("Google token verification failed:", error);
    return null;
  }
}

/**
 * Generate a unique username from email or name
 */
async function generateUniqueUsername(email: string, name?: string): Promise<string> {
  // Start with name-based username or email prefix
  let baseUsername = name 
    ? name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
    : email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  
  if (!baseUsername) baseUsername = "user";

  let username = baseUsername;
  let counter = 1;

  // Check if username exists and add number if needed
  while (true) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length === 0) break;
    
    username = `${baseUsername}${counter}`;
    counter++;
    
    if (counter > 1000) {
      // Fallback to random suffix
      username = `${baseUsername}${Date.now()}`;
      break;
    }
  }

  return username;
}

/**
 * Handle Google Sign-In
 * Accepts a Google ID token from the frontend, verifies it,
 * and either logs in an existing user or creates a new one
 */
export async function handleGoogleAuth(req: Request): Promise<Response> {
  try {
    // Check if Google auth is configured
    if (!config.google.clientId) {
      console.error("Google Client ID not configured");
      return new Response(
        JSON.stringify({ error: "Google authentication is not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const { idToken } = await req.json();

    if (!idToken) {
      return new Response(
        JSON.stringify({ error: "Google ID token is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify the Google token
    const googleUser = await verifyGoogleToken(idToken);
    
    if (!googleUser) {
      console.error("Failed to verify Google token or extract user info");
      return new Response(
        JSON.stringify({ error: "Invalid Google token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!googleUser.email_verified) {
      console.warn("Google email not verified:", googleUser.email);
      return new Response(
        JSON.stringify({ error: "Google email not verified" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user exists by Google ID or email
    const existingUsers = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.googleId, googleUser.sub),
          eq(users.email, googleUser.email)
        )
      )
      .limit(1);

    let user = existingUsers[0];

    if (user) {
      // User exists - update Google info if needed
      if (!user.googleId) {
        // Link Google account to existing email-based account
        const [updatedUser] = await db
          .update(users)
          .set({
            googleId: googleUser.sub,
            authProvider: user.authProvider === "local" ? "local" : "google",
            avatarUrl: user.avatarUrl || googleUser.picture,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();
        user = updatedUser;
      } else if (googleUser.picture && !user.avatarUrl) {
        // Update avatar if not set
        const [updatedUser] = await db
          .update(users)
          .set({
            avatarUrl: googleUser.picture,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();
        user = updatedUser;
      }
    } else {
      // Create new user
      const username = await generateUniqueUsername(googleUser.email, googleUser.name);

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email: googleUser.email,
          displayName: googleUser.name,
          avatarUrl: googleUser.picture,
          googleId: googleUser.sub,
          authProvider: "google",
          passwordHash: null, // No password for Google users
        })
        .returning();
      
      user = newUser;
    }

    // Generate JWT token
    const token = generateToken(user.id, user.username);

    // Auto-promote to admin if email matches the configured admin list
    if (config.adminEmails.includes(user.email.toLowerCase()) && !user.isAdmin) {
      await db
        .update(users)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      user.isAdmin = true;
    }

    // Return user without sensitive data
    const { passwordHash, ...userWithoutPassword } = user;

    return new Response(
      JSON.stringify({
        user: userWithoutPassword,
        token,
        isNewUser: !existingUsers[0], // Flag to indicate if account was just created
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Google auth error:", error);
    return new Response(
      JSON.stringify({ error: "Google authentication failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get Google Client ID for frontend configuration
 */
export async function handleGetGoogleConfig(req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({
      clientId: config.google.clientId || null,
      enabled: !!config.google.clientId,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
