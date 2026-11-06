# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| P0 | Planning: ARCHITECTURE.md, PLAN.md, CLAUDE.md, ADRs | Done |
| M0 | Foundations | In progress |
| M0.1 | Monorepo skeleton & local infrastructure | Done |
| M0.2 | API skeleton: server, DB, migrations, schema pipeline, test harness | Draft |
| M0.3 | Dashboard shell: Macaw theme, routing, faithful Saleor sidebar | Draft |
| M1 | Identity: staff auth & permissions | Draft |
| M1.1 | Users, sessions, login/logout/me | Draft |
| M1.2 | Permission groups & guarded API/dashboard | Draft |
| M2 | Catalog | Draft |
| M2.1 | Categories end-to-end (first Glide list + first save-bar form) | Draft |
| M2.2 | Products & variants API + product list grid | Draft |
| M2.3 | Product list filtering (URL state → variables → where → SQL) | Draft |
| M2.4 | Product create/update form | Draft |
| M2.5 | Product media | Draft |
| M3 | Inventory: warehouse, stock, availability | Draft |
| M4 | Storefront catalog | Draft |
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

Detailed specs for M0 are review-ready. M1+ are scoped but will be refined (with you) before
each starts.

---

## P0 — Planning

- **Objective:** agree on architecture, roadmap, working agreement.
- **Decisions requiring confirmation:** ADR-0001 … ADR-0010 (accept / change each) and the
  open questions in §"Open decisions" at the end of this file.
- **Acceptance:** owner approves (or edits) ARCHITECTURE.md, ADRs, and approves M0.1.
- **Status:** Done (2026-11-06). All ADRs accepted; open decisions resolved.

---

## M0 — Foundations

### M0.1 Monorepo skeleton & local infrastructure

- **Objective:** a working, empty monorepo where `install`, `dev`, `lint`, `typecheck`, `test`
  run through Turborepo, and PostgreSQL runs in Docker.
- **Scope:** root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/tsconfig`,
  Biome (lint + format), `docker-compose.yml` (postgres:18, volume at `/var/lib/postgresql`), `.env.example`,
  `.nvmrc`, `.gitignore`, `git init`, `THIRD_PARTY_LICENSES.md`. Three placeholder apps that each
  just print/serve "hello" so turbo pipelines are real.
- **Concepts to learn:** pnpm workspaces & `workspace:*` protocol; Turborepo task graph
  (`dependsOn`, `^build`, outputs, caching); shared tsconfig bases; why Postgres in Docker but
  apps on host.
- **Decisions requiring confirmation:**
  - ~~ESLint + Prettier vs Biome~~ → **Decided: Biome** (2026-11-06).
  - ~~Postgres host port~~ → **Decided: 5433** (2026-11-06).
- **Tasks:**
  1. `git init`, `.gitignore`, `.nvmrc` (22), root `package.json` with `packageManager`.
  2. `pnpm-workspace.yaml`, `turbo.json` with `dev`, `build`, `lint`, `typecheck`, `test`.
  3. `packages/tsconfig` (`base.json`, `node.json`, `react.json`).
  4. Root `biome.json` (lint + format); `lint` and `format` scripts.
  5. `docker-compose.yml` + `pnpm db:up/db:down` scripts.
  6. Placeholder `apps/api`, `apps/dashboard`, `apps/storefront` with `typecheck`/`lint` scripts.
- **Acceptance / verification:**
  - `pnpm install` clean; `pnpm typecheck && pnpm lint` green across 3 apps; second run shows
    Turbo cache hits.
  - `pnpm db:up` → `psql -h localhost -p 5433 -U commerce -c 'select 1'` succeeds.
- **Exclusions:** no GraphQL, no DB schema, no UI, no CI.
- **Status:** Done (2026-11-06).
- **Verification results:** `pnpm install` clean; `pnpm typecheck` 3/3 green, re-run 3/3 cached
  (20 ms, FULL TURBO); `pnpm lint` green; `pnpm dev` runs all three placeholders via turbo;
  `pnpm db:up` → Postgres 18.6 healthy on :5433, `select uuidv7()` works; data survives
  `db:down`/`db:up` (PGDATA `/var/lib/postgresql/18/docker` inside the volume).
- **Deviations / notes:** TypeScript 6.0.3 instead of 7.0 (tool compatibility); Markdown excluded
  from Biome (its formatter rewrote ADR `+`/`−` bullets); lint runs once at root instead of as a
  per-app turbo task.

### M0.2 API skeleton

- **Objective:** a running GraphQL API backed by Postgres, with the full schema→client type
  pipeline and a real-DB test harness — exercised by one tiny feature: `shop { name currency }`.
- **Scope:** Yoga + Pothos server on :4000, request context (db, request id), Kysely connection,
  SQL migration runner, migration `0001_shop_settings.sql`, kysely-codegen DB types,
  `schema:print`, `Money` value module + `Money` GraphQL type, Vitest with template-DB isolation,
  structured logging (pino).
- **Concepts:** GraphQL execution (parse/validate/execute, resolvers, context per request);
  code-first schema with Pothos; connection pooling; forward-only migrations; why test against
  real Postgres; bigint minor-unit money.
- **Decisions requiring confirmation:**
  - Migration runner: ~60-line in-repo script vs `node-pg-migrate`. *Recommend in-repo (fully inspectable).*
  - ~~UUID generation~~ → **Decided** by the Postgres 18 choice: `id uuid DEFAULT uuidv7()` in the DB.
- **Tasks:**
  1. Kysely + pg pool; `db:migrate` runner + `schema_migrations` table.
  2. `0001_shop_settings.sql` + seed row.
  3. Pothos builder, `shop` query, Yoga server, CSRF plugin, error masking.
  4. `money.ts` (+ unit tests) and `Money` type.
  5. `schema:print` + `db:types` scripts; turbo wiring.
  6. Test harness: template DB, `createTestContext()`, first GraphQL contract test.
- **Acceptance:** `curl` POST `{ shop { name currency } }` returns seeded data; request without
  CSRF header is rejected; `pnpm test` green (money units + one GraphQL test against real DB);
  `schema.graphql` committed and regenerating it produces no diff.
- **Exclusions:** auth, DataLoaders, Relay plugin/connections (arrive with first list in M2.1).
- **Status:** Draft.

### M0.3 Dashboard shell

- **Objective:** the Saleor Dashboard frame — Macaw theme, routing, and a faithful reproduction of
  Saleor's sidebar — with placeholder pages, talking to the API (`shop.name` shown in sidebar header).
- **Scope:** Vite + React 18 + TS, `@saleor/macaw-ui` 3.x ThemeProvider (light/dark + theme
  switcher), React Router 6, Apollo Client + codegen against `apps/api/schema.graphql`, react-intl
  (en), app layout, Sidebar adapted from `../saleor-dashboard/src/components/Sidebar/**`
  (menu hierarchy limited to sections we will build — see decision), collapsed rail, mobile drawer,
  keyboard nav, placeholder routes, NotFound page.
- **Concepts:** Macaw tokens (`vars`, sprinkles props on `Box`), theme switching; SPA routing;
  Apollo normalized cache; codegen typed documents; how Saleor composes the sidebar from menu
  item definitions + permissions.
- **Decisions requiring confirmation:**
  - ~~Sidebar menu items: roadmap-only vs full Saleor menu~~ → **Decided: roadmap-only**
    (2026-11-06): Home, Catalog→Products/Categories, Orders, Customers, Configuration. Items appear
    as their milestone lands. All visual/interaction behavior still matches Saleor.
  - Before coding, I'll present an inventory of the Saleor sidebar files to copy vs adapt vs
    omit (e.g. DeprecationBanner, cloud environment switcher, extensions mounting point, ripples
    are Saleor-Cloud specific) for approval.
- **Tasks:** (1) Vite app + Macaw provider + fonts; (2) router + layout; (3) sidebar inventory →
  approval → adapt; (4) Apollo + codegen + `shop` query in header; (5) placeholder pages.
- **Acceptance:** side-by-side visual comparison with real Saleor Dashboard (run via
  `../saleor-platform`) at desktop & mobile widths, expanded & collapsed, light & dark; keyboard
  Tab/Enter navigation works; screenshots attached to the milestone summary.
- **Exclusions:** login (M1), real list pages (M2), Glide (M2.1).
- **Status:** Draft.

---

## M1 — Identity

### M1.1 Users, sessions, login/logout/me
- **Objective:** staff can log in to the dashboard; sessions are revocable.
- **Scope:** `user`, `session` tables; argon2id; `login`, `logout`, `me`; cookie handling;
  `pnpm cli createsuperuser`; dashboard login page (adapted from `src/auth/components/LoginPage`),
  auth context, logout in sidebar user menu.
- **Concepts:** password hashing; session vs JWT (ADR-0006); cookies (HttpOnly/SameSite/Secure);
  CSRF.
- **Decisions:** mutation names — Saleor's `tokenCreate` vs explicit `login`.
- **Acceptance:** integration tests for wrong password, inactive user, expired session, logout
  revocation; manual dashboard login/logout.
- **Exclusions:** password reset (needs email, M8), customer login (M7).
- **Status:** Draft.

### M1.2 Permission groups & guards
- **Objective:** staff permissions enforced by API, reflected in dashboard UX.
- **Scope:** permission tables + enum; `requirePermission`; staff/group management minimal API
  (`permissionGroupCreate/Update`, `staffCreate`) — dashboard UI for it deferred or minimal (decide);
  route guard + not-allowed page; sidebar filtering.
- **Concepts:** authn vs authz; union of group permissions; defense in depth (UI hides, API enforces).
- **Decisions:** build Staff/Permission Groups dashboard pages now or later?
- **Acceptance:** contract tests for every guarded field returning permission error; dashboard
  shows not-allowed page for a user lacking `MANAGE_PRODUCTS`.
- **Status:** Draft.

---

## M2 — Catalog

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

### M2.2 Products & variants API + list grid
- Scope: product/variant tables, `products` connection, nested `variants`, DataLoaders,
  product list grid (columns from `src/products/components/ProductListDatagrid`), column picker,
  sort. **Excludes filtering** (M2.3).
- Concepts: N+1 and DataLoader; computed columns; Glide custom cells.
- Status: Draft.

### M2.3 Product list filtering
- Scope: `ProductWhereInput` (category oneOf, isPublished eq, price range, later stock), `search`;
  filter UI adapted from ConditionalFilter UI; URL serialization; variables builder with unit tests;
  "no results" empty state; presets deferred.
- Concepts: the five separated concerns (ARCHITECTURE §9.3); index-aware SQL filtering.
- Decisions: URL format for filters; which Saleor filter UI features to reproduce in v1.
- Status: Draft.

### M2.4 Product create/update form
- Scope: product + variants editing (prices, SKU), publish toggle with invariant, delete;
  client+server validation; Savebar.
- Decision: Saleor's product-type-driven create dialog vs simple create (no product types yet).
- Status: Draft.

### M2.5 Product media
- Scope: local-disk file storage behind a tiny `storage` interface, upload via multipart GraphQL
  or signed REST endpoint (decide), media reorder.
- Status: Draft.

---

## M3 — Inventory
- **Objective:** stock per variant in the single warehouse; availability visible to staff and API.
- **Scope:** `warehouse` (seeded), `stock`, `allocation` tables with CHECK constraints;
  stock editing in variant form; `quantityAvailable` field; stock filter in product list.
- **Concepts:** DB constraints as invariants; why allocations are a table, not just a counter.
- **Acceptance:** constraint violation tests; stock updates visible in grid.
- **Status:** Draft.

## M4 — Storefront catalog
- **Scope:** Next.js app, category listing, PDP, published-only visibility, typed fetch, Tailwind.
- **Concepts:** Server Components, caching/revalidation, public vs staff API visibility.
- **Status:** Draft.

## M5 — Checkout
- **M5.1 Cart:** `checkoutCreate`, `checkoutLinesAdd/Update/Delete`, token cookie via Server
  Actions, live price calculation, advisory stock check.
- **M5.2 Details:** email, addresses (validation), shipping methods (admin CRUD minimal),
  `TaxedMoney` totals.
- **M5.3 Payments (dummy):** `payment_transaction` + events, dummy provider authorize/charge,
  `transactionInitialize`-like mutation. Decision: real Stripe test-mode as optional M5.5.
- **M5.4 Completion:** §5.4 flow; concurrency tests (two buyers, last unit; double submit);
  order confirmation page.
- **Status:** Draft.

## M6 — Orders in the dashboard
- **M6.1:** order list grid with filters (status, date range, customer email, payment status),
  order detail (lines, totals, addresses, timeline) — adapted from `src/orders/`.
- **M6.2:** fulfill (stock decrease), cancel (deallocate), mark as paid, refund; timeline events.
- **Status:** Draft.

## M7 — Customer accounts
- Storefront register/login/logout, order history; checkout attaches to user; dashboard
  customers list/detail.
- **Status:** Draft.

## M8 — Background processing
- Requirement: order confirmation email. Outbox table written in the order transaction; pg-boss
  worker; Mailpit in compose; password reset now possible.
- **Status:** Draft.

## M9 — Hardening & deployability
- Dockerfiles, production config/env validation, rate limiting on login, CI pipeline, Playwright
  golden paths, basic observability.
- **Status:** Draft.

---

## P0 decisions (resolved)

1. **Decided: ADR-0001…0010 all Accepted** (2026-11-06).
2. **Decided: PostgreSQL 18** (2026-11-06) — native `uuidv7()`; matches local psql 18.
3. **Decided: Biome** (2026-11-06).
4. **Decided: roadmap-only sidebar items** (2026-11-06).
5. **Decided: Saleor names except where ours is clearer** (2026-11-06). Every deviation is
   listed in ARCHITECTURE §4 "Naming deviations from Saleor" with its reason.
