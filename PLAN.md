# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| M3 | Inventory: warehouse, stock, availability | In progress |
| M5 | Checkout | Draft |
| M5.1 | Cart: checkout + lines | Draft |
| M5.2 | Email, addresses, shipping methods, totals | Draft |
| M5.3 | Payments with a dummy provider | Draft |
| M5.4 | checkoutComplete: transactional order placement | Draft |
| M6 | Orders in the dashboard | Draft |
| M6.1 | Order list & detail | Draft |
| M6.2 | Fulfill, cancel, mark paid, refund | Draft |
| M7 | Customer accounts | Draft |
| M8 | Background processing: outbox + transactional email | Draft |
| M9 | Hardening & deployability | Draft |
| M4 | Storefront catalog (Phase 4: gated, see M4) | Draft |

Finished milestones are removed from this file; their specs, results and decisions are in git
history (`git log -- PLAN.md`), the ADRs and ARCHITECTURE.md. Done so far: P0 (planning), M0
(foundations), M1 (identity: staff auth & permissions), M2 (catalog, 2026-11-11).

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

---

## M3 — Inventory
- **Objective:** stock per variant in the single warehouse, edited by staff on the variant page and
  visible through the API (`ProductVariant.stocks`, `quantityAvailable`, a stock filter).
- **Concepts:** DB constraints as invariants (`0 ≤ allocated ≤ quantity`); why stock is keyed by
  (warehouse, variant) even with one warehouse (ADR-0005); module boundaries (`inventory` owns
  `warehouse`/`stock`, catalog only reads them through its `index.ts`).
- **Status:** Approved by the owner 2026-11-11 (plan and decisions 1–5); in progress.

**Decisions (accepted by the owner 2026-11-11):**
1. **Allocation table waits for orders.** ARCHITECTURE's `allocation(order_line_id, …)` references
   `order_line`, which arrives in M5.4. M3 creates `stock.quantity_allocated` (always 0 until then,
   shown as "Allocated" in the UI) and the `allocation` table comes with order placement.
2. **Warehouse = one row created by the migration** (custom SQL in the generated migration), name
   "Default Warehouse", slug `default-warehouse`. Columns now: `id, name, slug, email`; the address
   (Saleor's required `Warehouse.address`) is added when shipping needs it (M5.2).
3. **No warehouse management pages yet.** Saleor's Configuration → Warehouses list/detail is left
   out (one warehouse, nothing to configure); the API has read-only `warehouses`/`warehouse`.
4. **Stock filter in the API only.** `products(where: { stockAvailability: IN_STOCK|OUT_OF_STOCK })`
   as Saleor; Saleor's dashboard has no stock filter, so none is added to the product list UI
   (the draft's "stock filter in product list" is dropped).
5. **Variants card gets a "Stock" column** (quantity in the single warehouse), as Saleor's variants
   grid shows a column per warehouse.

**Steps (each one brief, one commit, one report):**

| Step | What | Status |
|---|---|---|
| M3.1 | API reads: `inventory` module; `warehouse` + `stock` tables (CHECKs: `quantity ≥ 0`, `quantity_allocated ≥ 0`, `quantity_allocated ≤ quantity`; unique (warehouse, variant); stock cascades with its variant) with the seeded warehouse; `Warehouse` and `Stock` node types, `warehouses`/`warehouse` queries, `ProductVariant.stocks` (staff only, as Saleor), `ProductVariant.quantityAvailable` (sum of `quantity − allocated`; null when `trackInventory` is off); constraint-violation tests | Done |
| M3.2 | API writes: `productVariantStocksCreate` / `productVariantStocksUpdate` / `productVariantStocksDelete` (Saleor's args, `BulkStockError` codes), `stocks` on `productVariantCreate`; `ProductWhereInput.stockAvailability`; stock rows locked like variants (product → variant → stock) | Done |
| M3.3 | Dashboard: Saleor's Inventory card stock table on the variant page (warehouse, Allocated, Quantity input, Assign Warehouse, remove) saved with Saleor's composite `VariantUpdate` (stocks delete/create/update + variant update); stocks on the variant create page; "Stock" column in the product's Variants card | Proposed |

- **Acceptance:** CHECK violations proven by tests; staff set a quantity on the variant page and see
  it in the Variants card and through `quantityAvailable`; `stockAvailability` filters correctly.
- **Out of scope:** reservations (ARCHITECTURE §5.3), preorders, stock history/adjustment log,
  multiple warehouses, warehouse addresses/pages, stock import.

## M5 — Checkout
- **M5.1 Cart:** `checkoutCreate`, `checkoutLinesAdd/Update/Delete`, live price calculation,
  advisory stock check.
- **M5.2 Details:** email, addresses (validation), shipping methods (admin CRUD minimal),
  `TaxedMoney` totals.
- **M5.3 Payments (dummy):** `payment_transaction` + events, dummy provider authorize/charge,
  `transactionInitialize`-like mutation. Decision: real Stripe test-mode as optional M5.5.
- **M5.4 Completion:** §5.4 flow; concurrency tests (two buyers, last unit; double submit).
- **Status:** Draft.

## M6 — Orders in the dashboard
- **M6.1:** order list grid with filters (status, date range, customer email, payment status),
  order detail (lines, totals, addresses, timeline) — adapted from `src/orders/`.
- **M6.2:** fulfill (stock decrease), cancel (deallocate), mark as paid, refund; timeline events.
- **Status:** Draft.

## M7 — Customer accounts
- Customer accounts API (register/login/logout, order history queries); checkout attaches to
  user; dashboard customers list/detail.
- **Status:** Draft.

## M8 — Background processing
- Requirement: order confirmation email. Outbox table written in the order transaction; pg-boss
  worker; Mailpit in compose; password reset now possible.
- **Status:** Draft.

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
