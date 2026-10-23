import Stripe from "stripe";
import { config } from "../config/app.config";

const MIN_AMOUNT = 100; // smallest unit (e.g. cents)
const MAX_AMOUNT = 100_000;

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
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
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

export async function handleCreateDonationSession(req: Request): Promise<Response> {
  if (!stripe) {
    return json({ error: "Donations are not configured" }, 503);
  }
  if (isRateLimited(req)) {
    return json({ error: "Too many requests" }, 429);
  }

  let amount: unknown;
  try {
    ({ amount } = await req.json());
  } catch {
    return json({ error: "Invalid request format" }, 400);
  }

  if (!Number.isInteger(amount) || (amount as number) < MIN_AMOUNT || (amount as number) > MAX_AMOUNT) {
    return json({ error: `Amount must be a whole number between ${MIN_AMOUNT} and ${MAX_AMOUNT}` }, 400);
  }

  try {
    const domain = config.stripe.domain || req.headers.get("origin") || new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      ui_mode: "form",
      mode: "payment",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      submit_type: "auto",
      integration_identifier: "custom_embedded_web_0001",
      return_url: `${domain}/?donation=success&session_id={CHECKOUT_SESSION_ID}`,
      line_items: [
        {
          price_data: {
            currency: config.stripe.currency,
            unit_amount: amount as number,
            product_data: { name: "Support Earth Forum" },
          },
          quantity: 1,
        },
      ],
    });

    return json({ client_secret: session.client_secret });
  } catch (error) {
    console.error("Stripe checkout session error:", error);
    return json({ error: "Could not start the payment" }, 502);
  }
}
