# Architecture

Status: **Accepted** (2026-11-06). Decisions marked *(ADR-NNNN)* are explained in
`docs/adr/`. Reference paths are relative to this repo's parent directory
(`../saleor-core`, `../saleor-dashboard`, `../saleor-storefront`).

---

## 1. System overview

```
 ┌────────────────────┐      ┌────────────────────┐
 │ apps/dashboard     │      │ apps/storefront    │
 │ Vite SPA, Macaw UI │      │ Next.js App Router │
 │ Glide, Apollo      │      │ RSC + Server Actions│
 └─────────┬──────────┘      └─────────┬──────────┘
           │ GraphQL over HTTP (cookie session, CSRF header)
           ▼                           ▼
 ┌──────────────────────────────────────────────────┐
 │ apps/api  — one Node process (modular monolith)  │
 │  GraphQL Yoga ─ Pothos schema (thin resolvers)   │
 │  ── modules ───────────────────────────────────  │
 │  shop · identity · catalog · inventory ·         │
 │  checkout · payments · orders                    │
 │  ── Drizzle ORM ────────────────────────────────  │
 └─────────────────────────┬────────────────────────┘
                           ▼
                   PostgreSQL 18 (docker compose)
```

- **Headless / API-first**: the dashboard and storefront are ordinary API clients with no
  privileged backdoor. Anything the dashboard does, a script holding a staff session can do too.
- **Modular monolith** *(ADR-0001)*: one deployable unit with one database, split into modules
  that own their tables and expose a small public interface.
- **One GraphQL endpoint** (`/graphql`) for both staff and customers, like Saleor. Permissions decide
  what each caller can see and do (§8).

### Repository layout

```
apps/
  api/          src/{server.ts, graphql/…, modules/<m>/…}, schema.graphql
  dashboard/    src/{app, components, <section>/{views,components,queries.ts,urls.ts}}
  storefront/   src/app/…
packages/
  contracts/    @commerce/contracts: dependency-free domain contracts shared by all apps
                (Money first; ADR-0012). Consumed as TS source.
  db/           @commerce/db: Drizzle client (getDb, closeDb, Db/Tx/Executor), schema/<module>.ts,
                drizzle/ migrations (ADR-0011). Consumed as TS source, no build step.
  tsconfig/     shared tsconfig bases
docs/adr/
docker-compose.yml
```

Shared packages are created only when two apps actually share code. Clients do **not** share a
GraphQL package: each one runs codegen against `apps/api/schema.graphql` itself.

---

## 2. Backend module boundaries

| Module | Owns tables | Responsibility | Saleor reference |
|---|---|---|---|
| `shop` | `shop_settings` | name, currency, default country, single-row config | `saleor/site/models.py` |
| `identity` | `user`, `address`, `session`, `permission_group`, `permission_group_permission`, `user_permission_group` | staff & customer accounts, login, sessions, permissions | `saleor/account/models.py`, `saleor/permission/` |
| `catalog` | `category`, `product`, `product_variant`, `product_media` | catalog structure, pricing (single channel), publication | `saleor/product/models.py` |
| `inventory` | `warehouse`, `stock`, `allocation` | stock levels, availability, allocation/deallocation | `saleor/warehouse/models.py`, `saleor/warehouse/management.py` |
| `checkout` | `checkout`, `checkout_line`, `shipping_method` | carts, address/shipping selection, price calculation, completion orchestration | `saleor/checkout/` |
| `payments` | `payment_transaction`, `payment_event` | recording authorize/charge/refund against a checkout or order; provider adapters | `saleor/payment/models.py` (`TransactionItem`, `TransactionEvent`) |
| `orders` | `order`, `order_line`, `fulfillment`, `fulfillment_line`, `order_event` | immutable order records, lifecycle, fulfillment, cancellation, timeline | `saleor/order/models.py`, `saleor/order/actions.py` |
| `jobs` | none (pg-boss owns the `pgboss` schema) | background jobs as a transactional outbox, the worker, outgoing email (M8.1, ADR-0009) | `saleor/celeryconf.py`, `saleor/core/tasks`, the user-email plugin |

**Rules:**

1. A module's tables are written **only** by that module's own code.
2. Other modules import only from `modules/<m>/index.ts`, which holds plain functions. No classes,
   DI container or event bus. The one exception is the GraphQL layer: a module may extend another
   module's GraphQL object (e.g. inventory adds `ProductVariant.stocks`) by importing that object's
   ref from the owning module's GraphQL file; its resolvers still read data through `index.ts`
   functions or loaders. The GraphQL layer is also where modules compose (owner, 2026-11-11):
   catalog's GraphQL files call `inventory/index.ts` for `productVariantCreate(stocks)` and the
   `stockAvailability` filter (inventory supplies the in-stock subquery as SQL, so `stock` is
   only queried by inventory code).
3. Cross-module functions receive the caller's transaction (`tx`) explicitly. That is how
   checkout completion spans `checkout`, `inventory`, `payments` and `orders` atomically.
4. Reads across modules also go through public functions or DataLoaders, so the dependency stays
   visible in the code.
5. Dependency direction is acyclic:
   `orders → inventory, catalog, payments, identity`; `checkout → catalog, inventory, payments,
   orders, identity`; `inventory → catalog`. `catalog`'s domain code depends on nothing (its
   GraphQL files may use `inventory`, rule 2).
6. Lock order for catalog and stock writes: product → variant → stock rows by `id`
   (`lockProductVariant`), so stock, variant and product writes can't deadlock. Checkout
   completion follows the same variant-before-stock order: checkout → variants (`FOR KEY SHARE`,
   by id, `lockVariantsForKeyShare`) → stock rows by id. Without the variant step a completion
   holding a stock row and inserting an order line (FK key-share on the variant) deadlocks with a
   stock write holding that variant (M5.4's race test shows "deadlock detected" without it).

**Inside a module:**

```
modules/catalog/
  index.ts         public API (re-exports selected service functions + types)
  service.ts       use cases: validation, business rules, transactions
  queries.ts       Drizzle queries (read models, filters, pagination)
  graphql.ts       Pothos types/queries/mutations — thin: parse → authorize → call service → map
  errors.ts        error code enum for this module (ProductErrorCode, …)
  *.test.ts
```

Table definitions live in `packages/db/src/schema/<module>.ts` (one file per module) so that
migrations are generated in one place. Ownership is unchanged: only the owning module's code
writes those tables. Every query and service function takes an `Executor` (`Db | Tx`) parameter
rather than calling `getDb()` itself, so callers decide whether it runs inside a transaction;
functions that must run in one take `Tx`, which the compiler enforces.

Resolvers contain no business rules. Services know nothing about GraphQL. This matches Saleor's
split between `saleor/<domain>/` (logic) and `saleor/graphql/<domain>/` (API), without the plugin
manager layer.

---

## 3. Domain entities and invariants

Identifiers: UUID primary keys (v7, time-ordered, generated by Postgres 18 `uuidv7()` defaults) *(ADR-0010)*. Orders also get a human-readable
`number` taken from a sequence, as Saleor does.

### Shop
- `shop_settings` is a single row: `name`, `currency char(3)`, `default_country char(2)`.
- **Invariant:** exactly one row (enforced by a `CHECK (id = 1)` primary key).

### Identity
- `user(id, email citext unique, password_hash, first_name, last_name, is_staff, is_superuser, is_active, created_at,
  updated_at, last_login)`. Staff and customers share one table, like Saleor's `account.User`.
  Saleor's customers are the non-staff users plus staff users who placed an order (M7.3).
- `address(id, user_id null, first_name, last_name, street_1, street_2, city, postal_code, country, phone)`.
- `session(id, token_hash unique, user_id, expires_at, created_at, last_seen_at)` *(ADR-0006)*.
- `permission_group(id, name)`, `permission_group_permission(group_id, code)`,
  `user_permission_group(user_id, group_id)`.
- **Invariants:** email is unique case-insensitively. Permission codes come from a closed enum.
  Only staff users can belong to permission groups. At least one active superuser must remain
  (checked when a user is deactivated or demoted).

### Catalog
- `category(id, parent_id null, name, slug unique, description jsonb, description_plaintext, updated_at)`.
  Categories form a tree. As in Saleor, the parent is set only at creation (`categoryUpdate` can't
  re-parent), so cycles can't form. Saleor uses MPTT; we use `parent_id` plus recursive CTEs, which
  is simpler and fast enough at our size. `description` is EditorJS JSON, as Saleor.
- `product(id, category_id, name, slug unique, description jsonb, is_published, published_at, created_at, updated_at)`.
- `product_variant(id, product_id, sku unique null, name, price_amount bigint (minor units, ADR-0013), currency, track_inventory bool, weight_grams null, position)`.
- `product_media(id, product_id, image_key, content_type, alt ≤ 250, sort_order)` and
  `product_media_thumbnail(media_id, size, format, image_key)`: files live in S3 under
  `image_key`, thumbnails are made on demand in Saleor's sizes (ADR-0014).
- **Invariants:** publishing a product requires a category (Saleor's `PRODUCT_WITHOUT_CATEGORY`)
  and at least one variant (ours, `PRODUCT_WITHOUT_VARIANTS`); the last variant of a published
  product can't be deleted. Both checks lock the product row. The category rule is checked at
  publish time only: deleting a category still sets `category_id` NULL on published products. `price_amount >= 0`. Variant currency = shop currency
  (checked in the service, and stored per row so multi-currency stays possible later *(ADR-0005)*).
  Deleting a variant or product never deletes order history: order lines keep snapshots and use
  `ON DELETE SET NULL` foreign keys.
- *Not modelled yet:* product types, attributes, collections, channel listings.

### Inventory
- `warehouse(id, name, address…)`, seeded with one row.
- `stock(id, warehouse_id, variant_id, quantity int, quantity_allocated int, unique(warehouse_id, variant_id))`.
- `allocation(id, order_line_id, stock_id, quantity_allocated, unique(order_line_id, stock_id))`.
- **Invariants:** enforced by DB `CHECK` constraints:
  - `quantity >= 0`, `quantity_allocated >= 0`, `quantity_allocated <= quantity`.
  - `stock.quantity_allocated = SUM(allocation.quantity_allocated)` for that stock. This is
    maintained in the same transaction by the only two functions allowed to change allocations.
  - Available to sell = `quantity - quantity_allocated`.

  Reference: `saleor/warehouse/models.py` (`Stock`, `Allocation`) and
  `saleor/warehouse/management.py` (`allocate_stocks`, `deallocate_stock`, `decrease_stock`).
  Saleor also has `Reservation` for holding stock during checkout. We leave it out (§5.3).

### Checkout
- `checkout(id uuid v4 = the token, user_id null, email null, shipping_address jsonb null, billing_address jsonb null, shipping_method_id null, currency, created_at, updated_at, completed_order_id null)`.
- `checkout_line(id, checkout_id, variant_id, quantity, unique(checkout_id, variant_id))`.
- `shipping_method(id, name, price_amount, currency, is_active)`. This is a flat-rate list with no
  zones or countries yet. Saleor's reference is `saleor/shipping/models.py`.
- **Invariants:** `quantity > 0`. A checkout holds **no stored prices**: totals are always
  computed from current variant prices (§5.2). Once `completed_order_id` is set, the checkout is
  read-only. The id is a random v4 UUID and doubles as Saleor's checkout token (the global ID is
  `Checkout:<uuid>`, as Saleor's), so anyone holding it can use the checkout (PLAN M5 decision 4).

### Payments
- `payment_transaction(id, checkout_id null, order_id null, provider, name, psp_reference, currency, authorized_amount, charged_amount, refunded_amount, idempotency_key, created_at, modified_at)`; unique `(provider, idempotency_key)`.
- `payment_event(id, transaction_id, type, amount, currency, psp_reference, message, created_at)` is an
  append-only log (a trigger rejects UPDATE and DELETE).
- **Invariants:** amounts are ≥ 0, and `charged + refunded ≤ authorized + charged` (no refunding
  more than was charged). Events are never updated or deleted. A transaction belongs to a checkout
  *or* an order; completion moves it from one to the other.
  Modelled after Saleor's `TransactionItem`/`TransactionEvent` (`saleor/payment/models.py`), with
  far fewer states.

### Orders
- `order(id, number bigint unique, status, user_id null, user_email, billing_address jsonb, shipping_address jsonb, shipping_method_name, shipping_price_amount, subtotal_amount, total_amount, currency, checkout_token unique null, created_at, updated_at)`.
- `order_line(id, order_id, variant_id null, product_name, variant_name, product_sku, quantity, quantity_fulfilled, unit_price_amount, total_price_amount, currency, created_at)`; CHECKs `total = unit × quantity` and `total = subtotal + shipping` on the order; `number` is an identity column.
- `fulfillment(id, order_id, fulfillment_order, status, warehouse_id null, created_at)`, unique
  `(order_id, fulfillment_order)`, and `fulfillment_line(id, fulfillment_id, order_line_id,
  quantity > 0)`. One fulfillment per warehouse per `orderFulfill`; only `FULFILLED` exists.
- `order_event(id, order_id, type, user_id null, payload jsonb, created_at)` drives the timeline
  view in the dashboard, like Saleor's `OrderEvent`. It is append-only (a trigger rejects UPDATE and
  DELETE; only `user_id` may be cleared when a staff user is deleted). Types: `PLACED`,
  `FULFILLMENT_FULFILLED_ITEMS`, `CANCELED`, `ORDER_MARKED_AS_PAID`, `TRANSACTION_REFUND_REQUESTED`.
- **Status machine** (a subset of Saleor's `OrderStatus` in `saleor/order/__init__.py`):
  `UNFULFILLED → PARTIALLY_FULFILLED → FULFILLED`, with `UNFULFILLED → CANCELED` also allowed.
  Payment status is *derived* from transactions (`NOT_CHARGED | PARTIALLY_CHARGED | FULLY_CHARGED | REFUNDED`)
  and never stored as a second source of truth.
- **Invariants:** lines are snapshots (names, SKU, prices) and stay correct if the catalog changes.
  Totals are fixed at creation. `0 ≤ quantity_fulfilled ≤ quantity`. A canceled order has no
  allocations. `checkout_token` is unique, which makes completion idempotent (§5.4).
- Addresses are copied into the order as JSON snapshots, never referenced by foreign key, so later
  edits to the customer's address book don't change past orders.

---

## 4. GraphQL and database responsibilities

**The GraphQL layer** handles:
- Transport, authentication context, authorization checks, input parsing (global ID decoding,
  money string → minor units via `@commerce/contracts`), and mapping to output types.
- The public contract. It follows Saleor's naming and shape where we implement the same concept:
  `products`, `product(id|slug)`, `productCreate`, `checkoutLinesAdd`, `checkoutComplete`,
  `orderFulfill`, and so on *(ADR-0010)*.
- Connections: `first/after/last/before`, `edges{node cursor}`, `pageInfo`, `totalCount`.
  Pagination is keyset-based: the cursor encodes `(sort value, id)`.
- Expected failures come back as data: `{ product, errors: [ProductError{ field, code, message }] }`.
  Unexpected failures are thrown and masked by Yoga (logged server-side with a request id).
- N+1 protection: per-request DataLoaders, added when the first nested list needs them (M2.2).
  Saleor's equivalent is `saleor/graphql/*/dataloaders`.

**Naming:** use Saleor's operation, type, field and enum names by default (`products`,
`productCreate`, `checkoutLinesAdd`, `checkoutComplete`, `ProductErrorCode`, …). Deviate only
when our name is clearer for our scope. Each deviation is recorded here so the mapping back to
Saleor stays obvious:

| Ours | Saleor | Reason |
|---|---|---|
| `tokenCreate` returns `user` and `errors` only, no `token`/`refreshToken`/`csrfToken` | `CreateToken.token`, `refreshToken`, `csrfToken` | The session token travels in an HttpOnly cookie (ADR-0006); returning it would expose it to JavaScript. Scripts read it from `Set-Cookie` and send it as `Authorization: Bearer`. |
| `logout` mutation | *(none: JWTs expire; `tokensDeactivateAll` revokes all)* | DB sessions can be ended individually; `logout` deletes the current one and clears the cookie. |
| `accountRegister` returns `requiresConfirmation` and `errors` only, and the account is active at once | deprecated `user` (built from the input, no id), `accountErrors`; `redirectUrl`, `channel`, `languageCode`, `metadata` inputs; confirmation by email when enabled | No email until M8 (PLAN M7 decision 1). As Saleor, an existing email gets the same success and nothing changes, so accounts can't be enumerated. |
| `Product.isPublished`, `Product.publishedAt` | `Product.channelListings[].isPublished` / `publishedAt` | Single channel (ADR-0005): publication lives on the product, as in Saleor before channels. |
| `ProductVariant.price: Money!`, `Product.minimalVariantPrice: Money` | `ProductVariant.channelListings[].price`, `Product.pricing.priceRange` | Single channel and no taxes/discounts yet: one stored price per variant; the product's lowest variant price (Saleor 2.x's `minimalVariantPrice`) for lists and sorting. |
| `ProductCreateInput`/`ProductInput.isPublished`, `ProductVariantCreateInput`/`ProductVariantInput.price`; no `productType` | `productChannelListingUpdate`, `productVariantChannelListingUpdate`; `ProductCreateInput.productType!` | Single channel and no product types: publication and price are plain fields of the product and variant inputs. |
| `ProductErrorCode.PRODUCT_WITHOUT_VARIANTS` | *(none)* | Our invariant: a published product has at least one variant. |
| `ProductMediaCreateInput` without `mediaUrl`; `ProductMedia.type` always `IMAGE`, `oembedData` always `"{}"` | `mediaUrl` (external/oEmbed video) | Images only for now (ADR-0014); uploads go through `image: Upload`. |
| `ProductMedia.url` without `size` (or `0`) is the original's public URL | `size` defaults to 4096 (a thumbnail) | ADR-0014: the original is already a public object; no 4096 px copy is generated for it. |
| `productVariantStocks*`: negative quantity or quantity below allocated → `INVALID` payload error; unknown `variantId` → top-level node error; no `bulkStockErrors`/`stockErrors` fields | DB `IntegrityError` (500); `NOT_FOUND` payload error; deprecated error fields | Our stock CHECKs are reported as input errors; not-found IDs as our other variant mutations; deprecated fields left out (as M1.2.3). |
| `productVariantCreate(stocks)` reports stock errors on `stocks` before the variant is validated | stock duplicates and variant errors together | Stocks are validated (inventory) before the catalog create runs in the same transaction. |
| `shippingPriceCreate/Update/Delete` without `shippingZone`; `ShippingPriceInput.price` and `isActive`; `ShippingMethodType.price`/`isActive`; `shippingMethods` query (`MANAGE_SHIPPING`) | methods inside `shippingZones`, prices in `shippingMethodChannelListingUpdate` | Flat shipping list, single channel (PLAN M5 decision 1). |
| `Address` without `id`, metadata or default flags; addresses validated for required fields and country only | `Address` is a stored node; per-country rules from i18naddress | A checkout address is a JSON snapshot (§3); no address-data dependency (PLAN M5 decision 3). |
| `Checkout.delivery.id` is the shipping method's `ShippingMethod` ID, which `checkoutDeliveryMethodUpdate` accepts; no `deliveryMethod`/`shippingMethod` (deprecated) | per-checkout `CheckoutDelivery` IDs | No per-checkout delivery rows; every active method applies to every checkout (no zones). |
| `transactionInitialize` with a built-in dummy gateway (`saleor.io.dummy-payment-app`, outcome from `data.event.type`); `action` open to every caller; an unknown checkout is a top-level error; a zero amount (explicit or nothing left to cover) is `INVALID` | gateways are apps; choosing `action` needs `HANDLE_PAYMENTS`; `NOT_FOUND` payload error; the app receives the amount | No apps yet (PLAN M5 decision 2); the dummy gateway is the only one. |
| `Checkout.authorizeStatus`/`chargeStatus`/`totalBalance` computed on read; `TransactionItem` without `order` (M5.4), `createdBy`, `paymentMethodDetails`, `reason`; pending/canceled amounts always 0, `actions` is `REFUND` while something charged is left (M6.4) | statuses stored on the checkout and refreshed by events | Like the totals, nothing derived is stored (§5.2); the dummy gateway has no pending states or follow-up actions yet. |
| `checkoutComplete` on a completed checkout returns its order; untracked variants are not allocated; `Order` reduced to number, status, email, addresses, shipping, totals, lines, `PLACED` events, transactions, `checkoutId`; `order(id)` needs `MANAGE_ORDERS` | the checkout is deleted and a retry finds the order by token; many more order fields and states | We keep the checkout (§5.4); M5.4 creates orders only — fulfillment, payment status and order actions are M6. |
| `orders(where:)` filters `ids` and `status` only; `search` matches the order number and customer email; `RANK`/`CREATION_DATE` sort as `NUMBER`/`CREATED_AT`; `OrderEvent.user` needs `MANAGE_ORDERS` | many more `OrderWhereInput` fields; full-text search; `OrderEvent.user` needs `MANAGE_STAFF` | The dashboard filters by status only (PLAN M6 decision 3); order staff see who acted in the history. |
| `order(id)` needs `MANAGE_ORDERS` or owning the order; `User.orders` needs `MANAGE_ORDERS` or being that user | `order(id)` returns any order to anyone holding its id; `User.orders` is documented as `MANAGE_STAFF`/`OWNER` (its code checks `MANAGE_ORDERS`) | Ids are not secrets here, so an order is shown only to its customer and order staff (PLAN M7 decision 6). |
| `checkoutCustomerAttach(id)` / `checkoutCustomerDetach(id)` act for the logged-in user only; refusing to detach another user's checkout names `OWNER`; `User.checkouts` lists open checkouts only and needs `MANAGE_CHECKOUTS` or being that user | `customerId` (attach someone else with `IMPERSONATE_USER`), deprecated `token`/`checkoutId`; detach refusal names `IMPERSONATE_USER`; `User.checkouts` has no check of its own and Saleor deletes completed checkouts | We have no apps or impersonation; we keep completed checkouts as the order's record (§5.4); staff who can see a user elsewhere (e.g. in an order's history) don't see their carts (M7.2). As in Saleor, a checkout's id stays the secret, also for a customer's checkout (PLAN M7 decision 7). |
| `customers(search, sortBy)` searches email and names (no `where`, no `RANK` sort); `user(id)` takes the id only; customer inputs are email, names and `isActive`; `customerUpdate` refuses staff accounts; `customerBulkDelete` errors carry the specific code (`field` = the refused id) | full-text search over a vector with addresses; `where` filters; `user(email:)`/`user(externalReference:)`; notes, metadata, addresses, customer types, attributes, `isConfirmed`, `redirectUrl`; `customerUpdate` edits any user; bulk errors lose their code | The dashboard searches and sorts only (PLAN M7 decision 3); no address book (decision 4) or emails (M8); a `MANAGE_USERS` holder must not deactivate or re-email a staff account (M7.3). |
| `Order.user` for the owner or `MANAGE_USERS`/`MANAGE_ORDERS`/`HANDLE_PAYMENTS`; `User.orders(where: { status })` only | also `HANDLE_TAXES`; `CustomerOrderWhereInput` has channel, dates, numbers… | We have no tax handling; the customer page needs only the status filter to count orders that aren't cancelled (M7.5). |
| The `payment_transaction` row keeps the gross charge and refunds in a separate column (`refunded ≤ charged`); the API shows Saleor's numbers (`TransactionItem.chargedAmount` and `Order.totalCharged` are charged − refunded) | a refund lowers the transaction's charged value | Keeps the DB invariant simple while the API matches Saleor (M6.4 aligned `TransactionItem.chargedAmount`). |
| `orderFulfill`: no `notifyCustomer`, `trackingNumber` or `allowStockToBeExceeded`; a canceled order is `INVALID`; a negative quantity is `INVALID_QUANTITY`; a line of another order is `NOT_FOUND`; an unknown warehouse is `NOT_FOUND`; untracked variants (or deleted ones) need no stock row | those inputs exist; Saleor fulfills canceled orders, sums negative entries, accepts any order's lines, reports a missing stock as `INSUFFICIENT_STOCK` | No emails yet (M8), no tracking or approval (PLAN M6 decision 2); the extra checks close holes that would otherwise reach a DB CHECK as a 500. |
| `orderMarkAsPaid` charges what the transactions leave uncovered (a manual transaction) and is `TRANSACTION_ERROR` when nothing is | refuses any order that has transactions; charges the whole total | Our orders always have a transaction (completion requires payment), so Saleor's rule would make the action useless (PLAN M6 decision 5). |
| `transactionRequestAction` supports `REFUND` only (`CHARGE`/`CANCEL` are `INVALID`), answered at once with `REFUND_REQUEST` + `REFUND_SUCCESS`; only an order's transactions; no refund reasons; `amount` is a `Decimal` | an app handles every action asynchronously; checkout transactions too; refund reasons and `PositiveDecimal` | One built-in dummy gateway (PLAN M6 decision 1); refunding a checkout's transaction would need the checkout's lock. |

**The database** handles:
- Invariants that must hold under concurrency: unique, foreign-key and `CHECK` constraints.
- Atomicity (transactions), plus row locks for contested rows (checkout, stock).
- Filtering, sorting and pagination. **The API never filters in memory.**

**Services** handle everything in between: business rules, multi-row consistency, and
orchestration across modules.

---

## 5. Request and mutation flows

### 5.1 A typical query: `products(first: 20, where: {...}, sortBy: {...})`

1. Yoga receives a POST and rejects it if the CSRF header is missing.
2. The context factory reads the session cookie (or bearer token), looks up the session, and loads
   `user` and `permissions` once.
3. The resolver checks the requirement: staff with `MANAGE_PRODUCTS` see unpublished products,
   while customers and anonymous callers see published ones only.
4. `catalog.queries.listProducts(db, { where, sort, page })` builds one SQL query (with
   `count(*)` only if `totalCount` was requested) and returns rows plus cursors.
5. Nested fields (`variants`, `category`, `stock`) resolve through DataLoaders: one batched query per
   field per request.

### 5.2 Checkout pricing (always computed, never stored)

`checkout.calculateTotals(tx, checkoutId)`:
`lines × current variant price → subtotal`; `+ shipping_method.price → total`. Tax is zero, and
the API still returns Saleor's `TaxedMoney { net, gross, tax }` with `net = gross` so the shape
won't need to change later.
Saleor caches computed prices with a `price_expiration` (`saleor/checkout/calculations.py`).
We skip that cache because computing fresh is cheap at our size and leaves no stale state to reason
about.

### 5.3 Availability while shopping

`checkoutLinesAdd` and `checkoutLinesUpdate` check `available ≥ requested` **advisorily** and
return an `INSUFFICIENT_STOCK` error, without reserving anything. The authoritative check happens at
completion, under a lock. Saleor's optional `Reservation` model is a deliberate extension point
(§12).

### 5.4 `checkoutComplete` — the consistency-critical flow

Reference: `saleor/checkout/complete_checkout.py` (deletes the checkout via `delete_checkouts`
and stores `Order.checkout_token`), `saleor/warehouse/management.py` (`allocate_stocks`) and
`saleor/warehouse/lock_objects.py` (the row-lock querysets).

```
BEGIN  (READ COMMITTED)
 1. SELECT checkout … WHERE id = $1 FOR UPDATE   (the id is the token)
      → if completed_order_id is set: COMMIT and return that order (idempotent retry)
 2. Validate: has lines, email, shipping address, active shipping method, billing address;
    SELECT variants (+ products) … ORDER BY id FOR KEY SHARE, every product published
 3. totals = calculateTotals(tx, checkout)          -- fresh prices
 4. payments.assertCovers(tx, checkout, totals)     -- authorized+charged ≥ total
 5. inventory: SELECT stock … WHERE variant_id = ANY($ids) ORDER BY id FOR UPDATE
      → for each line: available ≥ quantity, else rollback with INSUFFICIENT_STOCK
 6. orders.createFromCheckout(tx, snapshot)         -- order + lines + PLACED event; the order
                                                       belongs to the checkout's owner, else to
                                                       the active account with its email (M7.2)
 7. inventory.allocate(tx, orderLines)              -- insert allocations, bump quantity_allocated
 8. payments.moveToOrder(tx, checkoutId, orderId)
 9. UPDATE checkout SET completed_order_id = order.id
10. jobs.enqueue(tx, order-confirmation-email)     -- the email job commits with the order (M8.2)
COMMIT
```

- **Why `FOR UPDATE` on the checkout?** Two concurrent completes of the same cart (a double click,
  or a retry) are serialized. The second one sees `completed_order_id` and returns the same order.
- **Why lock stock rows in `id` order?** Two checkouts that share variants acquire locks in the
  same order, which prevents deadlocks. Locking before checking prevents overselling under READ
  COMMITTED.
- **Why not SERIALIZABLE?** It would also be correct, but it requires retry loops on serialization
  failures. Explicit locks make the contention visible in the code.
- **`CHECK (quantity_allocated <= quantity)`** is the final safety net: a bug can't oversell
  silently, because the transaction fails instead.
- We keep the completed checkout row (rather than deleting it like Saleor) for traceability. Old
  ones can be cleaned up later.
- **The payment ordering problem:** money must be authorized *before* completion. With the dummy
  provider (M5.3), authorization is instant. With a real PSP (an optional later milestone), you
  authorize first and then complete. If completion fails after authorization, the authorization is
  voided or left to expire. This is the same model as Saleor's transaction flow.

### 5.5 Order lifecycle mutations

- `orderFulfill(lines)`: lock the order's allocations and stocks, then decrease
  `stock.quantity` and `quantity_allocated`, and delete or shrink the allocations
  (`saleor/warehouse/management.py: decrease_stock`). Increase `quantity_fulfilled`, insert a
  fulfillment and its lines, recompute the status, and append an event.
- `orderCancel`: deallocate everything, set `CANCELED`, append an event. Refunds are a separate
  payment action.
- `orderMarkAsPaid`: a manual transaction charged with the uncovered amount, plus an order event.
- `transactionRequestAction(REFUND)`: `REFUND_REQUEST` and `REFUND_SUCCESS` payment events, the
  refunded amount raised, plus an order event.
- **Lock order** for all of them: the order (`FOR UPDATE`) → its transactions (by id) → stock rows
  (by id). Order actions never lock variants or checkouts, so they can't deadlock with completion
  (checkout → variants → stocks) or stock writes (product → variant → stocks); races are tested
  with real parallel transactions (`orders/lifecycle.test.ts`).

---

### 5.6 Background jobs and email (M8, ADR-0009)

- A module that needs work done later calls `enqueue(tx, queue, data)` **inside its own
  transaction**. pg-boss inserts the job through that transaction (its Drizzle adapter), so the job
  table is the outbox: the job exists exactly when the change commits.
- The worker (`pnpm --filter @commerce/api worker`, a separate process) claims jobs with
  `SKIP LOCKED`, runs the handler, and retries a failed one with exponential backoff (5 tries from
  30 s). After the last try the job stays `failed` in `pgboss.job` for inspection.
- Delivery is at least once: a worker that dies after sending an email but before pg-boss records
  the job sends it again. A job is added once because the change that adds it happens once.
- pg-boss creates and upgrades its own `pgboss` schema on start (not a drizzle migration). The API
  starts it lazily on the first job, without maintenance; the worker runs maintenance.
- Email goes through nodemailer over SMTP (`EMAIL_URL`, `DEFAULT_FROM_EMAIL`); in dev, Mailpit.

## 6. Money, inventory, checkout and order consistency (summary)

| Concern | Mechanism |
|---|---|
| Exact money | safe-integer minor units + currency on every value and row; MNT exponent 0 *(ADR-0013)*; shared `Money` contract *(ADR-0012)*; mismatch and overflow throw |
| Price changes after add-to-cart | checkout prices computed live; order snapshots prices at completion |
| Overselling | stock row locks at completion + `CHECK (allocated ≤ quantity)` |
| Double submit | checkout row lock + `completed_order_id` + unique `order.checkout_token` |
| Partial writes | one transaction across modules (explicit `tx` parameter) |
| Deadlocks | deterministic lock order (checkout → variants (key share) → stocks, by id) |
| History integrity | order lines/addresses are snapshots; FKs to catalog use `SET NULL` |
| Payment truth | append-only `payment_event`; order payment status derived, not stored |

Tests for the rows above that involve concurrency run real parallel transactions against
PostgreSQL (M5.4).

---

## 7. Authentication

- `tokenCreate(email, password)` (Saleor's name, decided in M1) verifies the password with
  argon2id, creates a session row, and sets the cookie *(ADR-0006)*. Unknown email, no password and
  wrong password give the same `INVALID_CREDENTIALS` after the same argon2id work; `INACTIVE` is
  reported only with the right password, as in Saleor.
- `logout` deletes the session row. `me` returns the current user and permissions.
- **Customers** register with `accountRegister` (M7.1): an active, non-staff user with an argon2id
  password, created with `ON CONFLICT DO NOTHING` so a taken email answers like a free one. In the
  same transaction the orders module links the guest orders placed with that email (Saleor's
  `match_orders_with_new_user`). Customers log in with the same `tokenCreate`; `user.is_staff`
  tells the two kinds apart (no session `kind` column, PLAN M7 decision 5), and the dashboard
  refuses non-staff users.
- Sessions expire after a sliding 14 days of inactivity (`last_seen_at`), and `expires_at` puts a
  hard cap on total lifetime.
- **CSRF:** `SameSite=Lax` cookie plus a required custom header (Yoga's `useCSRFPrevention`).
- **Brute force:** constant-time comparison and a uniform error message. Rate limiting is deferred
  to M9.
- Password reset and email verification are deferred until outgoing email exists (M8).

## 8. Staff permissions

A closed enum adapted from Saleor's `saleor/permission/enums.py`, limited to what we build:

`MANAGE_PRODUCTS`, `MANAGE_ORDERS`, `MANAGE_CHECKOUTS`, `MANAGE_USERS` (customers),
`MANAGE_STAFF`, `MANAGE_SETTINGS`, `MANAGE_SHIPPING`, `HANDLE_PAYMENTS` (transaction actions such
as refunds, added in M6.4).

(Saleor also has `MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES`, `MANAGE_CHANNELS`, `MANAGE_DISCOUNTS`,
`MANAGE_GIFT_CARD`, `MANAGE_APPS`, and others. Each one is added together with its feature.)

- Effective permissions = the union over the user's groups. Superusers have all of them.
- Every mutation and staff-only field declares its required permission next to its resolver, using
  a plain `requirePermission(ctx, 'MANAGE_PRODUCTS')` call. This is deliberately not a Pothos auth
  plugin, so the check stays visible in each resolver.
- Customer-owned resources (their checkout or orders) are checked by ownership next to the
  permission check: `order(id)` and `User.orders` accept the owner or `MANAGE_ORDERS` (M7.1);
  `Order.events` stays `MANAGE_ORDERS` only, as in Saleor.
- The dashboard mirrors these permissions only for UX: it hides sidebar items and shows a
  permission-denied page. The server is the single authority.

---

## 9. Dashboard architecture

### 9.1 Shell & visual language
- Built on Macaw UI (`@saleor/macaw-ui` 3.x), using its `ThemeProvider` and design tokens (`vars`)
  with light and dark themes *(ADR-0007)*.
- Saleor's own layout: an app shell with the **Sidebar** reproduced from
  `../saleor-dashboard/src/components/Sidebar/` (`Sidebar.tsx`, `SidebarContext.tsx`,
  `useSidebarCollapseToggle.ts`, `menu/Menu.tsx`, `menu/RailItem.tsx`, `menu/ItemGroup.tsx`,
  `menu/SingleItem.tsx`, `user/Controls.tsx`, `SidebarDrawer.tsx` for mobile). This covers expanded,
  collapsed (rail), hover/active and keyboard behavior. Copied code keeps the BSD notice.
- List and detail page layouts follow `../saleor-dashboard/src/components/Layouts/List` and
  `Layouts/Detail`.

### 9.2 Section structure (Saleor convention)
```
src/products/
  urls.ts                 path builders + typed URL query params     (ref: src/products/urls.ts)
  queries.ts, mutations.ts GraphQL documents (codegen → typed hooks)
  views/ProductList.tsx   container: reads URL state, runs query, wires handlers
  components/ProductListPage/  presentational: props in, callbacks out
  components/ProductListDatagrid/  grid columns + cell mapping       (ref: src/products/components/ProductListDatagrid)
```
Views own data and navigation. Page components own layout and stay pure, which makes them
Storybook- and test-friendly.

### 9.3 Lists: five separate concerns

```
 URL (source of truth) ──parse──▶ ListState { query, sort, filters, pagination }
        ▲                                │
        │ navigate (replace)             ├──buildVariables()──▶ GraphQL variables {where, search, sortBy, first, after}
        │                                │                            │
  Filter UI (Macaw popover) ─────────────┘                            ▼
                                                    API: where-input → SQL (catalog/queries.ts)
  Grid (Glide) ◀── rows + column defs ◀── query result
```

1. **URL/list state**: `useListUrlState()` parses `location.search` into a typed `ListState` and
   writes changes back with `navigate(replace)`. A URL fully reproduces a view, so it works with
   reload, sharing and the back button. Reference: `src/products/urls.ts` (`ProductListUrlQueryParams`),
   `src/hooks/useListSettings.ts` (rows per page, kept in localStorage, not the URL).
2. **Filter UI**: Macaw components that edit a `FilterState` value (a list of
   `{ field, condition, value }` rows) and know nothing about GraphQL. This is adapted from the
   UI part of `src/components/ConditionalFilter/UI/` and `FiltersArea.tsx`. We do **not** copy
   ConditionalFilter's whole provider/token/API stack. Its own `IMPLEMENTATION_GUIDE.md` lists
   pitfalls that come from that complexity.
3. **Variables builder**: a pure function `buildProductListVariables(listState) → variables`,
   unit-tested. In Saleor this role is played by
   `src/components/ConditionalFilter/FiltersQueryBuilder/` and `queryVariables.ts`.
4. **Server-side filtering**: a typed `ProductWhereInput` (Saleor's newer `where` API shape: per
   field `{ eq | oneOf | range }`). The catalog module maps each field explicitly to a Drizzle
   condition, with no generic filter engine. Search is a separate `search: String` argument (ILIKE on
   name and SKU at first, backed by a `pg_trgm` index).
5. **Grid rendering**: a `Datagrid` wrapper around Glide that is adapted from
   `src/components/Datagrid/Datagrid.tsx`. It takes column definitions and a row accessor, and emits
   row-click, column-resize and column-picker events. It knows **nothing** about filters, URLs or
   GraphQL. Column visibility and widths persist in localStorage, mirroring
   `src/components/Datagrid/persistance/`.

Pagination uses `src/components/TablePagination/` (cursor prev/next and rows-per-page), and its
state lives in the URL (`before`/`after`).

### 9.4 Forms, validation, dirty state, save bar
- react-hook-form holds form state, with a zod schema for client-side validation. Server
  `errors[]` map onto fields by `field` name (Saleor: `src/utils/errors/`).
- **Savebar**: adapted from `src/components/Savebar/`. It appears when the form is dirty and shows
  Saleor's `ConfirmButton` states (default → loading → success/error).
- **Leave guard**: adapted from `src/components/Form/ExitFormDialog*.tsx` and `useBeforeUnload.ts`.
  Navigating away with unsaved changes opens a confirmation dialog.
- After a successful save, the form resets to the server's returned entity, so the form is
  non-dirty and holds the canonical values.

### 9.5 States
- **Loading**: skeletons in cards, plus Glide's built-in loading rows (Saleor:
  `.claude/skills/saleor-dashboard-loading/` guidance, `Skeleton` from Macaw).
- **Empty**: a list-specific empty state that distinguishes "no data yet" from "no results for
  these filters" and offers a "clear filters" action in the second case.
- **Error**: a query error shows an inline error card with retry. Mutation errors appear inline on
  fields, with a notification toast for non-field errors (Saleor: `src/hooks/useNotifier`).
- **Permission**: routes are wrapped in a `SectionRoute`-like guard
  (`src/auth/components/SectionRoute.tsx`) that shows a not-allowed page. Sidebar items are
  filtered by permission.

---

## 10. Storefront architecture

- Next.js App Router *(ADR-0008)*. Pages: home/category listing, product detail, cart, checkout
  (single page with sections), order confirmation, and later account/login.
- Catalog pages are Server Components that `fetch` the API using generated typed documents, with
  short revalidation windows.
- **Cart and checkout:** Server Actions call the API. The checkout `token` is stored in an
  HttpOnly cookie on the storefront's domain, so it is never exposed to client JavaScript.
- The storefront uses only public and customer-scoped API operations. It never uses staff
  credentials.

---

## 11. Testing and local infrastructure

**Infrastructure:**
- `docker-compose.yml` runs PostgreSQL 18, the S3 server for media, and Mailpit (SMTP `:1026`,
  web UI `:8026`; not 1025/8025, which the reference saleor-platform stack uses). There is no Redis.
- The worker runs on the host too: `pnpm --filter @commerce/api worker` (M8).
- Apps run on the host: `pnpm dev` starts API `:4000`, dashboard `:5173`, storefront `:3000`.
- Seed script: a superuser, the warehouse, shop settings, and a small demo catalog.

**Tests:**

| Layer | Tool | What |
|---|---|---|
| Money and pure helpers | Vitest | unit |
| Services and queries | Vitest + real Postgres | one `commerce_test` database (name must end in `_test`), created if missing and migrated once per run; `getDb()` points at it via `DATABASE_URL` in `vitest.config.ts`; files run sequentially; tests that write data truncate their tables (never seeded config like `shop_settings`) — pattern from dino-publishing |
| GraphQL contract | Vitest + Yoga `fetch` | permissions, error shapes, pagination |
| Concurrency | Vitest + parallel transactions | overselling and double-complete scenarios (M5.4) |
| Dashboard | Vitest + Testing Library | variables builder, URL state, forms. The Glide canvas is not unit-tested |
| End-to-end | Playwright | a few golden paths: staff creates a product → customer buys it → staff fulfills (M9) |

**Checks:** `typecheck`, `lint`, `test`, a schema-print diff, and a `drizzle-kit check` of the migrations, all orchestrated
by Turborepo.

---

## 12. Intentional extension points

Each one is designed so it can be added without rewriting what exists:

| Future capability | Today's preparation | What adding it would take |
|---|---|---|
| Multi-channel / multi-currency | currency stored on every money row; orders and checkouts snapshot currency | `channel` + listing tables, move price/publish fields into listings, `channel_id` on checkout/order (ADR-0005) |
| Multi-warehouse | `stock` keyed by warehouse | warehouse selection strategy in `inventory.allocate` |
| Checkout stock reservations | allocation code centralized in `inventory` | `reservation` table + filter `available` by active reservations (Saleor `Reservation`) |
| Taxes | API returns `TaxedMoney` | a tax calculator called from `calculateTotals`; tax columns on order lines |
| Promotions/vouchers | totals computed in one function | discount lines into `calculateTotals`; snapshots on order |
| Product types and attributes | `product` has no type yet | `product_type`, `attribute`, `attribute_value` tables; dashboard attribute editors |
| Translations | text in plain columns | `*_translation` tables + a language argument |
| Real payment providers | `payments` provider adapter interface (one method set: authorize/charge/refund/void) | a Stripe adapter + webhook endpoint |
| Webhooks/apps | outbox (M8) | outbound webhook deliveries consuming the outbox |
| Search | `search` argument isolated | `tsvector` column/index or an external engine |

---

## 13. Known trade-offs (read before disagreeing)

- With no checkout reservation, a customer can reach the payment step and then fail at completion
  with `INSUFFICIENT_STOCK`. This is acceptable at our scale and is surfaced clearly in the UI.
- Live price computation means the price at the moment of completion wins. Payment-coverage checks
  catch cases where the price changed upward.
- A single GraphQL endpoint for staff and customers means every staff-only field needs an explicit
  permission check. The trade-off is fewer endpoints, and it matches Saleor.
