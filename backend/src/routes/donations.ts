import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { config } from "../config/app.config";
import { db } from "../db";
import { challengeActionItems, challengeActions, challenges, donations, users } from "../db/schema";
import { optionalAuth } from "../middleware/auth";
import { getKind, ACTION_KEYS as ACTION_KEY_LIST } from "../services/action-items";

const MIN_AMOUNT = 100; // smallest unit (e.g. cents)
const MAX_AMOUNT = 100_000;

const ACTION_KEYS = new Set<string>(ACTION_KEY_LIST);
const ACTION_LABELS: Record<string, string> = {
  legal: "Legal action",
  economic: "Economic pressure",
  direct: "Direct action",
  policy: "Policy & lobbying",
  info: "Information campaigns",
  protest: "Protests",
};

// The kind of action-form entry a donation can be earmarked for, per action
const TARGET_KINDS: Record<string, string> = { direct: "task", legal: "case" };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, {
      // The embedded form (ui_mode "form") requires Dahlia or later
      apiVersion: "2026-03-25.dahlia" as unknown as Stripe.LatestApiVersion,
    })
  : null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRateLimited(req: Request): boolean {
  const key = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/** Trimmed string capped to Stripe's 500-char metadata value limit, or undefined if empty */
function clean(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim().slice(0, max);
  return text || undefined;
}

/** Store a paid donation from a Checkout Session. Safe to call more than once for the same session. */
export async function recordPaidSession(session: Stripe.Checkout.Session): Promise<boolean> {
  const meta = session.metadata ?? {};
  if (meta.kind !== "donation" || session.payment_status !== "paid") return false;

  const toId = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
  let userId = toId(meta.user_id);
  let challengeId = toId(meta.challenge_id);
  // Rows may have been deleted between checkout and payment; keep the snapshot, drop the reference
  if (userId !== null) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!u) userId = null;
  }
  if (challengeId !== null) {
    const [c] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!c) challengeId = null;
  }

  await db
    .insert(donations)
    .values({
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
      livemode: session.livemode,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? config.stripe.currency,
      donorEmail: session.customer_details?.email ?? null,
      donorName: session.customer_details?.name ?? null,
      userId,
      challengeId,
      challengeTitle: meta.challenge_title || null,
      actionKey: meta.action_key || null,
      targetId: meta.target_id || null,
      targetTitle: meta.target_title || null,
      targetLocation: meta.target_location || null,
    })
    .onConflictDoNothing({ target: donations.stripeSessionId });

  if (meta.action_key === "direct" && challengeId !== null && meta.target_id && /^\d+$/.test(meta.target_id)) {
    await markTaskFundedIfCovered(challengeId, Number(meta.target_id));
  }
  return true;
}

/** An Open bounty-board task becomes Funded once confirmed donations cover its cost (amounts are in cents) */
export async function markTaskFundedIfCovered(challengeId: number, taskId: number): Promise<void> {
  const [task] = await db
    .select({ id: challengeActionItems.id, data: challengeActionItems.data })
    .from(challengeActionItems)
    .where(and(
      eq(challengeActionItems.id, taskId),
      eq(challengeActionItems.challengeId, challengeId),
      eq(challengeActionItems.kind, "task"),
    ))
    .limit(1);
  if (!task || task.data.status !== "Open") return;

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${donations.amount}), 0)::float8` })
    .from(donations)
    .where(and(
      eq(donations.challengeId, challengeId),
      eq(donations.actionKey, "direct"),
      eq(donations.targetId, String(taskId)),
    ));
  if (total >= Number(task.data.cost) * 100) {
    await db
      .update(challengeActionItems)
      .set({ data: { ...task.data, status: "Funded" }, updatedAt: new Date() })
      .where(eq(challengeActionItems.id, taskId));
  }
}

export async function handleGetDonationConfig(_req: Request): Promise<Response> {
  return json({
    publishableKey: config.stripe.publishableKey || null,
    currency: config.stripe.currency,
    minAmount: MIN_AMOUNT,
    maxAmount: MAX_AMOUNT,
    enabled: !!stripe && !!config.stripe.publishableKey,
  });
}

// POST /api/donations/checkout-session  { amount, context? }
export async function handleCreateDonationSession(req: Request): Promise<Response> {
  if (!stripe) {
    return json({ error: "Donations are not configured" }, 503);
  }
  if (isRateLimited(req)) {
    return json({ error: "Too many requests" }, 429);
  }

  let body: { amount?: unknown; context?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request format" }, 400);
  }

  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return json({ error: `Amount must be a whole number between ${MIN_AMOUNT} and ${MAX_AMOUNT}` }, 400);
  }

  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const metadata: Record<string, string> = { kind: "donation" };

  const { user } = await optionalAuth(req);
  if (user) metadata.user_id = String(user.userId);

  let challengeId: number | null = null;
  if (ctx.challengeId !== undefined && ctx.challengeId !== null) {
    challengeId = Number(ctx.challengeId);
    if (!Number.isInteger(challengeId) || challengeId <= 0) {
      return json({ error: "Invalid challenge" }, 400);
    }
    const [challenge] = await db
      .select({ id: challenges.id, title: challenges.title })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);
    if (!challenge) {
      return json({ error: "Challenge not found" }, 400);
    }
    metadata.challenge_id = String(challenge.id);
    metadata.challenge_title = challenge.title.slice(0, 200);
  }

  const actionKey = clean(ctx.actionKey, 20);
  if (actionKey) {
    if (!ACTION_KEYS.has(actionKey) || challengeId === null) {
      return json({ error: "Invalid action" }, 400);
    }
    const [approved] = await db
      .select({ key: challengeActions.actionKey })
      .from(challengeActions)
      .where(and(eq(challengeActions.challengeId, challengeId), eq(challengeActions.actionKey, actionKey)))
      .limit(1);
    if (!approved) {
      return json({ error: "This action is not approved for donations yet" }, 403);
    }
    metadata.action_key = actionKey;
  }

  let targetId = clean(ctx.targetId, 40);
  let targetTitle = clean(ctx.targetTitle);
  let targetLocation = clean(ctx.targetLocation);
  if ((targetId || targetTitle || targetLocation) && !actionKey) {
    return json({ error: "A target needs an action" }, 400);
  }
  if (targetId) {
    // A target must be a real entry of this challenge (a task for direct action, a case for legal action);
    // its stored details replace what the browser sent
    const targetKind = actionKey ? TARGET_KINDS[actionKey] : undefined;
    const [target] = targetKind && challengeId !== null && /^\d+$/.test(targetId)
      ? await db
          .select({ data: challengeActionItems.data })
          .from(challengeActionItems)
          .where(and(
            eq(challengeActionItems.id, Number(targetId)),
            eq(challengeActionItems.challengeId, challengeId),
            eq(challengeActionItems.kind, targetKind),
          ))
          .limit(1)
      : [];
    if (!target) {
      return json({ error: "Donation target not found" }, 400);
    }
    if (targetKind && getKind(targetKind)?.approval && target.data.approval !== "Approved") {
      return json({ error: "This entry is waiting for admin approval" }, 403);
    }
    targetTitle = clean(actionKey === "legal" ? target.data.target : target.data.title);
    targetLocation = clean(actionKey === "legal" ? target.data.jurisdiction : target.data.location);
  }
  if (targetId) metadata.target_id = targetId;
  if (targetTitle) metadata.target_title = targetTitle;
  if (targetLocation) metadata.target_location = targetLocation;

  const description = [
    "Donation",
    metadata.challenge_title && `Challenge #${metadata.challenge_id}: ${metadata.challenge_title}`,
    actionKey && ACTION_LABELS[actionKey],
    targetTitle && `For: ${targetTitle}`,
  ].filter(Boolean).join(" · ").slice(0, 500);

  try {
    const domain = config.stripe.domain || req.headers.get("origin") || new URL(req.url).origin;
    const returnPath = challengeId !== null
      ? `/article-workbench?challengeId=${challengeId}&section=actions&donation=success&session_id={CHECKOUT_SESSION_ID}`
      : `/?donation=success&session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      ui_mode: "form",
      mode: "payment",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      submit_type: "auto",
      integration_identifier: "custom_embedded_web_0001",
      return_url: `${domain}${returnPath}`,
      metadata,
      payment_intent_data: { metadata, description },
      line_items: [
        {
          price_data: {
            currency: config.stripe.currency,
            unit_amount: amount,
            product_data: {
              name: targetTitle ? `Earth Forum donation – ${targetTitle}`.slice(0, 250) : "Support Earth Forum",
            },
          },
          quantity: 1,
        },
      ],
    });

    return json({ client_secret: session.client_secret, session_id: session.id });
  } catch (error) {
    console.error("Stripe checkout session error:", error);
    return json({ error: "Could not start the payment" }, 502);
  }
}

// POST /api/donations/confirm  { sessionId }
// Called by the browser after paying. The status is read from Stripe, never taken from the client.
export async function handleConfirmDonation(req: Request): Promise<Response> {
  if (!stripe) {
    return json({ error: "Donations are not configured" }, 503);
  }
  if (isRateLimited(req)) {
    return json({ error: "Too many requests" }, 429);
  }

  let sessionId: unknown;
  try {
    ({ sessionId } = await req.json());
  } catch {
    return json({ error: "Invalid request format" }, 400);
  }
  if (typeof sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    return json({ error: "Invalid session" }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.kind !== "donation") {
      return json({ error: "Invalid session" }, 400);
    }
    const paid = await recordPaidSession(session);
    const meta = session.metadata ?? {};
    return json({
      paid,
      status: session.status,
      paymentStatus: session.payment_status,
      amount: session.amount_total ?? 0,
      currency: session.currency,
      challengeId: meta.challenge_id ? Number(meta.challenge_id) : null,
      actionKey: meta.action_key ?? null,
      targetId: meta.target_id ?? null,
    });
  } catch (error) {
    console.error("Donation confirm error:", error);
    return json({ error: "Could not confirm the payment" }, 502);
  }
}

// POST /api/stripe/webhook  (configure in the Stripe Dashboard → Developers → Webhooks)
export async function handleStripeWebhook(req: Request): Promise<Response> {
  const secret = config.stripe.webhookSecret;
  if (!stripe || !secret) {
    console.error("Stripe webhook called but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET is not configured");
    return json({ error: "Webhook not configured" }, 503);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "Missing signature" }, 400);
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret);
  } catch (error) {
    console.warn("Stripe webhook signature verification failed:", (error as Error).message);
    return json({ error: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await recordPaidSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.async_payment_failed":
        console.warn("Donation payment failed:", (event.data.object as Stripe.Checkout.Session).id);
        break;
    }
  } catch (error) {
    // A non-2xx response makes Stripe retry the event later
    console.error("Stripe webhook handling error:", error);
    return json({ error: "Webhook handling failed" }, 500);
  }

  return json({ received: true });
}
