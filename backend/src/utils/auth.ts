import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { config } from "../config/app.config";

/** Random URL-safe token for emailed links; only its hash is stored. */
export function newOneTimeToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashOneTimeToken(token) };
}

export function hashOneTimeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.security.bcryptRounds);
}

// Compare password with hash
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(userId: number, username: string): string {
  return jwt.sign(
    { userId, username },
    config.security.jwtSecret,
    { expiresIn: "7d" }
  );
}

// Verify JWT token
export function verifyToken(token: string): { userId: number; username: string; iat?: number } | null {
  try {
    const decoded = jwt.verify(token, config.security.jwtSecret) as {
      userId: number;
      username: string;
      iat?: number;
    };
    return decoded;
  } catch (error) {
    return null;
  }
}

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt ignores everything after 72 bytes
const PASSWORD_MAX_BYTES = 72;

/** Returns an error message if the password is unacceptable, or null if it is fine. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) return "Password is required";
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} characters`;
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Usernames: 3-30 letters, digits or underscores. */
export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{3,30}$/.test(username);
}

// Names that could be mistaken for the site or its staff, or clash with routes
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support", "help", "moderator", "mod", "staff", "team",
  "official", "security", "abuse", "postmaster", "webmaster", "hostmaster", "noreply", "no_reply",
  "info", "contact", "api", "www", "mail", "email", "billing", "donations", "legal", "privacy", "terms",
  "profile", "settings", "signin", "signup", "login", "logout", "register", "null", "undefined",
  "anonymous", "deleted", "timetouniteearth", "ttue",
]);

/** Returns an error message if the username can't be chosen, or null if it is fine. */
export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string" || !username) return "Username is required";
  if (!isValidUsername(username)) return "Username must be 3-30 letters, numbers or underscores";
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return "That username is reserved. Please choose another one.";
  return null;
}

/**
 * Checks the password against the Have I Been Pwned breach corpus using k-anonymity:
 * only the first 5 characters of its SHA-1 hash leave the server. Fails open if the service is unreachable.
 */
export async function isPasswordBreached(password: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [lineSuffix, count] = line.trim().split(":");
      return lineSuffix === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

/**
 * Full password policy (NIST SP 800-63B style): length limits, no composition rules,
 * must not contain the username or email name, and must not appear in known breaches.
 */
export async function checkPasswordPolicy(
  password: unknown,
  context: { username?: string; email?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const basicError = validatePassword(password);
  if (basicError) return basicError;
  const pw = (password as string).toLowerCase();

  const personal = [context.username, context.email?.split("@")[0]]
    .filter((v): v is string => !!v && v.length >= 3)
    .map((v) => v.toLowerCase());
  if (personal.some((v) => pw.includes(v))) return "Password must not contain your username or email";

  if (await isPasswordBreached(password as string, fetchImpl)) {
    return "This password has appeared in a data breach, so it's easy to guess. Please choose a different one.";
  }
  return null;
}

// Extract token from Authorization header
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}
