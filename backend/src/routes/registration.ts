import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db";
import { emailVerificationTokens, users } from "../db/schema";
import { config } from "../config/app.config";
import {
  checkPasswordPolicy,
  generateToken,
  hashOneTimeToken,
  hashPassword,
  isValidEmail,
  newOneTimeToken,
  normalizeEmail,
  validateUsername,
} from "../utils/auth";
import { escapeHtml, sendEmail } from "../utils/email";
import { clientIp, rateLimit, tooManyRequests } from "../utils/rate-limit";
import { TEXT_LIMITS } from "../utils/text-limits";
import { recordLogin } from "./auth";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// Minimum gap between emails to the same address
const RESEND_COOLDOWN_MS = 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function disabled(): Response {
  return json({ error: "Registration is currently disabled" }, 403);
}

async function findUserByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  return user;
}

async function isUsernameTaken(username: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
    .limit(1);
  return !!row;
}

/** Looks up an unexpired sign-up token and returns its email. */
async function findPendingEmail(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  const [row] = await db
    .select({ email: emailVerificationTokens.email })
    .from(emailVerificationTokens)
    .where(and(
      eq(emailVerificationTokens.tokenHash, hashOneTimeToken(token)),
      gt(emailVerificationTokens.expiresAt, new Date()),
    ))
    .limit(1);
  return row?.email ?? null;
}

export function buildVerificationEmail(link: string) {
  const safeLink = escapeHtml(link);
  return {
    subject: "Confirm your email for Time to unite Earth",
    text:
      `Welcome to Time to unite Earth!\n\n` +
      `Open this link within 24 hours to confirm your email and choose your username and password:\n\n${link}\n\n` +
      `If you didn't try to sign up, you can ignore this email.`,
    html:
      `<p>Welcome to Time to unite Earth!</p>` +
      `<p><a href="${safeLink}">Confirm your email and finish signing up</a> (the link is valid for 24 hours).</p>` +
      `<p>If you didn't try to sign up, you can ignore this email.</p>`,
  };
}

export function buildAlreadyRegisteredEmail(signInUrl: string) {
  const safeUrl = escapeHtml(signInUrl);
  return {
    subject: "You already have a Time to unite Earth account",
    text:
      `Someone (hopefully you) tried to sign up for Time to unite Earth with this email address, ` +
      `but it already has an account.\n\nSign in at ${signInUrl}. If you've forgotten your password, ` +
      `use "Forgot password?" in the sign-in window. If the account was created with Google, you can also sign in with Google.\n\n` +
      `If this wasn't you, you can ignore this email.`,
    html:
      `<p>Someone (hopefully you) tried to sign up for Time to unite Earth with this email address, but it already has an account.</p>` +
      `<p><a href="${safeUrl}">Sign in</a>. If you've forgotten your password, use "Forgot password?" in the sign-in window. ` +
      `If the account was created with Google, you can also sign in with Google.</p>` +
      `<p>If this wasn't you, you can ignore this email.</p>`,
  };
}

/**
 * Step 1: takes only an email and sends a confirmation link. Responds the same whether or not
 * the address already has an account, so sign-up can't be used to discover registered emails.
 */
export async function handleStartRegistration(req: Request): Promise<Response> {
  if (!config.features.registration) return disabled();
  if (!rateLimit(`register:${clientIp(req)}`, 10, FIFTEEN_MINUTES)) return tooManyRequests();

  try {
    const { email: rawEmail } = await req.json().catch(() => ({}));
    if (typeof rawEmail !== "string" || rawEmail.length > TEXT_LIMITS.email || !isValidEmail(normalizeEmail(rawEmail))) {
      return json({ error: "Please enter a valid email address" }, 400);
    }
    const email = normalizeEmail(rawEmail);

    // Not awaited, so response timing doesn't reveal whether the account exists
    void sendSignUpEmail(email).catch((error) => console.error("Sign-up email error:", error));

    return json({ message: "Check your inbox for a link to finish signing up." });
  } catch (error) {
    console.error("Start registration error:", error);
    return json({ error: "Could not start registration" }, 500);
  }
}

async function sendSignUpEmail(email: string) {
  const [recent] = await db
    .select({ id: emailVerificationTokens.id })
    .from(emailVerificationTokens)
    .where(and(
      eq(emailVerificationTokens.email, email),
      gt(emailVerificationTokens.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
    ))
    .limit(1);
  if (recent) return;

  if (await findUserByEmail(email)) {
    // Record the send so the cooldown also covers this email; the token itself is never usable
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, email));
    await db.insert(emailVerificationTokens).values({
      email,
      tokenHash: newOneTimeToken().hash,
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    await sendEmail({ to: email, ...buildAlreadyRegisteredEmail(config.appUrl) });
    return;
  }

  const { token, hash } = newOneTimeToken();
  // Only the newest link stays valid
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, email));
  await db.insert(emailVerificationTokens).values({
    email,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    createdAt: new Date(),
  });

  const link = `${config.appUrl}/complete-registration?token=${encodeURIComponent(token)}`;
  if (!(await sendEmail({ to: email, ...buildVerificationEmail(link) }))) {
    console.error("Sign-up confirmation email could not be sent");
  }
}

/**
 * Step 2 (page load): checks the emailed link and returns the confirmed address.
 */
export async function handleVerifyRegistration(req: Request): Promise<Response> {
  if (!config.features.registration) return disabled();
  if (!rateLimit(`register-verify:${clientIp(req)}`, 30, FIFTEEN_MINUTES)) return tooManyRequests();

  const token = new URL(req.url).searchParams.get("token");
  const email = await findPendingEmail(token);
  if (!email) {
    return json({ error: "This sign-up link is invalid or has expired. Please sign up again to get a new one." }, 400);
  }
  return json({ email });
}

/**
 * Lets the sign-up form check a username before submitting.
 */
export async function handleUsernameAvailable(req: Request): Promise<Response> {
  if (!rateLimit(`username-check:${clientIp(req)}`, 120, FIFTEEN_MINUTES)) return tooManyRequests();

  const username = new URL(req.url).searchParams.get("username")?.trim() ?? "";
  const error = validateUsername(username);
  if (error) return json({ available: false, error });
  if (await isUsernameTaken(username)) return json({ available: false, error: "Username already taken" });
  return json({ available: true });
}

/**
 * Step 3: creates the verified account with the chosen username and password and signs the user in.
 */
export async function handleCompleteRegistration(req: Request): Promise<Response> {
  if (!config.features.registration) return disabled();
  if (!rateLimit(`register-complete:${clientIp(req)}`, 20, FIFTEEN_MINUTES)) return tooManyRequests();

  try {
    const { token, username: rawUsername, password } = await req.json().catch(() => ({}));
    const email = await findPendingEmail(token);
    if (!email) {
      return json({ error: "This sign-up link is invalid or has expired. Please sign up again to get a new one." }, 400);
    }

    const username = typeof rawUsername === "string" ? rawUsername.trim() : rawUsername;
    const usernameError = validateUsername(username);
    if (usernameError) return json({ error: usernameError, field: "username" }, 400);
    if (await isUsernameTaken(username)) return json({ error: "Username already taken", field: "username" }, 409);

    const passwordError = await checkPasswordPolicy(password, { username, email });
    if (passwordError) return json({ error: passwordError, field: "password" }, 400);

    // Signed up with Google (or another tab) after the link was sent
    if (await findUserByEmail(email)) {
      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, email));
      return json({ error: "This email already has an account. Please sign in instead." }, 409);
    }

    const passwordHash = await hashPassword(password);
    const newUser = await db.transaction(async (tx) => {
      // Consuming the token inside the transaction makes it single-use even under concurrent submits
      const [consumed] = await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.tokenHash, hashOneTimeToken(token)))
        .returning({ id: emailVerificationTokens.id });
      if (!consumed) return null;

      const [created] = await tx
        .insert(users)
        .values({
          username,
          email,
          passwordHash,
          displayName: username,
          emailVerified: true,
          isAdmin: config.adminEmails.includes(email),
        })
        .returning();
      await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, email));
      return created;
    });

    if (!newUser) {
      return json({ error: "This sign-up link has already been used. Please sign in." }, 400);
    }

    await recordLogin(newUser.id);
    const authToken = generateToken(newUser.id, newUser.username);
    const { passwordHash: _hash, ...userWithoutPassword } = newUser;
    return json({ user: userWithoutPassword, token: authToken, isNewUser: true }, 201);
  } catch (error: any) {
    // Lost a race against a concurrent registration with the same username/email
    if ((error?.code ?? error?.cause?.code) === "23505") {
      return json({ error: "That username or email was just taken. Please try another username." }, 409);
    }
    console.error("Complete registration error:", error);
    return json({ error: "Registration failed" }, 500);
  }
}
