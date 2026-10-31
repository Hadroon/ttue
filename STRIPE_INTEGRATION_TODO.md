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
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Signing secret of the webhook endpoint (see "Webhook" below). Needed in staging/production. |

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

1. Add the variables above to your `.env.*` files. Without the keys the donation dialog shows "Donations are not available".
2. Install dependencies: `cd backend && bun install` (adds `stripe`).
3. Apply the migration [0016_donations.sql](backend/src/db/migrations/0016_donations.sql) to every database (local, staging, production). It is idempotent, so running it twice is safe.
4. Set up the webhook (below) for staging and production.
5. Run the backend (`bun dev`) and frontend (`npm start`). Donate via **Support our work** on the home page or a **+ 10 / + 50 / + 100** button on a Direct Action bounty-board task, then check **Admin → Donations**.

### Webhook
Create an endpoint in the Stripe Dashboard → Developers → Webhooks:
- URL: `<DOMAIN>/api/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
- Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

Without a secret the endpoint answers 503. Locally you can skip it: the browser asks the backend to confirm each payment.
To test the webhook locally, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### Files
- `backend/src/routes/donations.ts`:
  - `GET /api/donations/config`
  - `POST /api/donations/checkout-session` (amount in the smallest currency unit, 1.00–1000.00, optional context, rate limited per IP)
  - `POST /api/donations/confirm`
  - `POST /api/stripe/webhook`
- `backend/src/routes/admin.ts`: `GET /api/admin/donations` (admins only)
- `backend/src/db/schema.ts`: the `donations` table
- `backend/src/config/app.config.ts`: the `stripe` config section
- `frontend/src/app/shared/components/donation-modal/`: dialog with an amount step, then the Stripe form
- `frontend/src/app/shared/services/donation-return.service.ts`: handles the return from redirect-based payment methods
- `frontend/src/app/article-workbench/actions/direct-action.ts`: the bounty-board fund buttons open the dialog with the task as context
- `frontend/src/app/admin/`: **Donations** tab

### Flow
1. A donate button opens the dialog. A bounty-board button also passes the challenge, the action (`direct`), and the task's id, title and location.
2. The backend checks the challenge and the action, then creates a Checkout Session.
   - The context, and the user id if logged in, go into the session `metadata`, which is copied to the PaymentIntent.
   - The response is `{ client_secret, session_id }`.
3. The Stripe form is mounted. On `confirm`, the payment is submitted with `redirect: 'if_required'`, so card payments stay in the dialog.
4. The browser calls `/api/donations/confirm`. The backend retrieves the session from Stripe and stores a `donations` row only if `payment_status` is `paid`.
5. The webhook does the same for every completed session, so donations are recorded even if the donor closes the tab.
   - Rows are unique per session, so the confirm call and the webhook never create duplicates.
6. Redirect-based payment methods return to `return_url` (`?donation=success&session_id=...`). `DonationReturnService` then confirms the session, shows a thank-you and updates the task's funded counter.
7. **Admin → Donations** lists each paid donation with:
   - amount and donor
   - the challenge, linking to its Actions tab
   - the action
   - the task's title, location and id
   - a link to the payment in the Stripe Dashboard

Bounty-board tasks are only stored in the donor's browser, so a donation keeps a snapshot of the task's title, location and id at payment time.

### Testing
Use test keys and card `4242 4242 4242 4242` with any future expiry and CVC. More: https://docs.stripe.com/testing

### Not included yet
- Payouts from task donations to the people doing the work, and the auditor review that releases them.
- Receipts or thank-you emails.
- Not yet tested against live Stripe keys.

Resources: https://support.stripe.com and https://docs.stripe.com/mcp
