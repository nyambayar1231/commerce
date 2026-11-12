# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| M8 | Background processing: outbox + transactional email | In progress |
| M9 | Hardening & deployability | Draft |
| M4 | Storefront catalog (Phase 4: gated, see M4) | Draft |

Finished milestones are removed from this file; their specs, results and decisions are in git
history (`git log -- PLAN.md`), the ADRs and ARCHITECTURE.md. Done so far: P0 (planning), M0
(foundations), M1 (identity: staff auth & permissions), M2 (catalog, 2026-11-11), M3 (inventory, 2026-11-11), M5 (checkout API, 2026-11-11), M6 (orders, 2026-11-11), M7 (customer accounts, 2026-11-12).

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
    proxy (`/thumbnail/<id>/`), no `productMediaBulkDelete`, no rate limiting on `/thumbnail/` (M9).
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
- **Found during M6.1, not fixed (needs the owner's go):** the product list's `CREATED_AT` /
  `LAST_MODIFIED_AT` cursors carry millisecond ISO strings while the columns hold microseconds, so
  rows created within one millisecond repeat page after page (reproduced with four products; the
  orders list sorts timestamps by epoch microseconds instead). Likely the same in other date-sorted
  lists built on that pattern.

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

---

## M8 — Background processing
- **Objective:** emails leave the system reliably: a job is written in the same transaction as the
  change that causes it (so there are no lost or phantom emails), and a worker sends it through
  SMTP with retries (ADR-0009). Customers confirm their email before they can log in.
- **Concepts:** transactional outbox (pg-boss's job table, written through our transaction);
  at-least-once delivery and at-least-once jobs; stateless HMAC tokens; SMTP in dev via Mailpit.

**Owner decisions (2026-11-12):**
1. **Emails in M8:** the order confirmation (on checkoutComplete) and the account confirmation
   (on accountRegister, Saleor's confirmAccount). Password reset and the set-password invite for
   staff-created users stay out (they still can't log in).
2. **pg-boss, as ADR-0009:** the job is inserted inside the business transaction; a worker process
   runs it with pg-boss's retries.

**Proposed by the lead (2026-11-12), awaiting the owner's OK:**
3. **Account confirmation = Saleor's flow with confirmation on:** `accountRegister` requires a
   `redirectUrl`, creates an unconfirmed (active) user and returns `requiresConfirmation: true`;
   the email links to `redirectUrl?email=…&token=…`; `confirmAccount(email, token)` confirms;
   `tokenCreate` refuses an unconfirmed user with `ACCOUNT_NOT_CONFIRMED` (after the password check,
   as Saleor). This replaces M7 decision 1 ("active at once").
4. **Guest orders link on confirmation**, not registration (Saleor's confirm_account), so an
   unconfirmed email can't claim anyone's orders. Existing users are marked confirmed by the
   migration.
5. **Tokens are Saleor's stateless HMAC:** a hash of the user's id, email and confirmation state
   with a timestamp, signed with a `SECRET_KEY` env var; valid 3 days (Django's default) and
   useless once the account is confirmed. No token table.
6. **`redirectUrl` must be on an allowed host** (`ALLOWED_CLIENT_HOSTS` env, Saleor's
   validate_storefront_url), so the email can't send people to an attacker's site.
7. **Emails are our own templates** (plain text + simple HTML, English) rendered in TypeScript;
   sent with nodemailer over SMTP (`EMAIL_URL`, `DEFAULT_FROM_EMAIL`, Saleor's setting names);
   Mailpit in docker-compose for dev.
8. **pg-boss owns its `pgboss` schema** (it creates and upgrades it; not a drizzle migration); the
   worker is a separate process (`pnpm --filter @commerce/api worker`) in the API package. A job is
   added once because the change that adds it happens once (checkout completion is idempotent);
   delivery is at least once (a worker dying between sending and recording can send twice).

**Steps (each one commit, one report):**

| Step | What | Status |
|---|---|---|
| M8.1 | Jobs infrastructure: pg-boss + nodemailer, Mailpit in compose, a `jobs` module (enqueue inside a transaction, worker entry, SMTP transport), config validation; tests that a rolled-back job never runs and a committed one does | Done |
| M8.2 | Order confirmation email: enqueued in checkoutComplete's transaction, rendered from the order (lines, totals, addresses); checked in Mailpit | Done |
| M8.3 | Account confirmation: `user.is_confirmed`, `accountRegister(redirectUrl)`, `confirmAccount`, `ACCOUNT_NOT_CONFIRMED` login, HMAC tokens, guest orders linked on confirmation, `User.isConfirmed` and the dashboard's "Unverified" pill | Proposed |

- **Acceptance:** placing an order puts its confirmation in Mailpit once, even if the worker
  restarts; an order whose transaction rolls back sends nothing; a new customer gets a
  confirmation email, can't log in before confirming, and after confirming logs in and sees their
  earlier guest orders.
- **Out of scope:** password reset, set-password invites, resend-confirmation, email change,
  other order emails (fulfilled, cancelled, refunded), staff notifications, webhooks,
  translations, the storefront page that receives the confirmation link (M4).
- **Status:** Started by the owner 2026-11-12 with decisions 1–2; decisions 3–8 await the owner's OK.

## M9 — Hardening & deployability
- Dockerfiles, production config/env validation, rate limiting on login, CI pipeline, Playwright
  golden paths for the dashboard and API, basic observability.
- **Status:** Draft.

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
