# Stripe Integration TODO

One-time donations with a custom amount, using Stripe's embedded Checkout form (`ui_mode: "form"`, API `2026-03-25.dahlia`).

## Values to Replace

**Files containing placeholders:**
- [.env.example](.env.example) (copy to `.env.local` / `.env.staging` / `.env.production`)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Secret key from https://dashboard.stripe.com/test/apikeys. Server only. |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Publishable key from the same page. |
| `DOMAIN` | `http://localhost:4200` | Public URL of the app per environment (used for the checkout `return_url`). |
| `STRIPE_CURRENCY` | `usd` | Optional. ISO currency code for donations. |

`mode` is `payment` (one-time) and `line_items` uses inline `price_data` with the amount the donor enters, so no Price ID is needed.

## Configured Parameters

**Files containing these parameters:**
- [backend/src/routes/donations.ts](backend/src/routes/donations.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | form |
| mode | payment |
| billing_address_collection | auto |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0001 |

`payment_method_collection` is only for `subscription` mode, so it is omitted.

## Setup and next steps

1. Add the four variables above to your `.env.*` files. Without the keys the button shows "Donations are not available".
2. Install dependencies: `cd backend && bun install` (adds `stripe`).
3. Run the backend (`bun dev`) and frontend (`npm start`), then click **Support our work** on the home page.

### Files
- `backend/src/routes/donations.ts` – `GET /api/donations/config` and `POST /api/donations/checkout-session` (amount in smallest currency unit, 1.00–1000.00, rate limited per IP)
- `backend/src/config/app.config.ts` – `stripe` config section
- `frontend/src/app/shared/components/donation-modal/` – dialog: amount step, then Stripe form
- `frontend/src/app/shared/services/api.service.ts` – `getDonationConfig`, `createDonationSession`

### Flow
1. Button opens the dialog, which fetches the publishable key from `/api/donations/config`.
2. Donor enters an amount; the frontend loads Stripe.js from `https://js.stripe.com/dahlia/stripe.js`.
3. Backend creates a Checkout Session and returns `{ client_secret }`.
4. The Stripe form is mounted; on `confirm` the payment is submitted.

### Testing
Use test keys and card `4242 4242 4242 4242` with any future expiry and CVC. More: https://docs.stripe.com/testing

### Not included yet
- **Webhook** (`checkout.session.completed`) for recording donations or sending receipts. Add a signature-verified `/api/webhook` with `STRIPE_WEBHOOK_SECRET` if needed.
- **Return URL handling**: `return_url` points to `/?donation=success&session_id=...` for redirect-based payment methods; the home page does not yet show a message for it.
- Not yet tested against live Stripe keys.

Resources: https://support.stripe.com and https://docs.stripe.com/mcp
