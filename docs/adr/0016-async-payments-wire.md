# ADR-0016: Asynchronous payments through a gateway adapter; Wire (QPay) first

Status: Accepted by the owner on 2026-11-26 (M16.1). Owner decisions behind it: real payments before go-live,
Wire first and QPay direct later (PLAN M16, 2026-11-25/26); the Wire/QPay sub-merchant contract
signed on 2026-11-26.

## Context
Checkout today pays through Saleor's dummy gateway inside one request: `transactionInitialize`
returns `CHARGE_SUCCESS` at once and the storefront calls `checkoutComplete` right after
(ARCHITECTURE §10.9). Real Mongolian payments don't work that way. With Wire
(docs.wire.mn, read 2026-11-26) the shopper leaves for a hosted page, pays with a bank app via
QPay, and the result arrives later as a signed webhook; the shopper may close the tab before
coming back. Facts that constrain the design:

- Flow: `POST /v1/payment_intents` (MNT integer amount, `metadata`, expiry 5 min–24 h, default
  1 h) → `POST /v1/checkout/sessions` (`success_url`, `cancel_url`) → hosted page →
  `payment_intent.succeeded` / `payment_failed` / `canceled` webhooks; always re-read the intent
  before fulfilling. `GET /v1/events` lists past events (catch-up after downtime).
- Webhooks: header `WirePayment-Signature: t=<unix>,v1=<hex>`, `v1 = HMAC_SHA256(secret,
  t + "." + rawBody)`, reject `t` older than 300 s; one endpoint per project; activated by a signed
  `endpoint.verification` ping that must get a 2xx; sent from 65.109.117.186; retries on 5xx,
  408, 429 and network errors.
- `Idempotency-Key` required on every POST. Refunds: `POST /v1/refunds` on a succeeded charge,
  full or partial, resulting in `succeeded`, `pending`, `failed` or **`manual_required`** (Wire
  operations complete it outside the API; QR payments count as cash in the QPay contract).
- **No test mode**: only `sk_live_` keys; every call moves real money.
- The contract requires keeping transaction evidence and system logs for 1 year (§4.2.5) and
  keeping the API key secret (§2.7). Money settles straight into the owner's bank account.
- Saleor's model for this: a `CHARGE_ACTION_REQUIRED` event while the buyer must act,
  `transactionProcess` when they return, events reported later by the payment app, and a
  periodic task that completes fully paid checkouts (`automatically_complete_fully_paid_checkouts`,
  `saleor/checkout/tasks.py`).

## Decision
1. **A gateway adapter interface** in `apps/api/src/modules/payments/gateways/`:
   `initialize(transaction, checkout) → { pspReference, actionUrl, expiresAt }`,
   `fetchStatus(pspReference) → { status, amount, chargeId }`, `refund(chargeId, amount, key) →
   { status, refundId }`, `verifyWebhook(rawBody, headers) → event | null`. Implementations: the
   existing dummy gateway (moved behind the interface, unchanged behaviour) and `wire`. A gateway is
   chosen by `gatewayId` as today; enabled gateways come from `PAYMENT_GATEWAYS` in the API's
   config (the storefront's `PAYMENT_PROVIDERS` lists what it shows). QPay direct later is a third
   implementation, nothing else changes. HTTP calls use `fetch` with a timeout; no Wire SDK.
2. **Saleor's asynchronous transaction shape.** `transactionInitialize` with a redirect gateway
   creates the transaction and a `CHARGE_ACTION_REQUIRED` event, and returns `data: { url }`
   (Saleor's `TransactionInitialize.data`). New event types: `CHARGE_ACTION_REQUIRED`,
   `CHARGE_PENDING`, `CHARGE_REQUEST`, `REFUND_PENDING`, `REFUND_FAILURE`, `CANCEL_SUCCESS`
   (Saleor's names; a migration widens the check constraint). `chargedAmount` changes only on
   `CHARGE_SUCCESS`. One payment attempt = one transaction = one PaymentIntent; its id is the
   transaction's `pspReference`, and our transaction id goes into the intent's `metadata`.
3. **The webhook is the source of truth, re-checked.** `POST /webhooks/wire` (raw body, outside
   GraphQL): verify the signature and the 300 s window; store the event as received; then
   **re-read the PaymentIntent from Wire** and apply its status, never the webhook body alone.
   Processing is idempotent: a unique index on `(provider, external_event_id)` makes a redelivery
   a no-op, and applying a status the transaction already has changes nothing. Answer 2xx once
   stored; failures in processing are retried by a job, not by making Wire resend.
4. **Every received gateway event is kept** in a new `payment_gateway_event` table (provider,
   external event id, type, raw body, signature header, received and processed timestamps,
   processing error), never deleted by the app: the contract's 1-year evidence lives in the
   database, which is backed up, not in container logs.
5. **Orders are created by the server once paid** (Saleor's automatic completion). When a
   transaction reaches `CHARGE_SUCCESS` and the checkout is fully paid, a pg-boss job completes
   the checkout into an order with the existing `checkoutComplete` logic. The storefront's return
   page only reads the state; it never needs to be reached for the order to exist.
6. **A reconciliation job** (pg-boss, every 2 minutes) re-reads Wire for transactions still in
   `CHARGE_ACTION_REQUIRED` or `CHARGE_PENDING`, and once an hour reads `GET /v1/events` since the
   last processed event, so a lost webhook or a restart loses nothing. Expired intents become
   `CHARGE_FAILURE` ("expired") and the checkout can start a new attempt.
7. **Payment window and stock.** Intents expire after **15 minutes**. `transactionInitialize`
   first runs `checkoutComplete`'s validations (stock, prices, addresses) so a doomed checkout
   never reaches the payment page. If completion still fails after payment (stock sold in the
   meantime), the job requests a full refund through the adapter, records `REFUND_REQUEST` and the
   result, keeps the transaction on the checkout, and emails staff (the existing worker).
8. **Refunds** stay Saleor's `transactionRequestAction(REFUND)` from the dashboard, now calling
   the adapter: `succeeded` → `REFUND_SUCCESS`; `pending` → `REFUND_PENDING`, then the
   reconciliation job; `failed` → `REFUND_FAILURE`; `manual_required` → `REFUND_PENDING` with the
   message "completed manually by Wire", shown as such in the dashboard until the
   `charge.refunded` webhook or a staff "mark as refunded" settles it. The refund's
   `Idempotency-Key` is our event id.
9. **Secrets and config.** `WIRE_API_KEY` and `WIRE_WEBHOOK_SECRET` in Parameter Store
   (`/commerce/wire-api-key`, `/commerce/wire-webhook-secret`, SecureString) and in the server's
   `.env.prod`, like the existing secrets (docs/deploy.md); `WIRE_API_URL` defaults to
   `https://api.wire.mn/v1`. Never logged; the config check refuses a `sk_test_` key.
   `/webhooks/wire` joins the API paths in `infra/caddy/Caddyfile` (`@api`) and
   `infra/nginx/default.conf`; the route accepts only POST with the signature header. Wire's fixed
   IP is not enforced: the signature is the check, and Caddy already sets the client address.
   The jobs run in the worker process, which owns pg-boss scheduling (ADR-0009, M8).
10. **Testing without a test mode.** A fake Wire server in the API tests and e2e (intents,
    checkout sessions, signed webhooks, refunds with each outcome); `WIRE_API_URL` points at it.
    Production is checked by the owner once: a small real payment and its refund (M16.5).

## Alternatives
- **Trust the webhook body.** Rejected: re-reading the intent costs one call and closes forged or
  replayed-but-valid-looking payloads.
- **Complete the order only when the shopper returns** (today's synchronous flow). Rejected:
  shoppers close the tab after paying in their bank app; money without an order is the worst
  outcome.
- **Wire's SDK.** Not needed: five endpoints, `fetch` and a 20-line HMAC check; no dependency.
- **Reserve stock while paying.** Deferred: Saleor doesn't reserve by default either; a short
  15-minute window, validation before paying and automatic refund on failure cover a small shop.
- **Bonum or UniPay.** See PLAN M16: Wire has the clearest API and a signed contract.

## Consequences
- One migration (event types, `payment_gateway_event`), two jobs, one webhook route, one adapter;
  QPay direct (M16.6) adds an adapter and a webhook route only.
- The dashboard shows pending and manual refunds honestly; staff get an email when an order could
  not be created after payment.
- Every Wire call in tests goes to the fake server; real-money checks are deliberate and manual.
- ARCHITECTURE §10.9 changes: `placeOrder` redirects to the gateway's `url`; a return page
  `/checkout/return?transaction=` polls the state and redirects to `/order/{token}` once the order
  exists.
