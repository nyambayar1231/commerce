# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| M2 | Catalog | Approved |
| M2.1 | Categories end-to-end (first Glide list + first save-bar form) | In progress |
| M2.2 | Products & variants API + product list grid | Approved |
| M2.3 | Product list filtering (URL state → variables → where → SQL) | Approved |
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

### M2.1 Categories end-to-end
- **Objective:** establish *the* list-page and detail-form patterns on a small entity.
- **Scope:** `category` table; `categories` connection (keyset, sort by name, search),
  `categoryCreate/Update/Delete`; Relay plugin + global IDs + `node`; dashboard: Datagrid wrapper
  (adapted from `src/components/Datagrid`), TablePagination, list URL state, category detail page
  with Savebar + ExitFormDialog + field errors; loading/empty/error states.
- **Concepts:** Relay connections & keyset pagination; global IDs; errors-as-data; container vs
  page components; dirty-state handling.
- **Decisions:** subcategory display (Saleor shows subcategories + products tabs in detail).
- **Acceptance:** create→list→edit→delete flow; pagination across >1 page verified with seeded
  data; leaving dirty form prompts; API tests for pagination edges.
- **Status:** Draft.

| Step | What | Status |
|---|---|---|
| M2.1.1 | `category` table + migration (`parent_id` FK `ON DELETE CASCADE`, unique `slug`, `description jsonb` EditorJS); `catalog` module service: create/update/delete, slug from name (unique), no re-parenting (as Saleor) + real-Postgres tests | Done |
| M2.1.2 | `category(id\|slug)` query (`id name slug description parent level`), `categoryCreate(input, parent)`, `categoryUpdate(id, input)`, `categoryDelete(id)` with Saleor's `ProductError`, guarded by `MANAGE_PRODUCTS`; contract tests | Done |
| M2.1.3 | Dashboard: Categories page header ("All Categories" + "Create category"), `?action=create` URL, Saleor's `CreateCategoryDialog` (DashboardModal, name + plain-text description → EditorJS JSON, Back/Create), notifier toast "Category created", navigate to `/categories/:id` | Done |
| M2.1.4 | Dashboard: category detail page as Saleor's `CategoryUpdatePage`: top nav, General Information (name, description), Subcategories card + "Create subcategory" (same dialog with parent), Savebar (Back/Save/Delete), ExitFormDialog on dirty leave, field errors, delete dialog; background image, Products card and SEO wait (M2.5 / M2.2 / later) | Done |
| M2.1.5 | Pothos Relay plugin: `Node` interface on `User`/`Group`/`Category` (same base64 global IDs); no `node`/`nodes` query, as Saleor's schema has none | Done |
| M2.1.6 | `categories(first/after/last/before, filter{search}, sortBy{NAME, SUBCATEGORY_COUNT, PRODUCT_COUNT*}, level)` keyset connection, `Category.children` connection; contract tests for page edges | Approved |
| M2.1.7 | Dashboard `Datagrid` wrapper (Glide) adapted from `src/components/Datagrid`, `TablePagination`, list URL state (`src/categories/urls.ts`) | Approved |
| M2.1.8 | Category list page as Saleor 3.23: columns (name, products, subcategories), expandable tree rows + "Collapse all", search, sort, pagination, bulk delete; Subcategories card paginated | Approved |
| M2.1.9 | Seed: a demo category tree big enough for >1 page; browser check of the full flow against real Saleor | Approved |

\* `PRODUCT_COUNT` sort and the Products tab arrive with products (M2.2); the column shows 0 until then.

### M2.2 Products & variants API + list grid
- Scope: product/variant tables, `products` connection, nested `variants`, DataLoaders,
  product list grid (columns from `src/products/components/ProductListDatagrid`), column picker,
  sort. **Excludes filtering** (M2.3).
- Concepts: N+1 and DataLoader; computed columns; Glide custom cells.
- Status: Draft.

| Step | What | Status |
|---|---|---|
| M2.2.1 | `product` + `product_variant` tables + migration (ARCHITECTURE §3; `category_id` nullable, `SET NULL`); `Money` GraphQL type via `@commerce/contracts` | Proposed |
| M2.2.2 | `products` connection (sort NAME / PRICE / CREATED_AT / PUBLISHED, `search`), `product(id\|slug)`; unpublished only for `MANAGE_PRODUCTS`; contract tests | Proposed |
| M2.2.3 | DataLoaders for `Product.variants`, `Product.category`, `Category.products`; a test that counts queries (no N+1) | Proposed |
| M2.2.4 | Category: Products tab + `PRODUCT_COUNT` sort (finishes M2.1's *) | Proposed |
| M2.2.5 | Product list grid (`ProductListDatagrid` columns: name+thumbnail placeholder, category, price, availability), sort, pagination | Proposed |
| M2.2.6 | Column picker adapted from `Datagrid/ColumnPicker` (static columns only), persisted per user in localStorage as Saleor | Proposed |

### M2.3 Product list filtering
- Scope: `ProductWhereInput` (category oneOf, isPublished eq, price range, later stock), `search`;
  filter UI adapted from ConditionalFilter UI; URL serialization; variables builder with unit tests;
  "no results" empty state; presets deferred.
- Concepts: the five separated concerns (ARCHITECTURE §9.3); index-aware SQL filtering.
- Decisions: URL format for filters; which Saleor filter UI features to reproduce in v1.
- Status: Draft.

| Step | What | Status |
|---|---|---|
| M2.3.1 | API `ProductWhereInput` (`category oneOf`, `isPublished eq`, `price range`, `ids`) + `search`; explicit field→SQL mapping in `catalog/queries.ts`; indexes; contract tests | Proposed |
| M2.3.2 | Dashboard filter model: URL ⇄ filter state ⇄ query variables, pure functions + unit tests (Saleor's ConditionalFilter URL format, decided in this step's brief) | Proposed |
| M2.3.3 | Filter UI adapted from ConditionalFilter (category, published, price), "no results" empty state | Proposed |

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
