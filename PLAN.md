# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| M11 | Dashboard in Mongolian and English | In progress |
| M4.0 | Storefront programme setup (ADRs, AI team) | In progress |
| M15 | API and dashboard for the storefront | Approved |
| M4 | Storefront (Paper-like, production ready) | Approved |

Finished milestones are removed from this file; their specs, results and decisions are in git
history (`git log -- PLAN.md`), the ADRs and ARCHITECTURE.md. Done so far: P0 (planning), M0
(foundations), M1 (identity: staff auth & permissions), M2 (catalog, 2026-11-11), M3 (inventory, 2026-11-11), M5 (checkout API, 2026-11-11), M6 (orders, 2026-11-11), M7 (customer accounts, 2026-11-12), M8 (background jobs and email, 2026-11-12), M9 (hardening &
deployability, 2026-11-12), M10 (deploy to AWS, 2026-11-13), M12 (continuous deployment, 2026-11-14), M13 (draft orders and order printing, 2026-11-14), M14 (simpler product creation, 2026-11-19).

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

- **M9 (hardening & deployability), lead's decisions awaiting the owner's OK:** config is checked
  at start by `apps/api/src/config.ts` (API and worker; the CLI keeps per-command checks), with
  production rules; login throttling is Saleor's, but the client IP behind `TRUST_PROXY=true` is
  the *last* X-Forwarded-For entry (Saleor: the first, forgeable); the `rate_limit` table belongs to
  a new `rateLimit` module; thumbnail generation is limited to 60 per IP per minute (Saleor has
  none); one `Dockerfile` with `api` and `web` targets, the API runs from TypeScript sources (no
  build step), `web` is nginx with the dashboard and an API proxy on one origin, SeaweedFS and
  Mailpit stand in for S3/SMTP in `docker-compose.prod.yml`; the golden path has no "mark as paid"
  and opens the order by URL; CI is one GitHub Actions workflow (checks, e2e, image builds).
- **M9 notes:** CI's first run on GitHub (2026-11-12, run 43195696034) failed one test:
  `auth.test.ts` "lets only one of two simultaneous attempts from an IP through" got two successes
  (images and e2e jobs passed). A flaky test, fixed in M10.1. The order and product grids are canvas (Glide), so e2e tests can't read rows;
  old millisecond product-list cursors are now refused as invalid. ADR-0014 still says thumbnail
  rate limiting "comes with M9" (left unchanged: accepted ADRs change only with the owner).
- **M10 (deploy to AWS), as documented in docs/deploy.md "AWS (production)":** live at
  https://admin.dino-craft.lol since 2026-11-13 (CDK stack `Commerce` in ap-northeast-2, one
  t4g.small, S3 media, Resend email, Caddy HTTPS, nightly backups); acceptance checked with the
  owner (certificate, image upload to S3, Resend email, backup restore, CI green). Open:
  - **AWS free plan ends** when the credits run out or after six months (around 2027-05); the
    account must be upgraded to the Paid plan before then or AWS closes it.
  - **Domain** `dino-craft.lol` (Porkbun) has auto-renew off; it expires 2027-09-10.
  - **Releases are manual** (images built on the Mac, through the artifacts bucket, loaded via
    Session Manager); no CI-driven deploys.
  - The deployment decisions (AWS, one instance, Postgres in a container, Caddy, CDK) live in PLAN
    history and docs/deploy.md; no ADR was written. Proposed: ADR-0015 for them.
  - `infra/aws/cdk.context.json` (committed, as CDK recommends) holds the AWS account id in this
    public repository. The 85 unset CDK feature flags keep their defaults.
  - A test customer `nyambayarlucky+m10test@gmail.com` (unconfirmed) is in the production database.
  - Browsers that opened admin.dino-craft.lol while it was Porkbun's parking page cached its 301 to
    dino-craft.lol for `/` (cleared by emptying the browser cache).
- **M12 (continuous deployment), as documented in docs/deploy.md "Releasing a new version":** every
  green push to `main` deploys itself (`.github/workflows/deploy.yml` → `scripts/deploy/release.sh`
  through Session Manager), GitHub → AWS through OIDC with the immutable subject; checked with an
  untouched push (run 43577402519). Open:
  - Every push to `main` deploys, docs-only ones too (about 1.5 min, with a restart of a few seconds).
  - `actions/checkout@v4` and `aws-actions/configure-aws-credentials@v4` run on the deprecated
    Node 20 (GitHub warns); move to their next majors when they exist.
  - Images in the artifacts bucket expire after 7 days; a rollback rebuilds from the commit anyway.

---

- **M13.2 (draft order API), lead's decisions awaiting the owner's OK:** `order_event` stays append-only except
  that a draft's events are deleted with the draft (migration 0021 replaces the trigger function);
  `orderFulfill`/`orderMarkAsPaid` refuse a draft (`INVALID`) and `orderCancel` answers
  `CANNOT_CANCEL_ORDER` (Saleor's can_cancel); a draft's customer can't read it through
  `order(id)` or `me.orders`; `OrderError` gained Saleor's `addressType`; `Order.shippingMethod`
  is null for orders placed from a checkout (they keep only the name and price).
- **M13.3, awaiting the owner's OK:** `draftOrderCreate` takes no `lines` (Saleor's dashboard
  creates an empty draft, then adds lines); no line `price` overrides; a line holds at most
  10,000 items (`INVALID_QUANTITY`, ours: keeps totals safe integers); the line mutations edit
  drafts only (`NOT_EDITABLE`, Saleor also edits unconfirmed orders); every line change re-reads
  all of the draft's line prices and names from the catalog. Catalog now owns the "published"
  rule (`isProductPublished`), which checkout reuses.
- **M13.4, awaiting the owner's OK:** finalizing needs a customer email (`REQUIRED` on
  `userEmail`; Saleor allows none, our orders and their CHECK require one); the shipping price is
  the method's price at finalization; a failed finalization still saves the re-read line prices
  and shipping price (the draft follows the catalog anyway); short stock is one
  `INSUFFICIENT_STOCK` error per variant naming its lines (Saleor: per line and warehouse).
- **M13.5 left out or different from Saleor, awaiting the owner's OK:** "Create order" creates the
  draft at once (Saleor first asks for a channel); the Drafts list has no channel column, filters,
  presets, row selection or bulk delete; "All draft orders" is plain text (no presets); the date
  column uses the order list's date cell (Saleor: text).
- **M13.6 left out or different from Saleor, awaiting the owner's OK:** M13.6 was split in two
  (page and lines; customer, addresses and shipping in M13.7), so the golden path moved to M13.8.
  The lines are a plain table like the Fulfill page's (Saleor: an editable Glide grid with a row
  menu): the quantity saves on blur or Enter, a trash button removes; no "is gift", status,
  discount or metadata columns. The add-products dialog shows the first 20 published matches (no
  infinite scroll or "load more variants") and adds one of each chosen variant. Finalize and line
  errors are error toasts (Saleor shows some next to the fields); Finalize opens the placed order
  at /orders/:id. No channel alert, metadata, notes or widgets. Saleor's Mongolian for "order
  line" toasts said "order list" and is corrected.
- **M13.7 left out or different from Saleor, awaiting the owner's OK:** the API gained Saleor's
  `Shop.countries` (every known country; Saleor lists its shipping zones' countries) for the
  address form. "Change customer" searches accounts or takes "Use email: …" as Saleor, but without
  Saleor's customer-change dialog (no address books to copy addresses from). Addresses are edited
  for any draft, also an email-only one (Saleor: only with an account), with Saleor's "Add new
  address" form only and its "Set the same for billing / shipping address" checkbox. The shipping
  dialog lists active methods only (Saleor also shows unavailable ones, disabled). Found, not
  fixed: the golden path's variant sometimes has an empty name (the line shows "-"); it predates
  M13.
- **After M13 (owner, 2026-11-14): no shipping or tax for now.** A draft finalizes without a
  shipping address or method (migration 0022: placed orders need only an email and a billing
  address); the dashboard shows no Tax row, and shows Shipping and the shipping address only on an
  order that has them (older checkout orders); the draft page edits the customer and the billing
  address only; the print view follows. Finalize's errors are shown in red next to the customer,
  the billing address or the lines, with one toast saying so. Checkout still requires shipping
  (revisit with the storefront, M4).
- **Draft page after M13 (owner, 2026-11-14): no billing address, Saleor's editable lines grid.**
  A draft finalizes without a billing address too (migration 0023: a placed order needs only an
  email); the dashboard shows an address only on an order that has one, and the draft edits none
  (the address dialog is gone). The lines are Saleor's Glide grid: quantity edited in the cell
  (saves when the cell is left), column picker, row "⋮" menu with "Product details" and "Remove
  product" (Saleor's confirmation dialog); Finalize's per-line errors show in the Status column.
  Our Datagrid gained Saleor's cell editing, change tracking, number cell and row actions. Left
  out: discounts, "is gift", the metadata button; Status shows one pill (Saleor: a
  tags cell from glide-data-grid-cells). Mongolian for the new texts is ours except "Статус".
  "Add products" is now Saleor's dialog: picker header with the search, a 56px-row table with
  Saleor's legacy 48px-hit-area checkboxes (redrawn from macaw-ui 0.7, CC-BY-4.0) and 40px
  thumbnails; the title names the shop ("Add product from {shop}"). Still the first 20 matches (no
  infinite scroll, backfill or "load more variants").
- **M13.1 (print):** our own print view (Saleor has none), approved by the owner (2026-11-14).
- **M14 (simpler product creation, owner 2026-11-18/19):** create = name + category + price
  (default variant named after the product, published); free-text variant names, optional typed
  SKU; Saleor's editable Variants grid saved per changed row (no bulk mutations, no row deletion,
  fullscreen or generator); variant media chosen from the product's images (Saleor's VariantMedia),
  thumbnails in the variant navigation only, as in Saleor. Not fixed, needs the owner's go:
  - Locally the golden path fails at "staff adds products to the draft and changes a quantity"
    ("Order line updated" never shows), also on `85d616e` before M14; CI passes.
  - Dark theme: a red error cell's text is hard to read (Macaw's dark `background.critical1` is a
    light pink under light text); Saleor paints the same colour.
  - Clearing a stock cell sends nothing (never removes a stock row); needs an API/UX decision.
  - Deviation: an error cell also overrides Glide's selection accent, so a rejected cell is red at
    once (Saleor's stays grey until the selection moves).
  - `variantMediaAssign` on a media deleted at the same moment returns a server error, not
    `NOT_FOUND` (rare race).

## M11 — Dashboard in Mongolian and English
- **Objective:** every dashboard screen reads in Mongolian or English; a staff member picks the
  language in Account settings, as in Saleor, and the choice is remembered.
- **Concepts:** ICU messages with react-intl, message extraction (formatjs), lazy-loaded locale
  files, locale-aware dates and numbers, translation coverage as a test.
- **Saleor reference:** `../saleor-dashboard/src/components/Locale/Locale.tsx` (provider,
  localStorage `locale`, lazy `locale/<code>.json`), `src/staff/components/StaffPreferences/`
  (the "Dashboard language" card on the staff details page of the signed-in user, reached from the
  user menu's "Account Settings"), `locale/mn.json` (Crowdin, partial). Our messages already use
  react-intl with Saleor's ids (319 of 329); Saleor's mn.json translates 102 of them.

**Owner decisions (2026-11-13):**
1. **Languages:** Mongolian and English. **Default Mongolian**; the choice is remembered (Saleor's
   localStorage `locale`).
2. **The picker is Saleor's:** a minimal Account settings page (the signed-in user's staff details
   page) with the "Dashboard language" card, linked from the user menu's "Account Settings"
   (closes M1.1.7's open item).
3. **Translations:** Saleor's mn.json where it covers our messages; the lead drafts the rest, the
   owner reviews them.

**Proposed by the lead, approved by the owner (2026-11-13):**
4. **Minimal Account settings** = Saleor's URL `/staff/<id>` for the signed-in user only (another
   id → not found until staff pages exist); the title is the user's name; a read-only card with
   first name, last name and email (no editing, avatar or password change yet); the right sidebar
   has the "Dashboard language" card (Combobox with English and Монгол, page reload after a
   change, as Saleor). Language names in their own language ("Монгол"; Saleor shows "Mongolian").
5. **Extraction:** `@formatjs/cli` (new dev dependency, exact version) with Saleor's
   `extract-messages` script writes `apps/dashboard/locale/defaultMessages.json` (generated,
   committed, checked for drift like the GraphQL types); `locale/mn.json` is hand-edited (its
   Saleor-sourced entries noted in THIRD_PARTY_LICENSES.md).
6. **Coverage is a test:** a dashboard unit test fails when a message has no Mongolian entry, or
   mn.json has an entry for an unknown id. The Playwright golden path runs in English (it sets the
   `locale` item before loading the page), so its selectors stay as they are.

**Steps (each one commit, one report):**

| Step | What | Status |
|---|---|---|
| M11.1 | Locale infrastructure: Saleor's LocaleProvider (en, mn; default mn; localStorage; lazy mn.json; `<html lang>`), `extract-messages`, defaultMessages.json, an empty mn.json; e2e forced to English; tests | Done |
| M11.2 | Account settings page (decision 4) and the user menu's "Account Settings"; checked against Saleor's page | Done |
| M11.3 | Every visible string through react-intl (audit of hard-coded text, labels in TS objects, Macaw props); Saleor's ids where Saleor has the same text | Done |
| M11.4 | Mongolian: Saleor's entries copied, the rest drafted by the lead; the coverage test (decision 6) | Done |
| M11.5 | Owner review of the Mongolian (a side-by-side list English / Mongolian), corrections applied | Waiting on the owner: https://claude.ai/artifact/1T6fwP7u3WDM5tvAi278J5 |
| M11.6 | Dates, numbers and money formatted in the chosen locale (no hard-coded `en`); released to production (docs/deploy.md) | Done (released by M12's first deploy, 2026-11-14) |

- **Acceptance:** a first visit shows Mongolian; switching to English in Account settings sticks
  across reloads and logins; no screen shows an untranslated message in Mongolian; dates follow
  the language; CI green, golden path included; live on admin.dino-craft.lol.
- **Out of scope:** translating catalog content (product/category names, Saleor's Translations
  feature), API error messages (the dashboard shows its own per error code), other languages,
  editing the profile or password on Account settings, the storefront.
- **Status:** In progress since 2026-11-13; all decisions approved.
- **M11.1 result:** `components/Locale/Locale.tsx` is Saleor's provider for `en`/`mn` (default
  `mn`, localStorage `locale`, unknown values → `mn`, lazy `locale/mn.json`, `<html lang>`); unlike
  Saleor it renders nothing until the file is loaded (no English flash), and an untranslated
  message shows its English text. `@formatjs/cli` 6.18.2 + Saleor's formatter: `pnpm
  extract-messages` → `apps/dashboard/locale/defaultMessages.json` (398 messages), checked for
  drift by verify.sh and CI. Component tests start in English (`src/test/setup.ts`); the golden
  path sets `locale=en`. ProductBulkDeleteDialog keeps Saleor's `id={messages.x.id}` JSX, so the
  extractor warns about it (its messages come from messages.ts). 5 provider tests; 436 dashboard
  tests and the golden path pass.
- **M11.2 result:** `/staff/:id` (no permission, as Saleor) shows Account settings for the signed-in
  user, Not found for any other id; the user menu's first item is Saleor's "Account Settings".
  The page: Saleor's title (name, "Me" pill, Active), "My profile" (initials, name and email,
  read-only), the "Dashboard language" card (English / Монгол; save, then reload as Saleor). Checked
  side by side with Saleor's page in the browser; switching saved `en` and reloaded. Left out (no
  staff list or editing yet): the back link, savebar, password reset, navigation pins, extension
  widgets, metadata.
- **M11.3 result:** audited by source scan and by a pseudo-translation (every message wrapped in
  ⟦…⟧, each screen opened in Mongolian, untranslated text collected from the DOM and the canvas
  grids by eye). Now translated, beyond Saleor: the filter's field labels, condition names
  (is/in/lower/greater/between), Yes/No and its two validation errors (translated where shown; the
  URL keeps the English names), "(included)" on the order summary, the column picker, image tile
  and filter-row button labels, the toast region label, the browser tab title. New ids are
  formatjs's content hash (checked against Saleor's). 424 messages. Known gap: the Glide grid's
  own search box (⌘F: "Type to search"…) is English inside the library, as in Saleor. Dates and
  money are M11.6.
- **M11.4 result:** `locale/mn.json` translates all 425 messages: Saleor's Mongolian for 130 of them
  (17 corrected, e.g. typos, a Latin "e" inside a Cyrillic word, "Fulfillment status" as just "Status",
  "Customer Overview" as "rating", bulk-delete questions putting the count in the singular), the
  rest drafted by the lead. Terms: бүтээгдэхүүн, ангилал, харилцагч (customer; Saleor said
  хэрэглэгч), захиалга, биелүүлэх, хувилбар, агуулах, нөөц, төлбөр, буцаан олголт, гүйлгээ.
  Checked: every placeholder/plural/tag matches the English (ICU parse), no mixed-script words.
  `translations.test.ts` fails CI on a missing or unknown Mongolian entry (option (a), the lead's recommendation; the owner
  may switch to a report-only check); a removed entry was caught. At runtime an untranslated
  message still shows its English text.
- **M11.6 findings:** every date, number and money format already takes the locale from react-intl
  (`intl.formatDate`, the grid cells' `useIntl().locale`); nothing hard-codes `en`. But Chrome 157
  ships no Mongolian date/number data (`Intl.DateTimeFormat.supportedLocalesOf(["mn"])` is empty) and
  falls back to en-US, so in Chrome dates read "Thursday, November 12, 2026"; Safari and Firefox
  have the data. Numbers look the same either way (140,000); plural rules are fine. Fixed with the
  owner's OK (2026-11-14): `@formatjs/intl-datetimeformat` 7.9.0 (FormatJS's polyfill), loaded only
  in Mongolian and only where the browser lacks the data (`polyfillDateTimeFormat.ts`): `mn` data +
  the golden time zones, ~180 kB gzip as lazy chunks; the browser's own time zone is kept (the
  polyfill defaults to UTC). Checked in Chrome: "2026 оны 11-р сарын 12 14:03 (GMT+8)".

## Storefront programme (M4.0, M15, M4): overview

Goal: a production-ready storefront that looks and behaves like Saleor's official storefront
("Paper", `../saleor-storefront`), running on our API. Requested by the owner on 2026-11-19, which
is the Phase 4 go (API and Admin confirmed complete; M11's translation review stays open and does
not block). **Plan approved by the owner on 2026-11-19**, including the AI team change.

### Owner decisions (2026-11-19)

1. **License:** amend ADR-0008. We adapt Paper's UI closely (markup, Tailwind classes, design
   tokens, component structure) under FSL-1.1-ALv2. Every adapted file gets an attribution
   header, and `THIRD_PARTY_LICENSES.md` gets the FSL text. The data layer, auth, cart and checkout
   logic are ours, because Paper's are tied to Saleor channels, JWT and app tokens. Paper's name,
   logo and "Paper sign" are not used (trademark): the shop name is used instead, as in the dashboard.
2. **API gaps built first (M15):** password reset, address book and account settings, collections,
   menus and pages. **Not built:** attributes. The PDP uses Paper's non-matrix buy box (a variant
   list), and listing filters are category, collection, price and sort.
3. **URLs and locales:** `/{locale}/…` with `mn` (default) and `en`; no channel segment
   (ADR-0005). UI strings use next-intl (`messages/{mn,en}.json`); catalog content is not
   translated.
4. **Payments:** the dummy gateway now, behind a small payment-provider registry like Paper's.
   A real gateway (e.g. QPay) is a later milestone, once the owner picks a provider.

### Architecture (written into ADR-0015 in M4.0)

- **Stack** (Paper's, pinned): Next.js 16 App Router, React 19, Tailwind 3.4, next-intl,
  Radix primitives, lucide-react, clsx. No urql: server-only `fetch` with typed documents
  generated by graphql-codegen (client preset) from `apps/api/schema.graphql`, like the dashboard's
  codegen. Biome, not ESLint (repo convention).
- **BFF:** the browser never talks to the API. Server Components read the catalog, and Server
  Actions or route handlers do every mutation. Only the Next.js server calls the API.
- **Sessions:** `/api/auth/login` calls `tokenCreate` server-side, takes the session token from the
  API's `Set-Cookie`, and stores it in our own `HttpOnly; Secure; SameSite=Lax` cookie on the
  storefront domain. It is forwarded to the API as `Authorization: Bearer` (ADR-0006 already
  allows this). The checkout token lives in a second HttpOnly cookie. No API change is needed.
- **Client IP:** the storefront forwards the shopper's address so login throttling still works
  per shopper. The exact `X-Forwarded-For` and `TRUST_PROXY` setup is decided and tested in M4.7.
- **Caching:** catalog reads use `"use cache"` + `cacheLife` with short profiles and `cacheTag`
  per entity. Pages with a cart or session are dynamic. On-demand revalidation (an API webhook
  through our job outbox) is deferred; time-based revalidation is enough at first.
- **Images:** `next/image` with an explicit allowlist (the API host and the S3 media host), as in
  Paper's `next.config.js`. No wildcard in production.
- **Money:** only `@commerce/contracts` (MNT, 0 decimals); no ad-hoc formatting.
- **Layout:** `apps/storefront/src/{app,ui,lib,checkout,graphql}`, mirroring Paper's folders, so
  each adapted file is easy to compare with its source.

### AI team for this programme (changes `docs/ai-workflow/`, done in M4.0)

The lead (Claude Code, Opus) owns architecture, ADRs, dependencies, briefs, the diff review,
`verify.sh`, commits and reports. Every diff is reviewed by the lead; there are no reviewer agents.

| Implementer | Runs on | Gets | Why |
|---|---|---|---|
| DeepSeek V4.1 Flash | OpenCode Go | M15: API, DB, dashboard | Wrote M1–M14 in this repo's conventions; cheapest |
| GLM-5.3 | OpenCode Go | Storefront UI pages adapted from Paper (catalog, PDP, home, account UI) | Strong frontend work, large context for reading Paper; cheaper than Sonnet |
| Claude Sonnet 5.5 | Claude Code subagent, own worktree | Scaffold and conventions, sessions and auth, cart, checkout logic, e2e, deploy | Security- and state-critical code where mistakes cost most |
| Claude Haiku 5.5 | Claude Code subagent | Mechanical, fully specified work: message catalogs, first-draft mn translations, SEO files, license headers | Fast and cheap for work without design choices |

- **Escalation:** a brief that fails review twice moves up one tier (Haiku → GLM-5.3 → Sonnet;
  DeepSeek → Sonnet).
- **Budgets:** when OpenCode Go runs out of funds, its briefs go to Sonnet, then to the lead. Limits
  are never raised (organization rule).
- **Parallelism:** at most two implementers at a time, each in its own worktree, with file lists
  that don't overlap. For example, M15 (DeepSeek) runs alongside M4.1–M4.3, which need no new API.
- **Guardrails:** the OpenCode implementer rule that denies `apps/storefront/**` is lifted.
  `spawn.sh` gets `--model` so it can start GLM-5.3 or DeepSeek. Claude subagents get the same
  `AGENTS.md` rules in their brief, and the lead checks their diff exactly like an OpenCode diff.

## M4.0 — Storefront programme setup (lead only)

| Step | What | Status |
|---|---|---|
| M4.0.1 | Amend ADR-0008 (adapt Paper UI under FSL with attribution); FSL text in `THIRD_PARTY_LICENSES.md`; header template for adapted files | Done |
| M4.0.2 | ADR-0015 storefront architecture (BFF, session and checkout cookies, `/{locale}` routing, caching, images); update ARCHITECTURE §10 | Draft |
| M4.0.3 | AI team: model routing table in `docs/ai-workflow/`, `spawn.sh --model`, lift the storefront deny rule, Claude-subagent brief template, update CLAUDE.md's "one implementer" text | Draft |

## M15 — API and dashboard for the storefront (DeepSeek V4.1 Flash)

Saleor names throughout. Deviations go in ARCHITECTURE §4.

| Step | What | Status |
|---|---|---|
| M15.1 | Password reset: `requestPasswordReset` (an email through the outbox, `redirectUrl` checked against `ALLOWED_CLIENT_HOSTS`, throttled, no account enumeration) and `setPassword` (single-use, expiring token; ends other sessions) | Draft |
| M15.2 | Account self-service: `accountUpdate` (name), `passwordChange`, the `address` table for the user's address book, `accountAddressCreate/Update/Delete`, `accountSetDefaultAddress`, `me.addresses`, `defaultShippingAddress` / `defaultBillingAddress`; checkout prefills from the defaults | Draft |
| M15.3 | Guest order lookup: an unguessable `Order.token`, set at completion and returned by `checkoutComplete`, plus a public query to read one order by token (Saleor's `orderByToken`; deprecated in Saleor, a logged deviation) | Draft |
| M15.4 | Collections API: tables, `collectionCreate/Update/Delete`, `collectionAddProducts/RemoveProducts`, public `collections` / `collection(slug)` (published only), `Product.collections`, a `products` filter by collection and price range | Draft |
| M15.5 | Collections in the dashboard: list, detail and assigned products, matching `../saleor-dashboard/src/collections/` | Draft |
| M15.6 | Pages (rich text, Saleor's EditorJS JSON) and menus (`menu(slug)`, nested items linking to a category, collection, page or URL; `navbar` and `footer` seeded): API with public reads | Draft |
| M15.7 | Pages and menus in the dashboard, matching `../saleor-dashboard/src/pages/` and `src/navigation/` (the page-types simplification is explained when the step starts) | Draft |

## M4 — Storefront (Paper-like, production ready)

Each step adapts the named Paper files. The implementer for each step is in brackets.

| Step | What | Status |
|---|---|---|
| M4.1 | Scaffold [Sonnet]: Next 16 app, Paper's `brand.css` tokens and Tailwind config, next-intl `mn`/`en` with `/{locale}` middleware, env validation, typed GraphQL fetch and codegen, header/footer shell, error and 404 pages, Vitest, a `Dockerfile` target | Draft |
| M4.2 | Catalog listing [GLM-5.3]: product card and grid, `/products`, `/categories/[slug]`, `/collections/[slug]`, filter bar (category, price, sort), pagination, skeletons (`src/ui/components/plp/`) | Draft |
| M4.3 | Product page [GLM-5.3]: gallery and viewer, non-matrix buy box, price, stock state, breadcrumbs, JSON-LD (`src/ui/components/pdp/`) | Draft |
| M4.4 | Home, navigation, CMS pages and search [GLM-5.3]: home sections fed by collections, menus in the header and footer, `/pages/[slug]`, `/search` | Draft |
| M4.5 | Cart [Sonnet]: checkout-token cookie, Server Actions for add/update/remove, cart drawer and `/cart` (`src/ui/components/cart/`), add-to-cart and quick-add wired | Draft |
| M4.6 | Checkout [Sonnet logic, GLM-5.3 sections]: `?step=contact\|shipping\|payment`, address form (Mongolian format), delivery method, dummy payment through a provider registry, complete, `/order/[token]` confirmation (`src/checkout/`) | Draft |
| M4.7 | Auth [Sonnet]: login, sign-up, confirm account, reset and set password, logout, session cookie, client-IP forwarding (`src/app/api/auth/`, `src/ui/components/auth/`) | Draft |
| M4.8 | Account [GLM-5.3]: overview, orders list and detail with timeline, addresses, settings (name, password) (`src/ui/components/account/`) | Draft |
| M4.9 | Translations [Haiku]: every UI string in `messages/`, first-draft Mongolian for the owner to review, MNT and date formatting, `hreflang` | Draft |
| M4.10 | SEO and performance [Haiku]: metadata, `sitemap.xml`, `robots.txt`, OG images, image allowlist, security headers (CSP); Lighthouse on mobile: ≥ 90 performance and accessibility on PLP and PDP | Draft |
| M4.11 | QA [Sonnet]: Playwright golden paths (a guest buys; a customer registers, buys, and sees the order), an axe accessibility pass, CI job; the lead compares screenshots side by side with Paper | Draft |
| M4.12 | Deploy [Sonnet + lead]: storefront image (Next standalone), a compose service, nginx vhost for the bare domain `dino-craft.lol` (owner, 2026-11-19; the dashboard stays on `admin.`), CDK changes, health check, continuous deployment | Draft |

**Done means:** every page above works against the real API in Mongolian and English; e2e is
green in CI; the storefront never holds staff credentials; it is deployed and reachable on its
domain.

**Later, not in this programme:** a real payment gateway, attributes and the matrix variant picker,
multiple channels, analytics, on-demand cache revalidation.
