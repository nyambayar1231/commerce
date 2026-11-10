# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| M2 | Catalog | Approved |
| M2.1 | Categories end-to-end (first Glide list + first save-bar form) | Done |
| M2.2 | Products & variants API + product list grid | Done |
| M2.3 | Product list filtering (URL state → variables → where → SQL) | In progress |
| M2.4 | Product create/update form | Approved |
| M2.5 | Product media | Approved |
| M3 | Inventory: warehouse, stock, availability | Draft |
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
(foundations), M1 (identity: staff auth & permissions).

## Open items from finished milestones

Awaiting the owner's approval (each was reported when its step finished):

- **M0.3.11:** in dark mode Saleor's root text colour is white, ours is the browser's black (Saleor
  gets it from its legacy Macaw/MUI baseline). Not visible today; proposed fix: root text colour =
  Macaw `text.default1` in `apps/dashboard/src/index.css`.
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
  - Category screens: the "Products in …" card is read-only (assign/unassign with M2.4), has
    placeholder thumbnails, a plain list instead of Saleor's GridTable, and "Hidden" for future-dated
    products (Saleor: "Scheduled").
  - Product list: availability and dates as plain text cells (no status/date cells), no thumbnail,
    price = lowest variant price (no range), checkboxes without a bulk action yet (M2.4), no
    "Create product" (M2.4), filters/presets (M2.3), tiles view or export; the Published/Hidden rule
    is duplicated in two files.
  - Column picker: static columns only; widths/order in localStorage (`columnPickerSettings`)
    instead of Saleor's user-account metadata; a plain button instead of macaw's IconButton.
- **M2.3 (product filtering) left out or different from Saleor:**
  - API: `products(where:)` is a subset of Saleor's `ProductWhereInput` (ids, name, slug, category
    subtree, hasCategory, isPublished, price, minimalPrice, updatedAt, AND/OR); the shop currency is
    a constant (`SHOP_CURRENCY = "MNT"` in `productWhere.ts`); the older
    `product_variant_product_id_idx` is now redundant next to `(product_id, price_amount)` (drop it
    in a later migration?). `CategoryFilterInput` gained `ids` only (no slugs/metadata/updatedAt);
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

---

## M2 — Catalog

**Approved by the owner (2026-11-09), with every decision below as recommended.** Each step is one
commit with a report. Owner priority: creating a category exactly like Saleor comes first, so M2.1
starts with the create flow and the list follows.

**Decisions (accepted 2026-11-09):**
1. **New dependencies** (CLAUDE.md asks first): `@pothos/plugin-relay` (Node interface, cursor
   connections; global IDs still encoded/decoded by `graphql/globalId.ts`) in M2.1.5; `@glideapps/glide-data-grid`
   (+ its peer deps, the versions Saleor pins) in M2.1.7; `dataloader` in M2.2.3.
2. **Category tree in the list:** as the running Saleor 3.23: top-level rows that expand to show
   subcategories ("Collapse all"), plus the detail page's Subcategories card. (The draft assumed a
   top-level-only list; the real dashboard checked on 2026-11-09 shows expandable rows.)
3. **Category delete:** Saleor deletes the subtree (`CASCADE`) and leaves products without a
   category (`SET_NULL`). Recommended: same, so `product.category_id` is nullable (M2.2).
4. **Category fields in v1:** name, slug, description (stored as EditorJS JSON like Saleor; the
   create dialog takes plain text as Saleor's does; the detail page's editor is plain text until a
   rich-text editor is chosen), parent. Left out: background image (needs M2.5 storage), SEO fields, metadata.
5. **Product types:** none (ARCHITECTURE §3). The create flow in M2.4 is a simple dialog (name +
   category), not Saleor's product-type picker.
6. **Media upload (M2.5):** GraphQL multipart (Saleor's `productMediaCreate(image: Upload)`) vs a
   REST endpoint. Recommended: GraphQL multipart, as Saleor; Yoga supports it built-in.

### M2.1 Categories end-to-end — Done (2026-11-09)

Open items are listed under "Open items from finished milestones".

### M2.2 Products & variants API + list grid — Done (2026-11-10)

Open items are listed under "Open items from finished milestones".

### M2.3 Product list filtering — Done (2026-11-10)

Open items are listed under "Open items from finished milestones".

### M2.4 Product create/update form
- Scope: product + variants editing (prices, SKU), publish toggle with invariant, delete;
  client+server validation; Savebar.
- Decision: Saleor's product-type-driven create dialog vs simple create (no product types yet).
- Status: Draft.

| Step | What | Status |
|---|---|---|
| M2.4.1 | `productCreate/Update/Delete`, `productVariantCreate/Update/Delete`, `productVariantBulkCreate` (as Saleor), publish invariant (≥1 variant), price ≥ 0, shop currency; `ProductError` codes; guard + invariant tests | Proposed |
| M2.4.2 | Product create dialog (name + category) → product detail page: general info, category, publish toggle, Savebar, delete | Proposed |
| M2.4.3 | Variants card on the product page + variant detail page (SKU, name, price), create/delete | Proposed |

### M2.5 Product media
- Scope: local-disk file storage behind a tiny `storage` interface, upload via multipart GraphQL
  or signed REST endpoint (decide), media reorder.
- Owner (2026-11-09): leans to AWS S3 for uploads. Lead's proposal: S3 (Seoul/Tokyo) behind the
  `storage` interface, MinIO/local disk in dev and tests, CloudFront in front, uploads through the
  API (GraphQL multipart) first; compare Cloudflare R2 (no egress fees). ADR + setup checklist at
  M2.5; the owner creates the AWS account/bucket/credentials.
- Status: Draft.

| Step | What | Status |
|---|---|---|
| M2.5.1 | `product_media` table; `storage` interface with a local-disk implementation + static serving; size/type limits | Proposed |
| M2.5.2 | `productMediaCreate` (multipart `Upload`), `productMediaUpdate` (alt), `productMediaDelete`, `productMediaReorder`; tests | Proposed |
| M2.5.3 | Dashboard media card (upload, alt, reorder, delete) and the list grid thumbnail | Proposed |

---

## M3 — Inventory
- **Objective:** stock per variant in the single warehouse; availability visible to staff and API.
- **Scope:** `warehouse` (seeded), `stock`, `allocation` tables with CHECK constraints;
  stock editing in variant form; `quantityAvailable` field; stock filter in product list.
- **Concepts:** DB constraints as invariants; why allocations are a table, not just a counter.
- **Acceptance:** constraint violation tests; stock updates visible in grid.
- **Status:** Draft.

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
