import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db";
import { passwordResetTokens, users } from "../db/schema";
import { config } from "../config/app.config";
import { checkPasswordPolicy, generateToken, hashOneTimeToken, hashPassword, isValidEmail, newOneTimeToken, normalizeEmail } from "../utils/auth";
import { escapeHtml, sendEmail } from "../utils/email";
import { clientIp, rateLimit, tooManyRequests } from "../utils/rate-limit";
import { recordLogin } from "./auth";

const TOKEN_TTL_MS = 60 * 60 * 1000;
// Minimum gap between reset emails for the same account
const RESEND_COOLDOWN_MS = 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function buildResetEmail(name: string, resetUrl: string) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: "Reset your Time to unite Earth password",
    text:
      `Hi ${name},\n\n` +
      `Someone (hopefully you) asked to reset the password for your Time to unite Earth account.\n` +
      `Open this link within 1 hour to choose a new password:\n\n${resetUrl}\n\n` +
      `If you didn't ask for this, you can ignore this email; your password won't change.`,
    html:
      `<p>Hi ${safeName},</p>` +
      `<p>Someone (hopefully you) asked to reset the password for your Time to unite Earth account.</p>` +
      `<p><a href="${safeUrl}">Choose a new password</a> (the link is valid for 1 hour).</p>` +
      `<p>If you didn't ask for this, you can ignore this email; your password won't change.</p>`,
  };
}

/**
 * Emails a one-time reset link. Always answers the same way so it can't be used to discover
 * which emails have accounts.
 */
export async function handleForgotPassword(req: Request): Promise<Response> {
  if (!config.features.passwordReset) {
    return json({ error: "Password reset is currently disabled" }, 403);
  }
  if (!rateLimit(`forgot:${clientIp(req)}`, 10, FIFTEEN_MINUTES)) return tooManyRequests();

  try {
    const { email: rawEmail } = await req.json().catch(() => ({}));
    if (typeof rawEmail !== "string" || !isValidEmail(normalizeEmail(rawEmail)) || rawEmail.length > 254) {
      return json({ error: "Please enter a valid email address" }, 400);
    }
    const email = normalizeEmail(rawEmail);
    const response = json({ message: "If an account exists for that email, a reset link has been sent." });

    const [user] = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName, email: users.email, authProvider: users.authProvider })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (user && user.authProvider !== "dev") {
      // Not awaited, so response timing doesn't reveal whether the account exists
      void issueResetLink(user).catch((error) => console.error("Password reset email error:", error));
    }

    return response;
  } catch (error) {
    console.error("Forgot password error:", error);
    return json({ error: "Could not process the request" }, 500);
  }
}

async function issueResetLink(user: { id: number; username: string; displayName: string | null; email: string }) {
  const [recent] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(and(
      eq(passwordResetTokens.userId, user.id),
      gt(passwordResetTokens.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
    ))
    .limit(1);
  if (recent) return;

  const { token, hash } = newOneTimeToken();
  // Only the newest link stays valid
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    createdAt: new Date(),
  });

  const resetUrl = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const message = buildResetEmail(user.displayName || user.username, resetUrl);
  if (!(await sendEmail({ to: user.email, ...message }))) {
    console.error(`Password reset email to user ${user.id} could not be sent`);
  }
}

/**
 * Sets a new password using an emailed token, signs out all other sessions, and signs the user in.
 */
export async function handleResetPassword(req: Request): Promise<Response> {
  if (!config.features.passwordReset) {
    return json({ error: "Password reset is currently disabled" }, 403);
  }
  if (!rateLimit(`reset:${clientIp(req)}`, 20, FIFTEEN_MINUTES)) return tooManyRequests();

  try {
    const { token, password } = await req.json().catch(() => ({}));
    if (typeof token !== "string" || !token) {
      return json({ error: "Reset token is required" }, 400);
    }

    const invalidLink = () => json({ error: "This reset link is invalid or has expired. Please request a new one." }, 400);
    const [pending] = await db
      .select({ username: users.username, email: users.email })
      .from(passwordResetTokens)
      .innerJoin(users, eq(users.id, passwordResetTokens.userId))
      .where(and(
        eq(passwordResetTokens.tokenHash, hashOneTimeToken(token)),
        gt(passwordResetTokens.expiresAt, new Date()),
      ))
      .limit(1);
    if (!pending) return invalidLink();

    const passwordError = await checkPasswordPolicy(password, pending);
    if (passwordError) return json({ error: passwordError }, 400);

    // Deleting consumes the token atomically, so it can only be used once
    const [consumed] = await db
      .delete(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, hashOneTimeToken(token)),
        gt(passwordResetTokens.expiresAt, new Date()),
      ))
      .returning({ userId: passwordResetTokens.userId });

    if (!consumed) return invalidLink();

    const passwordHash = await hashPassword(password);
    // Following the emailed link proves ownership of the address
    const [user] = await db
      .update(users)
      .set({ passwordHash, emailVerified: true, passwordChangedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, consumed.userId))
      .returning();

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await recordLogin(user.id);

    const authToken = generateToken(user.id, user.username);
    const { passwordHash: _hash, ...userWithoutPassword } = user;
    return json({ user: userWithoutPassword, token: authToken, isNewUser: false });
  } catch (error) {
    console.error("Reset password error:", error);
    return json({ error: "Could not reset the password" }, 500);
  }
}
