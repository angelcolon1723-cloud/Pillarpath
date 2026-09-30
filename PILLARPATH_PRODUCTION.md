# Pillarpath production connections

The app is structured for a real deployment. No secrets are stored in the repository.

## Required production services

- Better Auth + Neon/Postgres: enabled in `.grok/app-env.json` and migrations.
- Stripe Checkout: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as server secrets. Checkout is created server-side; raw card data never touches Pillarpath. Stripe Checkout supports hosted one-time payments and shipping collection. See the official Stripe Checkout API documentation.
- Dropshipping supplier: set `DROPSHIP_API_URL` and `DROPSHIP_API_KEY` for a supplier endpoint that accepts the normalized order payload from `src/lib/dropship.ts`.
- Public app URL: set `BETTER_AUTH_URL` so payment redirects return to the deployed app.

## Commerce flow

1. Parent signs in.
2. Parent or child adds curated catalog items to the basket.
3. Child cannot complete checkout; parent must review.
4. Parent enters delivery details.
5. With Stripe configured, Pillarpath creates a hosted Checkout Session and redirects to Stripe.
6. Stripe webhook marks the order paid.
7. The generic supplier adapter submits the paid order if a dropship provider is configured; otherwise fulfillment remains queued for manual/provider sync.
8. Orders and fulfillment statuses are visible in the parent workspace.

## Marketing flow

Marketing includes campaign records, budgets, promo codes, referral codes, and basic conversion counters. The data model is ready for a future email/ads provider connector without exposing provider credentials to the browser.

## Important launch work

Before taking real customer payments, connect Stripe, configure the webhook endpoint `/api/webhooks/stripe`, connect a supplier API, configure taxes/shipping policies, add legal/privacy/terms pages, and run end-to-end payment and fulfillment tests in Stripe test mode.
