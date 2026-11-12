# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| M9 | Hardening & deployability | In progress |
| M4 | Storefront catalog (Phase 4: gated, see M4) | Draft |

Finished milestones are removed from this file; their specs, results and decisions are in git
history (`git log -- PLAN.md`), the ADRs and ARCHITECTURE.md. Done so far: P0 (planning), M0
(foundations), M1 (identity: staff auth & permissions), M2 (catalog, 2026-11-11), M3 (inventory, 2026-11-11), M5 (checkout API, 2026-11-11), M6 (orders, 2026-11-11), M7 (customer accounts, 2026-11-12), M8 (background jobs and email, 2026-11-12).

## Open items from finished milestones

Accepted by the owner as documented (2026-11-11); each is revisited when a milestone needs it:

- **M1.1.6 login page simplifications:** shop name instead of the Saleor logo (trademark); no
  "Forgot password?" link until M8; no OIDC buttons; Macaw `Spinner` instead of SaleorThrobber.
- **M1.1.7:** no "Account Settings" item in the user menu until the staff detail page exists.
- **M1.2.3 left out of the staff API:** channels, metadata/note, `redirectUrl` + set-password email
  (M8; until then `staffCreate` users can't log in), LEFT_NOT_MANAGEABLE_PERMISSION,
  `Group.userCanManage`, deprecated `*Errors` fields, `UserPermission.sourcePermissionGroups`.
  Concurrent duplicate creates hit the unique constraint as a 500, not a payload error.
- **M1.2.4:** `/configuration` and its menu item use `MANAGE_STAFF | MANAGE_SETTINGS |
  MANAGE_SHIPPING` (our planned configuration pages); Saleor's menu filter moved into a pure
  `filterMenuItemsByPermissions` for unit tests.
- **M2.1 (categories) left out or different from Saleor:**
  - API: no background image, SEO, metadata, translations, `ancestors`, `products`; categories can't
    be re-parented (as Saleor). `PRODUCT_COUNT` sort and the products column arrive with M2.2.
  - Dashboard: description edited as plain text (stored as EditorJS, decision 4); no breadcrumb,
    SEO card (so no slug editing), Products card, background image, metadata, translations or
    GraphiQL buttons; "All Categories" is plain text (no saved filter presets); search has no
    syntax tooltip.
  - Ported Saleor code trimmed to what categories use: Datagrid (no editing, fullscreen, column
    picker, row menus, tooltips), notifications (no "dismiss all" / stack sync, no jotai), Form /
    useForm (no exit-dialog wiring), modal (no steps), TopNav (no channel picker / subtitle line).
  - Look: "No. of rows" is Macaw 3's Select (Saleor: legacy MUI select); in-grid spinner is an arc
    (Saleor's throbber shape elsewhere replaced by Macaw's Spinner); Subcategories card has no
    tree expansion, fixed column widths, our TablePagination; selecting a parent doesn't
    auto-select its loaded children; the "load more" row's checkbox outline still shows (not
    compared with Saleor, which needs >50 children).
  - Architecture: dashboard switched to React Router's data router (needed by `useBlocker` for the
    exit-form dialog).
  - Dev data: `pnpm cli seed-catalog` creates a demo category tree (safe to re-run).
- **M2.2 (products API + list) left out or different from Saleor:**
  - API: single-channel deviations `Product.isPublished`/`publishedAt`/`minimalVariantPrice`,
    `ProductVariant.price` (ARCHITECTURE §4); no product types, attributes, media, `where`/`filter`
    (M2.3) or `productVariants` connection; `PRODUCT_COUNT` counts all products in the subtree
    (as Saleor) while `Category.products.totalCount` counts the visible ones.
  - Category screens: the "Products in …" card is read-only (owner, 2026-11-11: a product's
    category is set on its page), a plain list instead of Saleor's GridTable, and "Hidden" for
    future-dated products (Saleor: "Scheduled").
  - Product list: availability and dates as plain text cells (no status/date cells), price =
    lowest variant price (no range), no filter presets, tiles view or export; the
    Published/Hidden rule is duplicated in two files.
  - Column picker: static columns only; widths/order in localStorage (`columnPickerSettings`)
    instead of Saleor's user-account metadata; a plain button instead of macaw's IconButton.
- **M2.3 (product filtering) left out or different from Saleor:**
  - API: `products(where:)` is a subset of Saleor's `ProductWhereInput` (ids, name, slug, category
    subtree, hasCategory, isPublished, price, minimalPrice, updatedAt, AND/OR); the shop currency is
    a constant (`SHOP_CURRENCY = "MNT"` in `productWhere.ts`). `CategoryFilterInput` gained `ids` only (no slugs/metadata/updatedAt);
    a malformed or foreign ID is a top-level error (our `fromGlobalId`), Saleor's `filter.ids` is
    laxer.
  - URL: category values are global IDs (Saleor: slugs); labels are looked up with
    `categories(filter: {ids})`. Everything else is Saleor's format (`0[s2.category][0]=…&1=AND`).
  - Filter UI: panel layout only (no popover/inline), fields price, category, is published, has
    category, updated at; no presets, attributes, channel, constraints or analytics; the left operand
    is filtered locally (static operands). Saleor's range check tests the lower bound twice; ours
    checks both ends.
  - Known gap: the category picker does not load more on scroll (a Macaw 3.1.0 bug —
    `useInfinityScroll` observes the input label, so `onScrollEnd` never fires; Saleor uses the same
    version, its demo has only 18 categories). Typing searches all categories.

- **M2.4 (product & variant editing) left out or different from Saleor:**
  - Owner decisions (2026-11-10): publishing needs a category (Saleor's `PRODUCT_WITHOUT_CATEGORY`)
    and ≥1 variant (ours, `PRODUCT_WITHOUT_VARIANTS`); the last variant of a published product
    can't be deleted; the Variants card is a read-only grid (Saleor: editable grid + bulk
    mutations); `productVariantBulkCreate`/`BulkUpdate`/`BulkDelete` not built.
  - API: no variant `weight`, no `publishedAt` input (publishing sets it to now, unpublishing
    clears it); `productDelete`'s payload lists `variants` as empty (the rows are gone).
  - Dashboard: create dialog is name + category (no product-type picker, title "Create product");
    plain "Create Product" button (no split button / export menu); product page has no SEO/slug,
    attributes, collections, taxes, metadata, GraphiQL, "product doctor"; the availability
    card has no channels, available-for-purchase or scheduling; description is plain text. Variant
    pages: no reordering, search or thumbnails in the navigation, no attributes, media, stock
    (M3), weight, checkout limits or metadata; the two-column layout doesn't stack on narrow
    screens. Variants card: no search, column picker, row selection or per-channel columns.
  - Every save sends the whole product form, so a published product that lost its category (the
    category was deleted) asks for a category on the next save.

- **M2.5 (product media) left out or different from Saleor:**
  - Owner decisions (2026-11-10/11): S3 from the start, SeaweedFS in dev/tests, `sharp`,
    JPEG/PNG/WebP/GIF up to 10 MB (ADR-0014); drag reorder with `@dnd-kit`; single delete only;
    native file drop (no `react-dropzone`); uploads via `apollo-upload-client` 18.0.1 (the Apollo
    Client 3 line).
  - API: images only (no `mediaUrl`/oEmbed/video); `ProductMedia.url` without `size` is the
    original (Saleor: 4096 thumbnail); thumbnails are auto-oriented from EXIF (Saleor doesn't);
    reorder maps an unknown id to `NOT_PRODUCTS_IMAGE` (Saleor: `NOT_FOUND`); no original-image
    proxy (`/thumbnail/<id>/`), no `productMediaBulkDelete`; thumbnail generation is limited per IP since M9.4.
  - Dashboard: no "Upload URL", no tile selection / Select all / Delete (n), no metadata dialog or
    translations button on the image page; an unknown image id shows NotFound (Saleor: endless
    skeleton); the alt field shows the API's error message (Saleor shows none); Save is disabled
    without changes; the product list has no tile view.
  - Owner decision (2026-11-11): a failed upload shows a toast per file with the API's reason,
    titled with the file name, before Saleor's "Couldn't process image" summary (Saleor shows only
    the summary).

- **M3 (inventory) left out or different from Saleor:**
  - Owner decisions (2026-11-11): no `allocation` table until order placement (M5.4;
    `quantity_allocated` stays 0); one warehouse seeded by the migration, no address and no
    warehouse pages; `stockAvailability` in the API only; catalog's GraphQL files compose with
    inventory (ARCHITECTURE §2). API deviations (INVALID stock errors, top-level unknown variant,
    variant-create error order) are in ARCHITECTURE §4.
  - Dashboard (owner, 2026-11-11): Assign Warehouses is a simplified checkbox dialog (no search or
    infinite scroll); no channel gating, stock visibility hint, spreadsheet paste or "configure a
    warehouse" link. Stock errors are notifications (Saleor shows none on the card); warehouses are
    loaded with `warehouses(first: 100)`, no paging.
  - Known gap: after Assign Warehouses, the new row's quantity input doesn't keep focus (the modal
    restores focus on close); not compared with Saleor.
  - The composite `VariantUpdate` selects only `productVariant { id }` on the stock delete/create
    payloads: their pre-update stocks otherwise overwrite the updated ones in Apollo's cache
    (found in the manual check).

- **M5 (checkout API) left out or different from Saleor:** owner decisions 1–7 (2026-11-11): flat
  shipping list with an API-only admin and `pnpm cli seed-shipping`; Saleor's transaction API with a
  built-in dummy gateway; required-fields address validation; the checkout id is its token; public
  checkout API; `shippingPrice*` without zones; minimal orders. API deviations are in ARCHITECTURE §4.
  - Known gaps: a staff `shippingPriceDelete` racing a buyer's `checkoutDeliveryMethodUpdate` can
    deadlock (Postgres aborts one, a 500); two `transactionInitialize` calls on different checkouts
    with the same idempotency key at the same moment hit the unique constraint as a 500.
  - Shipping prices (0013) and payment amounts (0014) were created as `integer` and widened to
    `bigint` in 0015 (variant prices and order totals are `bigint`).
  - No dashboard work: checkout has no Saleor dashboard pages; orders arrive in M6.
- **M6.2 (order list) left out or different from Saleor, awaiting the owner's OK:** no "Create
  order" button (no draft orders), help link, GraphiQL/settings menu, filter presets or search
  tooltip; no Net, Delivery or Channel columns and no empty spacer column; the menu's Fulfillment
  group has only Orders; a URL without a sort is redirected to number descending (Saleor's
  effective default); search keeps the chosen sort (Saleor: `rank`); pill colors are OKLCH only (no
  chroma-js fallback); a row opens the not-found page until M6.3. Found, not fixed: the sort arrow
  doesn't show in list headers (the product list too, so it predates M6.2).

- **M6.3 (order detail, read-only) left out or different from Saleor, awaiting the owner's OK:** no
  page menu (cancel arrives in M6.5; no GraphiQL or metadata), invoices, customer note, widgets or
  price-breakdown modal; the lines grid has no column picker, row menu, "is gift"/override/reason
  columns or discounted prices, and keeps Saleor's widths (Price/Total need a sideways scroll at
  1440px); the customer card has no profile/orders links, editing or copy buttons and always prints
  the billing address (our addresses are separate copies); transaction tiles have no actions,
  payment-method details, external link or actor avatar; history has no notes, docs link,
  expandable details or relative times ("Nov 11, 2026, 9:27 PM" instead of "22 minutes ago");
  "Placed …" uses the browser's time zone; amounts have no minor digits (Saleor prints two).

- **M6.4 (order lifecycle API):** owner decision (2026-11-11): refunds need the new
  `HANDLE_PAYMENTS` permission (Saleor's), so staff must be given it before they can refund. API
  deviations (mark as paid charges the uncovered rest, REFUND-only actions, the extra fulfill
  checks) are in ARCHITECTURE §4. Not built: Saleor's `TRANSACTION_MARK_AS_PAID_FAILED` event.

- **M6.5 (order actions in the dashboard) left out or different from Saleor, awaiting the owner's
  OK:** the Fulfill page shows the single warehouse instead of a picker (no change-warehouse
  dialog), has no tracking number, "send details" checkbox or stock-exceeded dialog, and its stock
  column treats a tracked line's own reservation as its quantity left to fulfil (the API has no
  `OrderLine.allocations`); fulfillment cards have no tracking, approve, cancel or refund actions;
  no timeline/line-matrix toggle or Return button; "Mark as Paid" shows whenever the order's
  `actions` include it (Saleor: only for orders with no payment at all); Refund is a button and an
  amount dialog on the transaction tile, shown only with `HANDLE_PAYMENTS` (Saleor: grant/send
  refund pages); history details are a line under the title (no expandable panel).

- **M7 (customer accounts), lead's decisions awaiting the owner's OK:** login stays one
  `tokenCreate` for staff and customers, without ADR-0006's session `kind` column (`is_staff`
  says which kind a session is); `order(id)` and `User.orders` are readable by the owner or
  `MANAGE_ORDERS` staff (Saleor returns any order to anyone holding its id), and `Order.events`
  became `MANAGE_ORDERS` only, as in Saleor; customers are Saleor's customer set (non-staff users
  plus staff who placed an order); deleting a customer keeps their orders and ends their sessions.
- **M7 API, different from Saleor, awaiting the owner's OK:** `accountRegister` returns only
  `requiresConfirmation` and `errors`; `User.checkouts` needs the user or `MANAGE_CHECKOUTS`
  (Saleor checks nothing) and lists open checkouts only; `customerUpdate` refuses staff accounts
  (Saleor edits any user); `customers` searches email and names only (no `where`, no `RANK`);
  `user(id)` takes the id only; `customerBulkDelete` errors keep their code; `Order.user` drops
  Saleor's HANDLE_TAXES; `User.orders` filters by status only. A registration racing a guest
  checkout of the same email can leave that one order unlinked.
- **M7.4 (customer list) left out or different from Saleor, awaiting the owner's OK:** no
  conditional filters, customer-type tabs, company name or external reference columns; the
  menu item and page open for `MANAGE_STAFF` alone (Saleor's), but the API refuses that user the
  list. The sorted column shows no arrow (same in the order list; not investigated).
- **M7.5 (customer pages) left out or different from Saleor, awaiting the owner's OK:** no
  addresses card or page, note, metadata, GraphiQL, customer type, attributes, external
  reference, gift cards or window titles; no channel picker, so the recent-orders KPI subtitle
  ("… in {channel}") is left out and amounts are whole MNT; Recent Orders is a plain table (no
  channel column) and "View all orders" opens the order list searched by the customer's email
  (Saleor filters by customer); the order card's "View orders" link is left out; a bulk delete
  with refused rows closes the dialog and names each refusal (Saleor shows "Unknown error").

- **M8 (background jobs and email), lead's decisions awaiting the owner's OK:** account
  confirmation is always on (`accountRegister` needs a `redirectUrl` on an `ALLOWED_CLIENT_HOSTS`
  host; unset means localhost and 127.0.0.1, as Saleor in DEBUG; login refuses unconfirmed
  accounts), replacing M7 decision 1; guest orders link on confirmation, and checkout completion
  gives guest orders only to confirmed accounts (Saleor: any active one); stateless HMAC tokens
  signed with `SECRET_KEY`, valid 3 days, single-use because they hash the confirmation state;
  our own plain-text + HTML templates with Saleor's wording (no MJML, no order-details link); the
  pg-boss job table is the outbox, the worker is a separate process, delivery is at least once.
- **M8 notes:** Mailpit runs on 1026/8026 (the reference saleor-platform stack holds 1025/8025);
  `packages/db` lists `pg` and `@opentelemetry/api` as devDependencies only to keep one
  drizzle-orm variant (see `pnpm-workspace.yaml`); the API test runner dropped the `import`
  resolve condition, which broke node-postgres. Customers created by staff start unconfirmed (as
  Saleor) and, like staff created by staff, can't log in until a set-password flow exists. No
  resend-confirmation mutation yet: a lost email means the account can't be confirmed until one
  is built. The storefront page that receives the confirmation link is M4.

---

## M9 — Hardening & deployability
- **Objective:** the API, worker and dashboard run from Docker images with validated production
  config; login can't be brute-forced; every push is checked by CI, including browser golden
  paths; the running system can be inspected through structured logs and health checks.
- **Concepts:** fail-fast config; login throttling with exponential delays (Saleor's); structured
  logs with a request id; liveness vs readiness; multi-stage Docker builds; CI with a real Postgres;
  end-to-end tests with Playwright.

**Owner decisions (2026-11-12):**
1. **Deployable = Docker images + a production compose file:** one image for the API and the worker
   (two commands), one for the dashboard (static files served by nginx), and
   `docker-compose.prod.yml` that runs the whole stack like production. No cloud vendor yet.
2. **Rate-limit counters live in Postgres** (no Redis; works with several API instances).
3. **Observability = logs + health:** JSON logs with a request id, `/health/live` and
   `/health/ready`. No metrics or tracing. Changed in M9.2 (owner, 2026-11-12): Yoga 6's own
   logger (`@graphql-hive/logger`) instead of pino, so no second logging library.
4. **Also in M9:** the date-cursor bug found in M6.1 (fixed in M9.5; only the product list had
   it, orders and customers already used microseconds), and CI on GitHub Actions.
5. **Pace:** continuous, a report after each step.

**Proposed by the lead (2026-11-12), awaiting the owner's OK:**
6. **Config is checked once at startup** (`apps/api/src/config.ts`): the API and the worker run every
   reader they need (the modules' `read*Config(env)` functions stay where they are), report all
   problems together and exit; no new dependency. `NODE_ENV=production` also requires
   `ALLOWED_CLIENT_HOSTS`, `ALLOWED_GRAPHQL_ORIGINS` and `PUBLIC_URL` and refuses the dev secrets.
   The CLI keeps its per-command checks.
7. **Login throttling is Saleor's `authenticate_with_throttling`** translated: every attempt blocks
   the IP for 1 s; failures raise the delay exponentially (per IP every 10 failures, per IP + user
   every failure, max 1 h; counters expire after 2 h); success clears them; a blocked attempt gets
   `LOGIN_ATTEMPT_DELAYED`, an unknown IP `UNKNOWN_IP_ADDRESS` (Saleor's codes). Stored in a small
   `rate_limit` table (key, count, blocked_until, expires_at). The client IP is the socket address,
   or the last `X-Forwarded-For` entry (the one our proxy adds; earlier ones can be forged)
   only when `TRUST_PROXY=true` (behind nginx).
8. **`/thumbnail/` rate limit:** only thumbnail *generation* (the cache miss that runs sharp) is
   limited per IP (60 per minute, a fixed window in the same table); cached sizes are not limited.
   Our own design, Saleor has none.
9. **Playwright golden paths** live in a new `e2e/` workspace package (`@playwright/test`): staff
   logs in and creates a published product with stock → a customer buys it through the GraphQL API
   (the storefront is M4) → staff sees the order, marks it paid and fulfils it in the dashboard.
   They run against the dev servers and a fresh `commerce_e2e` database.
10. **CI** (GitHub Actions, one workflow): lint, typecheck, unit + API tests with Postgres, S3 and
    Mailpit service containers, schema/codegen drift check, then the e2e job; the Docker images are
    built (not pushed) to catch breakage.

**Steps (each one commit, one report):**

| Step | What | Status |
|---|---|---|
| M9.1 | Config: `config.ts` validates all env vars at startup (API, worker), production rules, `.env.example` updated; tests for the validation | Done |
| M9.2 | Logging + health: Yoga's logger shared by the API and worker (JSON in production, request id), job outcomes logged, `console.*` replaced; `/health/live`, `/health/ready` (DB check) | Done |
| M9.3 | Login throttling: `rate_limit` table + migration, Saleor's delays in `tokenCreate`, client IP with `TRUST_PROXY`, the two error codes; tests | Done |
| M9.4 | `/thumbnail/` generation limit per IP (429 with `Retry-After`); tests | Done |
| M9.5 | Date-cursor fix: timestamp sorts encode microseconds (as the order list); a regression test with rows in one millisecond; other date-sorted lists checked | Done |
| M9.6 | Docker: multi-stage `Dockerfile`s (API/worker, dashboard + nginx), `docker-compose.prod.yml`, migrations as a one-off command, `docs/deploy.md` (incl. ADR-0014's S3 checklist); checked by running the stack | Proposed |
| M9.7 | Playwright golden paths in `e2e/` (decision 9) | Proposed |
| M9.8 | CI workflow on GitHub Actions (decision 10) | Proposed |

- **Acceptance:** `docker compose -f docker-compose.prod.yml up` serves a working dashboard and API
  from built images; a production start with a missing or default secret exits with a clear list;
  repeated wrong passwords get `LOGIN_ATTEMPT_DELAYED`; logs are JSON lines with a request id;
  `/health/ready` fails when Postgres is down; the golden paths pass locally and in CI; a product
  list sorted by date pages without repeats.
- **Out of scope:** a cloud host, TLS certificates, image registry/publishing, metrics, tracing,
  alerting, backups, rate limits on other mutations, the customer storefront golden path (M4).
- **Status:** Started by the owner 2026-11-12 with decisions 1–5; decisions 6–10 await the owner's OK.

## M4 — Storefront catalog
- **Scope:** Next.js app, category listing, PDP, published-only visibility, typed fetch, Tailwind.
- **Concepts:** Server Components, caching/revalidation, public vs staff API visibility.
- **Phase 4, gated:** starts only after the owner explicitly confirms that the API and the admin
  dashboard are complete (owner priority 2026-11-09: API → Admin → QA → Storefront). Moved after
  M9 on 2026-11-09; the ID is kept so existing references stay valid.
- **Also Phase 4 (moved from other milestones, 2026-11-09):** the checkout token cookie via
  Server Actions and the order confirmation page (from M5), storefront register/login/logout and
  order history (from M7), and the Playwright golden path where a customer buys (from M9).
- **Status:** Draft.
