# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| M7 | Customer accounts | In progress |
| M8 | Background processing: outbox + transactional email | Draft |
| M9 | Hardening & deployability | Draft |
| M4 | Storefront catalog (Phase 4: gated, see M4) | Draft |

Finished milestones are removed from this file; their specs, results and decisions are in git
history (`git log -- PLAN.md`), the ADRs and ARCHITECTURE.md. Done so far: P0 (planning), M0
(foundations), M1 (identity: staff auth & permissions), M2 (catalog, 2026-11-11), M3 (inventory, 2026-11-11), M5 (checkout API, 2026-11-11), M6 (orders, 2026-11-11).

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

---

## M7 — Customer accounts
- **Objective:** customers register, log in and read their own orders through the API; a logged-in
  customer's checkout belongs to them and becomes their order; staff manage customers in Saleor's
  Customers section (ARCHITECTURE §3 "identity", §7, §8).
- **Concepts:** one `user` table for staff and customers (Saleor's `account.User`); ownership
  checks in the service layer next to permission checks; linking guest data by email inside the
  registration transaction.

**Owner decisions (2026-11-12):**
1. **`accountRegister` creates an active account at once** (Saleor with email confirmation off);
   the customer can log in right away. Email confirmation comes with M8.
2. **Guest orders are linked on registration:** Saleor's `match_orders_with_new_user` attaches
   past orders with the same email (and no user) to the new account.
3. **Dashboard: list, detail, create, delete** with `MANAGE_USERS`: Saleor's customer list (search,
   sort, pagination), detail page (name, email, active; recent orders), create page, delete and
   bulk delete. No notes, metadata or attributes.
4. **No address book in M7:** no `address` table or account address mutations; the customer page
   leaves out Saleor's Address Information card. It comes later with the storefront.

**Proposed by the lead (2026-11-12), awaiting the owner's OK:**
5. **Login stays one `tokenCreate`** for staff and customers; ADR-0006's session `kind` column stays
   out because `user.is_staff` already says which kind a session is (the dashboard keeps refusing
   non-staff users).
6. **Customer reads (Saleor's names):** `me.orders` (connection, newest first), `me.checkouts`;
   `order(id)` is readable by its owner as well as by `MANAGE_ORDERS` staff (others get Saleor's
   permission error); `Order.events` stays `MANAGE_ORDERS` only, as in Saleor.
7. **Checkout ownership = Saleor's rules (owner's choice, 2026-11-12):** `checkoutCreate` by a
   logged-in user sets the checkout's user and (unless given) email; `checkoutCustomerAttach`
   (refuses a checkout that already has an owner) and `checkoutCustomerDetach` (owner only); the id
   stays the secret, so anyone holding it can still use a customer's checkout. Completion gives
   the order to the owner, or to the active account with the checkout's email.
8. **Customers = Saleor's customer set:** `customers` lists non-staff users plus staff users who
   placed an order (Saleor's `User.objects.customers()`); `customerCreate` makes a user without a
   password (they can log in once M8 sends the set-password email, as `staffCreate`);
   `customerUpdate` and the deletes refuse staff accounts; deleting a customer keeps their orders
   (the order's user becomes `null`) and ends their sessions.

**Steps (each one commit, one report):**

| Step | What | Status |
|---|---|---|
| M7.1 | API account: `accountRegister` (decisions 1, 2), `me.orders`, `order(id)` for its owner (decision 6); tests | Done |
| M7.2 | API checkout ↔ user: decision 7, `me.checkouts`; ownership tests | Done |
| M7.3 | API staff customers: `customers` connection (search, Saleor's `sortBy`), `user(id)`, `User.orders`, `customerCreate`/`Update`/`Delete`, `customerBulkDelete` (`MANAGE_USERS`) | Done |
| M7.4 | Dashboard customer list: Customers menu item, Saleor's CustomerListPage + datagrid (name, email, orders), search, pagination, column settings | Done |
| M7.5 | Dashboard customer detail, create page, delete dialogs; "View profile" link from the order's customer card | Proposed |

- **Acceptance:** a customer registers and logs in through the API, places an order with a checkout
  that belongs to them, and sees it (and their earlier guest orders) in `me.orders`; another customer
  can't read that checkout or order; staff find the customer in the dashboard, edit, create and
  delete customers, and open their orders.
- **Out of scope:** email confirmation, password reset and set-password emails (M8); address book;
  account deletion by the customer; notes, metadata, customer attributes; storefront screens (M4).
- **Status:** Started by the owner 2026-11-12 with decisions 1–4 and 7; decisions 5, 6 and 8 await
  the owner's OK.

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
