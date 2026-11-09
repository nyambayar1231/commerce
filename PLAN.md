# PLAN

Hierarchical roadmap. Only the owner advances status to **Approved**; an agent never starts a
milestone that is not Approved and stops after each sub-milestone.

Status legend: `Draft` → `Approved` → `In progress` → `Done` (or `Deferred`).

| Milestone | Title | Status |
|---|---|---|
| P0 | Planning: ARCHITECTURE.md, PLAN.md, CLAUDE.md, ADRs | Done |
| M0 | Foundations | Done |
| M0.1 | Monorepo skeleton & local infrastructure | Done |
| M0.2 | API skeleton, in 8 small steps (M0.2.1–M0.2.8) | Done |
| M0.3 | Dashboard shell, in 11 small steps (M0.3.1–M0.3.11) | Done |
| M1 | Identity: staff auth & permissions | Approved |
| M1.1 | Users, sessions, login/logout/me | Approved |
| M1.2 | Permission groups & guarded API/dashboard | Approved |
| M2 | Catalog | Draft |
| M2.1 | Categories end-to-end (first Glide list + first save-bar form) | Draft |
| M2.2 | Products & variants API + product list grid | Draft |
| M2.3 | Product list filtering (URL state → variables → where → SQL) | Draft |
| M2.4 | Product create/update form | Draft |
| M2.5 | Product media | Draft |
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

- **Objective:** a running GraphQL API backed by Postgres, built up in small steps you approve
  one at a time. It ends with one tiny feature, `shop { name currency }`, plus tests and the
  schema file clients will generate types from.
- **History:** a first attempt was delivered in one large batch, judged too big to follow, and
  fully removed (never committed). It was also switched from Kysely to Drizzle (ADR-0011).
- **Decided:** seed shop = Hantesi-Mongolia / MNT / MN (owner, 2026-11-06); IDs via Postgres 18
  `uuidv7()` defaults; migrations via drizzle-kit (no in-repo runner).
- **Exclusions:** auth, DataLoaders, Relay connections (M2.1), `Money` GraphQL type (added with
  the first price field, M2.2), CI.
- **Rule:** each sub-step is done in its own turn; I stop after it and wait for your approval.

| Step | What | New files (approx.) | Status |
|---|---|---|---|
| M0.2.1 | `packages/db`: Drizzle + postgres.js client, `Executor` type | `packages/db/src/{client,index,ping-cli}.ts` | Done |
| M0.2.2 | First table in a Drizzle schema + generated migration | `packages/db/src/schema/shop.ts`, `drizzle.config.ts`, `drizzle/0000_*.sql` | Done |
| M0.2.3 | Seed the shop row with a custom SQL migration | `packages/db/drizzle/0001_*.sql` | Done |
| M0.2.4 | Minimal GraphQL server: Yoga + Pothos + `shop` query | `src/{app,server}.ts`, `src/graphql/*`, `src/modules/shop/*` | Done |
| M0.2.5 | Request safety: CSRF protection, error masking, request-id logging | `src/app.ts` | Done |
| M0.2.6 | `Money` contract + first unit tests (Vitest) | `packages/contracts/src/money{,.test}.ts` | Done |
| M0.2.7 | Real-Postgres test harness + `shop` GraphQL test | `vitest.config.ts`, `test/global-setup.ts`, `shop.test.ts`, `packages/db/src/migrate.ts` | Done |
| M0.2.8 | Print `schema.graphql` + Turborepo task | `src/print-schema-cli.ts`, `schema.graphql` | Done |

#### M0.2.1 `packages/db` with a Drizzle client
- **Concepts:** a shared workspace package consumed as TS source; a connection pool; lazy
  client creation and graceful `closeDb()`; `Executor = Db | Tx` and compile-time
  "must run in a transaction" (pattern from dino-publishing).
- **Tasks:** `@commerce/db` package (drizzle-orm 0.45.4, postgres 3.4.9); `client.ts`;
  `db:ping` script; API depends on `@commerce/db`.
- **Acceptance:** `pnpm --filter @commerce/db db:ping` prints the PostgreSQL 18 version; importing
  `@commerce/db` from `apps/api` works at runtime; passing `Db` where `Tx` is required fails to
  compile; `pnpm typecheck` and `pnpm lint` pass.
- **History:** first done inside `apps/api` with `pg`; redone as a package after owner review.

#### M0.2.2 First table + generated migration
- **Concepts:** schema-as-code (`pgTable`, `check()`); `drizzle-kit generate` → reading the SQL it
  produced; `drizzle-kit migrate` and its bookkeeping table (`drizzle.__drizzle_migrations`).
- **Tasks:** `shop_settings` table (single-row `CHECK (id = 1)`, currency/country format checks);
  `drizzle.config.ts`; scripts `db:generate`, `db:migrate`.
- **Acceptance:** generated SQL reviewed together; migrate applies it; running migrate again is a
  no-op; inserting a second row fails with the check constraint.

- **Result (M0.2.2):** migration applied once (`drizzle.__drizzle_migrations` holds its SHA-256
  and the journal's generation time); re-run is a no-op; second row rejected (`single_row` CHECK
  or primary key), lowercase currency and empty name rejected. Code for this step written by the
  owner by hand from the printed reference. drizzle-kit prints harmless `IF NOT EXISTS` NOTICEs.

#### M0.2.3 Seed row via custom migration
- **Concepts:** data inside migrations vs a separate seed script, and when each fits.
- **Acceptance:** fresh DB → migrate → exactly one row `Hantesi-Mongolia | MNT | MN`.

#### M0.2.4 Minimal GraphQL server
- **Concepts:** parse → validate → execute; resolvers and per-request context; code-first schema
  with Pothos; non-null-by-default fields (matches Saleor).
- **Acceptance:** `curl` POST `{ shop { name currency } }` returns the seeded row.

#### M0.2.5 Request safety
- **Concepts:** CSRF and CORS preflights (the plugin only demands its header on requests that skip a
  preflight); masking unexpected errors; logs tagged with a request id.
- **Acceptance:** JSON POST 200; `text/plain` POST and header-less GET 403; with the DB down the
  client sees `Unexpected error.` while the log shows the real error and request id.

- **Result (M0.2.5):** written by the owner from the printed reference. Yoga 6 already provides
  request ids (`x-request-id` in/out, on every log line) and error masking, so no logger library
  was added (pino dropped). Added a custom `maskError` that delegates to Yoga's and logs the
  masked error's `cause` chain (Drizzle wraps driver errors; Yoga's log omitted the cause).
  Verified: CSRF 200/403/403/200, request id echoed, DB down → client `Unexpected error.`,
  log `AggregateError [ECONNREFUSED]` under the request id; expected errors not logged.

#### M0.2.6 Money module + unit tests
- **Concepts:** integer minor units as safe-integer `number`s, MNT exponent 0 (ADR-0013); a
  shared contracts package (ADR-0012); exact parsing; Vitest basics.
- **Acceptance:** `pnpm test` runs the contracts unit tests (construction, parse/format,
  currency mismatch, integer quantities, overflow).
- **Result:** first written in `apps/api` (owner, by hand, MNT-only); then, by owner decision,
  moved to `packages/contracts` with MNT exponent 0 and `number` amounts (ADR-0012, ADR-0013;
  ADR-0004 superseded). 9/9 tests; mutation check (weakened safe-integer guard) fails 2 tests.

#### M0.2.7 Real-Postgres test harness
- **Concepts:** why domain tests hit a real DB; one shared test database pointed to through the
  same env var production reads; a `_test` name guard; calling the Yoga app in-process.
- **Acceptance:** `shop` GraphQL test + CSRF test + single-row invariant test pass against
  `commerce_test`; the guard refuses a non-`_test` database.
- **Decided (owner, 2026-11-06):** dino-publishing's single-test-DB strategy instead of the planned
  per-file template databases (simpler; domain code reads `getDb()` unchanged).
- **Result:** 3/3 pass; `commerce_test` auto-created and migrated (2 migrations); second run OK;
  guard refused `commerce`; wrong constraint name → test fails; renaming the shop only in
  `commerce_test` → test fails (proves tests read the test DB). No truncation yet: these tests
  leave no data behind.

#### M0.2.8 Schema file pipeline
- **Concepts:** the printed SDL as the public contract; Turborepo caching of generated outputs.
- **Acceptance:** `pnpm schema:print` writes `schema.graphql`; re-running produces no diff.
- **Result:** cached re-run (FULL TURBO); forced re-run byte-identical; a temporary field showed up
  as a one-line diff and reverting it replayed the cached output; printing works with no reachable
  database (exit 0, ~0.3 s) because `getDb()` is lazy. `schema.graphql` excluded from Biome.

### M0.3 Dashboard shell

- **Objective:** the Saleor Dashboard frame — Macaw theme, routing, and a faithful reproduction of
  Saleor's sidebar — with placeholder pages, talking to the API (`shop.name` shown in sidebar header).
- **Scope:** Vite + React 18 + TS, `@saleor/macaw-ui` 3.x ThemeProvider (light/dark + theme
  switcher), React Router 7, Apollo Client + codegen against `apps/api/schema.graphql`, react-intl
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
- **Status:** Done (2026-11-09). Sub-steps approved 2026-11-06.
- **Rule:** each sub-step is done in its own turn; I stop after it and wait for your approval.

| Step | What | Status |
|---|---|---|
| M0.3.1 | Vite + React 18 app replaces the placeholder | Done |
| M0.3.2 | Macaw `ThemeProvider` + fonts, light/dark stored like Saleor | Done |
| M0.3.3 | react-intl provider (en) + `defineMessages` | Done |
| M0.3.4 | React Router 7, app layout, placeholder routes, NotFound | Done |
| M0.3.5 | Sidebar inventory (copy / adapt / omit) → owner approval; no code | Done |
| M0.3.6 | Sidebar: full column (≥1024px), menu definitions, header; dashboard Vitest | Done |
| M0.3.7 | Sidebar: collapse the column to the rail, persisted, Mod+B | Done |
| M0.3.8 | Sidebar: rail layout (768–1023px) and drawer layout (<768px) | Done |
| M0.3.9 | Sidebar footer ⋯ menu with the theme switcher; keyboard pass | Done |
| M0.3.10 | Apollo Client + codegen + `shop { name }` in sidebar header | Done |
| M0.3.11 | Side-by-side comparison with real Saleor; screenshots; close M0.3 | Done |

#### M0.3.1 Vite + React app
- **Concepts:** Vite serves native ES modules in dev and bundles with Rolldown for prod;
  `index.html` is the entry point; React 18 `createRoot`.
- **Acceptance:** `pnpm --filter @commerce/dashboard dev` serves a page showing "Hello";
  `build`, `typecheck`, `lint` pass.
- **Result:** react/react-dom 18.3.1, vite 8.3.6 (same as the API's), @vitejs/plugin-react 6.2.1.
  `typecheck`, `lint`, `build` (140 kB JS) pass; dev server on Vite's default :5173 (Saleor's
  :9000 stays free for the side-by-side in M0.3.11) serves `index.html` and the transformed
  `App.tsx`. Checked with curl, not yet in a browser.

#### M0.3.2 Macaw theme + fonts
- **Concepts:** Macaw's `ThemeProvider` sets the token CSS variables for `defaultLight` /
  `defaultDark`; sprinkles props on `Box`/`Text`; the `style` export bundles the Geist and Inter fonts.
- **Acceptance:** a `Box` styled with tokens renders; the stored theme switches light/dark.
- **Corrected (2026-11-08):** this step originally said "light/dark from the OS", but Saleor doesn't
  follow the OS. It defaults to `defaultLight` and keeps the user's choice in localStorage
  (`activeMacawUITheme`), so we match that. The writer (the switcher) comes in M0.3.9.
- **Result:** `@saleor/macaw-ui` 3.1.0 (latest; Saleor imports it under the alias `macaw-ui-next`)
  and `lucide-react` 0.555.0, Saleor's pin, although it doesn't meet Macaw's `^0.536.0` peer range
  (Saleor has the same mismatch). Adapted `src/theme/{consts.ts,provider.tsx}` and the global part
  of `src/index.css`, without Saleor's `!important`, which only beats its legacy MUI baseline.
  `src/vite-env.d.ts` gives types for CSS imports. Browser: light → white body, dark → `rgb(38,40,54)`,
  an unknown stored value → light, Inter applied, no console errors. Found while checking (same in
  Saleor): `--mu-colors-foreground-text-neutral-plain` doesn't exist in Macaw 3.1.0, so the body
  color rule does nothing; this Chrome profile clamps the 8.125px root font size to 9px.

#### M0.3.3 i18n
- **Concepts:** message descriptors (`id`, `defaultMessage`, `description`); `IntlProvider` and
  `useIntl().formatMessage`; Saleor's ids are formatjs's default content hash
  (`base64(sha512("defaultMessage#description")).slice(0, 6)`).
- **Acceptance:** text comes from a message; a broken message is reported through `onError`.
  (The planned "a missing id gives a warning" doesn't apply: with English only, react-intl renders
  `defaultMessage` and has no translation to miss.)
- **Result:** `react-intl` 12.1.6 (latest; Saleor pins 5.25.1, same API for what we use). Adapted
  `LocaleProvider` (English only: no locale JSON loading, localStorage or `LocaleContext`; same
  `onError` filter) and `src/intl.ts` with the 7 roadmap `sectionNames`, ids copied from Saleor.
  The hash formula reproduces all 7 ids (and two from `sidebarCollapseMessages.ts`), so new
  messages can get Saleor-style ids with no extra tool. Browser: "Home" rendered, console clean; a
  temporary `"Hello {name"` message logged `FORMAT_ERROR` through `onError` and rendered verbatim
  (then reverted).

#### M0.3.4 Router + layout
- **Concepts:** client-side routing (History API, `<Routes>` picks the best match, `*` splats);
  Saleor's two-column CSS grid layout with a sticky navigation cell.
- **Acceptance:** every planned URL renders its placeholder; `/` → `/home`; an unknown URL → NotFound.
- **Decided (owner, 2026-11-08):** React Router 7 instead of the planned 6. The latest, 8.x,
  requires React 19.2.7+, so 7 is the newest that works with React 18 (Saleor's version).
- **Result:** `react-router` 7.18.5 (v7 merged `react-router-dom` into it; first built on v6.30.6,
  where opting in to two v7 flags was needed to silence console warnings). Like Saleor, `AppLayout`
  wraps `<Routes>` (children, not a layout route with `<Outlet>`). Copied `AppLayout.module.css`; adapted
  `AppLayout` (empty navigation cell until M0.3.6), `NotFound` and `NotFoundPage`, with Saleor's
  `makeStyles` converted to a CSS module (`spacing(n)` = n × 0.8rem, `down("sm")` = max-width
  959.95px) and the 404 SVG shown in an `<img>` instead of `react-inlinesvg` (it has a fixed fill).
  `src/assets` excluded from Biome (copied SVG). Routes: `/home`, `/products/*`, `/categories/*`, `/orders/*`,
  `/customers/*`, `/configuration` (exact, like Saleor); no `/catalog` (a menu group in Saleor, not a
  page). Browser: all 10 probed paths correct, the back button goes to `/home`, browser Back
  returns to the 404; at 400px the grid is one column, the nav cell is static and borderless, and the 404
  page is one centered column with no horizontal scroll; console clean.
  Noted: Macaw 3.1.0's `ThemeProvider` renders its own `<main>`, so the page has a nested `<main>`
  (same in Saleor).

#### M0.3.5 Sidebar inventory
Source: `../saleor-dashboard/src/components/Sidebar/` (87 files, ~7,200 lines, incl. tests and stories).
Saleor has **three layouts** chosen by width (`useSidebarLayout.ts`): **column** ≥1024px (full
sidebar the viewer can collapse to icons), **rail** 768–1023px (icons only; the logo opens the full
menu in a drawer), **drawer** <768px (an app bar with a menu button). Steps M0.3.7–M0.3.8 follow that.

**Decided (owner, 2026-11-08; inventory approved):**
- Orders and Customers are flat items (Saleor's "Fulfillment" and Customers groups have no
  roadmap children; Saleor itself renders a childless section as an item, e.g. Translations).
- Theme switcher: the footer ⋯ menu, as in Saleor, with only Dark/Light Mode until M1 adds the
  avatar, name, Account Settings and Log out.
- Header avatar: Macaw `Avatar.Store` with the shop name's initials instead of Saleor's logo images.
- Port Saleor's unit tests for the logic we copy (Vitest + jsdom in the dashboard, from M0.3.6).

| Step | Saleor files | Treatment |
|---|---|---|
| M0.3.6 | `Sidebar.module.css`, `SidebarIconSlot.tsx`, `menu/{Item,SingleItem,SubmenuItems,MenuItemLabel,types}.ts(x)`, `menu/hooks/useIsMenuActive.ts`, `src/icons/{Home,Products,Orders,Customers,Configuration}.tsx` + `createNavigationLucideIcon`, the nav part of `components/icons`, `src/hooks/useLocalStorage.ts` | copy (`react-router-dom` → `react-router`) |
| M0.3.6 | `SidebarContext.tsx` | adapt: unchanged API; uses our ported `useLocalStorage` |
| M0.3.6 | `Sidebar.tsx` | adapt: column layout only; no ripples modal, search hotkey or analytics |
| M0.3.6 | `Content.tsx`, `MountingPoint.tsx` (+css) | adapt: no deprecation banner or cloud environment switcher; initials avatar; title = "Dashboard" until M0.3.10 puts `shop.name` there |
| M0.3.6 | `menu/ItemGroup.tsx`, `menu/Menu.tsx`, `menu/utils.ts` | adapt: no shortcuts/feedback in the menu; `utils` keeps `isMenuActive` (+ rail helpers in M0.3.7), no extension helpers |
| M0.3.6 | `menu/hooks/useMenuStructure.tsx` | adapt: only Home, Catalog→Products/Categories, Orders, Customers, Configuration; the permission filter returns with users (M1.2) |
| M0.3.6 | `menu/utils.test.ts` (`isMenuActive` cases) | port |
| M0.3.7 | `SidebarCollapseToggle.tsx` (+css), `useSidebarCollapseToggle.ts`, `sidebarCollapseMessages.ts`, `sidebarDrawerTriggerMessages.ts` | adapt: no analytics or ripple |
| M0.3.7 | `menu/{RailMenuItem,RailItem,RailGroup,RailTooltipGroup,useLabelTooltip,useTooltipSuppression}` (+css) | copy/adapt |
| M0.3.7 | `followSidebarLink.ts` (+test) | adapt: `history` → React Router 7 `navigate`; no app mount URI |
| M0.3.7 | `react-hotkeys-hook` for Mod+B | **decided:** a small keydown listener instead (owner, 2026-11-08) |
| M0.3.8 | `useSidebarLayout.ts`, `SidebarDrawer.tsx` (+css), `useDrawerSwipe.ts`, `drawerSwipe.ts` (+tests) | copy |
| M0.3.8 | `SidebarAppBar.tsx` (+css) | adapt: no search button |
| M0.3.9 | `user/Info.tsx`, `user/Controls.tsx` (+css), `user/ThemeSwitcher.tsx`, `src/theme/hook.tsx` | adapt: ⋯ menu with Dark/Light Mode only; keeps Saleor's cross-tab `storage` sync, minus the legacy theme |
| — | `DeprecationBanner/*` | omit: Saleor version-deprecation notice |
| — | `ripples/*`, `shortcuts/*`, `ShotcutsItems.tsx` | omit: Saleor "what's new" ripples, search, GraphQL playground / dev mode |
| — | `user/FeatureFlagsModal/*`, `user/useFeedbackSurvey.ts`, `menu/hooks/useEnvLink.ts` | omit: Saleor feature flags, PostHog survey, "Go to Saleor Cloud" |
| — | `menu/{createCustomerTypeMenuItems,hooks/useCustomerTypeMenuItems}.ts`, `menu/{Divider,SubmenuSeparator,settingsSubmenuItem}` | omit: customer types, extension dividers and settings sub-items aren't on the roadmap |
| — | `useSidebarLogo.ts` | omit: replaced by initials |
| — | `*.stories.tsx`, `Sidebar.test.tsx` | omit: no Storybook; the big integration test leans on omitted parts (rewrite later if needed) |

#### M0.3.6 Sidebar: full column
- **Concepts:** menu as data (`SidebarMenuItem[]` from `useMenuStructure`) rendered by
  `MenuItem` → `SingleItem` / `ItemGroup`; active state = `matchPath` on the current URL
  (`aria-current="page"`); Macaw `List.ItemGroup` for the expandable group.
- **Acceptance:** at desktop width the sidebar shows the five sections with Saleor's icons and
  labels; the current page is highlighted; Catalog expands to Products/Categories.
- **Result:** files and treatment as in the M0.3.5 table. `Sidebar` renders only the column
  layout, at every width until M0.3.8. The header title is "Dashboard" (Saleor's
  `commonMessages.dashboard`) with "D" initials until M0.3.10. `isMenuActive` uses React Router 7's `matchPath({ path, end })`.
  Added to `index.css`: Saleor's `hide-scrollbar` and `ellipsis` utilities, plus the parts of MUI's
  `CssBaseline` (body margin 0, border-box, font smoothing) that Saleor gets from the legacy theme. Without them
  an 8px body margin showed. `clsx` replaced by a template string (no new dependency). Vitest 5.1.0 in
  the dashboard (`pnpm --filter @commerce/dashboard test`): 9 ported `isMenuActive` cases + 2 ours
  (segment boundary, trailing slash) pass; forcing exact matching fails the sub-route case.
  Browser: 260px column; Home current on `/home`; Catalog click → `/products/`, group expanded, Products
  current; Categories, Orders, Configuration current on their pages; `/products/42` → Products;
  NotFound → none; dark theme OK; Tab reaches Home → Catalog → the group's expand button (Macaw focus
  style), Enter toggles it; console clean.

#### M0.3.7 Sidebar: collapse to the rail
- **Concepts:** one boolean preference in localStorage (`dashboard-sidebar-collapsed`) drives
  two renderings of the same menu data (`MenuItem` vs `RailMenuItem`); groups become a Macaw
  `Popover` flyout; Radix tooltips with a shared "warm" delay; focus hand-off between toggles.
- **Acceptance:** the header button and Mod+B collapse/expand; the choice survives a reload;
  rail icons show tooltips; Catalog opens a flyout whose links navigate and close it.
- **Result:** as in the M0.3.5 table, plus two small pieces from `shortcuts/` that the toggle's
  tooltip uses (`KeyboardShortcut` key-cap, `getShortcutLeadingKey`). The rail's drawer trigger
  and `sidebarDrawerTriggerMessages` move to M0.3.8, where the rail layout needs them.
  Mod+B is a ~20-line keydown listener in `Sidebar.tsx` (⌘ on macOS, Ctrl elsewhere; ignored in
  inputs, like `react-hotkeys-hook`). `followSidebarLink(event, navigate, location)` replaces v5's
  `history`; its `navigate` parameter is typed as the one call it makes, because a Vitest mock can't
  satisfy React Router's overloaded `NavigateFunction`. jsdom 31.0.0 added for that test (per-file
  `@vitest-environment`).
  Tests: 22/22 (ported `followSidebarLink`, `shouldLinkGroupInFlyout`, `getRailFlyoutChildren` +
  earlier); forcing `replace: false` fails the "current page" case. Browser: collapse → 60px, page
  starts at x=61, choice stored and kept after reload; Catalog flyout lists "Catalog" as an unlinked
  heading (Products opens that page) + Products/Categories; Categories navigates, the flyout closes, the
  Catalog icon stays active; Orders tooltip on hover; ⌘B expands with the Catalog group open on
  Categories; Enter on collapse → focus moves to "Expand navigation", and back; console clean.

#### M0.3.8 Sidebar: rail and drawer layouts
- **Concepts:** `useSyncExternalStore` over `matchMedia` picks one layout (`column` ≥1024px,
  `rail` 768–1023px, `drawer` <768px) and renders only that one; Macaw `Drawer` (Radix Dialog)
  remounted with a new `key` to close it from code; a pointer-event swipe that moves the panel
  through its style without re-rendering.
- **Acceptance:** each width shows its layout; the rail avatar and the app-bar menu button open
  the full menu as a drawer; following a link, the close button, or a left swipe closes it.
- **Decided (owner, 2026-11-08):** add `@testing-library/react` (16.3.3, + its peer
  `@testing-library/dom` 10.4.2) to port Saleor's `useDrawerSwipe` hook test with `renderHook`.
- **Result:** as in the M0.3.5 table, plus `useSidebarBrand` (ours; Saleor's `useSidebarLogo` role):
  title + initials shared by the header, rail and app bar. The rail's `SidebarDrawerOpenButton` and
  `sidebarDrawerTriggerMessages` (moved from M0.3.7) added. Two Biome fixes in copied code:
  `forEach` → `for…of` in `useSidebarLayout` (callback returned a value) and an optional chain in
  `useDrawerSwipe`. Tests 39/39 (ported `drawerSwipe` + `useDrawerSwipe`); setting the dismiss
  ratio to 0.9 fails one case in each file. Browser (900px and 400px iframes in a 1440px page, since
  the window could not be resized): 900 → 60px rail with "Open navigation"; 400 → 56px app bar "D
  Dashboard" + "Open navigation"; both open a 260px drawer over a dimmed page, Orders current,
  close button labelled "Close navigation"; clicking Customers navigates and closes (both); the close
  button closes; a scripted touch swipe of 150px left slides it out (−260px) and closes; 1440 still
  shows the column with its collapse button; console clean.

#### M0.3.9 Footer ⋯ menu + theme switcher; keyboard pass
- **Concepts:** Macaw `Dropdown` (Radix DropdownMenu: roving focus, Escape, focus return);
  the theme lives in Macaw's provider state and is mirrored to localStorage; a `storage` event
  keeps other tabs in sync.
- **Acceptance:** the ⋯ menu (column and rail) switches light/dark; the choice survives a reload;
  the sidebar is usable with the keyboard only.
- **Result:** `src/theme/hook.tsx`, `user/{Info,Controls,ThemeSwitcher}` (+css), `savebarHeight`
  adapted as in the M0.3.5 table. `useThemeHandler` is Saleor's `useLegacyThemeHandler` without
  the legacy theme. Without a user (M1) the footer keeps the empty name slot, and the rail
  trigger shows the ⋯ icon where Saleor shows the avatar. Browser: ⋯ → "Dark Mode" → dark,
  `activeMacawUITheme=defaultDark`, kept after reload; a `storage` event from "another tab" switches
  back; rail "Account menu" opens the menu to the right of the 60px rail with "Light Mode". Keyboard:
  Tab order Collapse → Home → Catalog → (Catalog expand) → Orders → Customers → Configuration → ⋯;
  Enter/Space opens the menu with focus on the item, Enter switches the theme, Escape closes and focus
  returns to ⋯; ⌘B collapses; console clean.
  **Found (same in Saleor):** two buttons have no accessible name: Catalog's expand chevron
  (Macaw `List.ItemGroup.Trigger`) and the expanded footer ⋯ (only the rail one has
  "Account menu").
  **Decided (owner, 2026-11-08): label both, a deliberate difference from Saleor.** The expanded ⋯
  reuses Saleor's "Account menu" message; the chevron gets a new message "{section} submenu"
  (`jvlQkk`), set through the DOM (Macaw takes no props for it), as Saleor's `SidebarDrawer`
  names Macaw's close button. Verified: "Catalog submenu" with `aria-expanded` false → true after a
  click; the label survives the re-render.

#### M0.3.10 Apollo + codegen + shop name
- **Concepts:** Apollo's normalized `InMemoryCache`; typed documents (`useQuery(ShopInfoDocument)`
  infers data and variables types from the generated document); the printed SDL as the contract
  between API and dashboard; a CORS preflight and the CSRF header.
- **Acceptance:** the sidebar header shows `shop.name` from the API; `pnpm codegen` regenerates the
  types and is cached until the schema or a query changes.
- **Decided (owner, 2026-11-08):** the dashboard calls the API cross-origin (`VITE_API_URL`,
  default `http://localhost:4000/graphql`), like Saleor's `API_URL`, rather than through a Vite proxy.
- **Result:** `@apollo/client` 3.14.1 (ADR-0007: Apollo 3; latest 3.x), `graphql` 16.15.0 in the dashboard
  (Apollo 3 accepts graphql 15/16; the API keeps 17), `@graphql-typed-document-node/core` 3.2.0 (the
  generated file's type import). Codegen CLI 8.0.0 + `typescript` 7.0.0 + `typescript-operations` 7.0.0 +
  `typed-document-node` 8.0.0, with Saleor's type settings, plus `useTypeImports` for
  `verbatimModuleSyntax`. Saleor generates hooks (`typescript-react-apollo`); we generate typed
  documents, per ADR-0007. Adapted `graphql/client.ts` (HttpLink with `credentials: "include"` and the
  `x-graphql-yoga-csrf` header; no auth, upload or schema-lock links), `components/Shop` (`ShopProvider`
  without the auth skip or analytics, plus `useShop`), `ShopInfo` limited to `name`. `useSidebarBrand` now uses
  the shop name, falling back to "Dashboard". Turborepo `codegen` task with `apps/api/schema.graphql`
  as an input. `*.generated.ts` excluded from Biome. Verified: generated `ShopInfoQuery` /
  `ShopInfoDocument`; second run FULL TURBO and byte-identical; touching `schema.graphql` → cache miss,
  restoring it → cache hit; typecheck, lint, 39 tests, build pass; browser: one POST to :4000 → 200,
  header "H · Hantesi-Mongolia" (initials split on spaces only), console clean. Not verified: the
  "Dashboard" fallback with the API down.
  **For M1:** Yoga's default CORS reflects any origin with credentials allowed. Before session cookies,
  restrict it to the dashboard and storefront origins.

#### M0.3.11 Side-by-side comparison with real Saleor
- **Setup:** Saleor API 3.23 from `../saleor-platform` (Docker, :8000) and Saleor Dashboard 3.23.42 from
  `../saleor-dashboard` source (`npm run dev`, Node 24, :9000; a dev build, same layout as the image);
  ours via `pnpm dev` (:4000, :5173). Both apps in one Chrome tab, so the viewport is identical; the
  theme and collapsed state set through the same localStorage keys (`activeMacawUITheme`,
  `dashboard-sidebar-collapsed`). Widths 900 and 390 rendered in a same-origin iframe of that width
  (the window could not be resized), so the apps' media queries see exactly that width.
- **Screenshots:** `docs/screenshots/m0.3/`, pairs `*-saleor` / `*-ours`: desktop 1440 dark and light,
  expanded and collapsed (01–04); rail at 900 (05); mobile app bar at 390 (06); mobile drawer open,
  dark (07); keyboard navigation (08).
- **Matches:** column and rail widths (rail 61px), header row, item height and spacing, icons, active
  item, chevrons and `aria-expanded`, footer divider, rail breakpoint (768–1023) and drawer (<768),
  app bar, drawer header and close button, light and dark colours. Rail border measured identical
  (1px `rgb(43, 64, 84)` on `rgb(34, 36, 48)`). Keyboard: Tab order matches Saleor's (hidden mobile
  menu button first, then items); Tab → Catalog, Enter expands, Tab → Products, Enter opens
  `/products/`; focus ring visible.
- **Differences, all expected:** initials instead of Saleor's logo (M0.3.5); roadmap-only menu, so
  no Search, Fulfillment, Discounts, Modeling, Translations, Extensions, Command menu, Playground,
  What's New (decided 2026-11-06); no account row or notifications in the footer, and no app-bar
  search (login is M1); placeholder pages instead of Saleor's content (M2+).
- **Finding (open, for approval):** in dark mode Saleor's root text colour is white, ours is the
  browser's black. It comes from Saleor's legacy Macaw (Material UI) `ThemeProvider` CSS baseline
  (`../saleor-dashboard/src/index.tsx:135`), which we do not use. Not visible today (all text sets its
  own colour), but unstyled text would render black on dark. Proposed fix: set the root text colour
  to Macaw's `text.default1` in `apps/dashboard/src/index.css`.

---

## M1 — Identity

### M1.1 Users, sessions, login/logout/me
- **Objective:** staff can log in to the dashboard; sessions are revocable.
- **Scope:** `user`, `session` tables; argon2id; `login`, `logout`, `me`; cookie handling;
  `pnpm cli createsuperuser`; dashboard login page (adapted from `src/auth/components/LoginPage`),
  auth context, logout in sidebar user menu.
- **Concepts:** password hashing; session vs JWT (ADR-0006); cookies (HttpOnly/SameSite/Secure);
  CSRF.
- **Decided (owner, 2026-11-09):** login is Saleor's `tokenCreate` (creates a session and sets the
  cookie instead of issuing a JWT); `logout` is added (Saleor has no server-side logout), listed in
  ARCHITECTURE §4's deviations table.
- **Acceptance:** integration tests for wrong password, inactive user, expired session, logout
  revocation; manual dashboard login/logout.
- **Exclusions:** password reset (needs email, M8), customer login (M7).
- **Status:** Approved (2026-11-09). Run continuously: each sub-step delegated, verified and
  reported before the next; stop only for a failure or an owner decision.

| Step | What | Status |
|---|---|---|
| M1.1.1 | `user` table + migration; argon2id hash/verify module + unit tests | Done |
| M1.1.2 | `pnpm cli createsuperuser` (interactive, hashes the password) | Approved |
| M1.1.3 | `session` table; session service: create (256-bit token, SHA-256 stored), look up with sliding 14-day expiry + hard cap, revoke; real-Postgres tests | Approved |
| M1.1.4 | Request context: cookie or `Authorization: Bearer` → `ctx.user`; CORS restricted to the dashboard origin with credentials (the M0.3.10 to-do) | Approved |
| M1.1.5 | GraphQL login/logout/`me` (name per decision) + contract tests: wrong password, inactive user, expired session, logout revocation, uniform error | Approved |
| M1.1.6 | Dashboard: auth provider (`me`), login page adapted from Saleor's `src/auth/components/LoginPage`, redirect to login when signed out | Approved |
| M1.1.7 | Dashboard: Saleor's account row in the sidebar footer, logout in the user menu; browser check of login/logout | Approved |

- **Result (M1.1.1):** `user` table (`packages/db/src/schema/identity.ts`) exactly as ARCHITECTURE §3:
  UUID v7 id, `citext` email with `user_email_unique`, nullable `password_hash`, CHECKs
  `user_email_not_empty` and `user_superuser_is_staff`. Migrations `0002_citext_extension` (custom,
  `CREATE EXTENSION citext`) then `0003_user` (generated). `identity/password.ts`: argon2id via
  `@node-rs/argon2` 2.2.2 (prebuilt binaries, no install script) with OWASP parameters (m=19456,
  t=2, p=1); `verifyPassword` never throws and rejects non-argon2id hashes (security review).
  Tests: 14 API tests incl. case-insensitive email uniqueness, UUID v7 shape, constraint names, an
  argon2i hash rejected, OWASP parameters pinned. Reviews: code (approve), security (3 low).
  **Carried into M1.1.5:** dummy verify for unknown users / users without a password (timing must
  not reveal which emails exist) and a password length cap at the GraphQL input (security review).

### M1.2 Permission groups & guards
- **Objective:** staff permissions enforced by API, reflected in dashboard UX.
- **Scope:** permission tables + enum; `requirePermission`; staff/group management minimal API
  (`permissionGroupCreate/Update`, `staffCreate`) — dashboard UI for it deferred or minimal (decide);
  route guard + not-allowed page; sidebar filtering.
- **Concepts:** authn vs authz; union of group permissions; defense in depth (UI hides, API enforces).
- **Decided (owner, 2026-11-09):** Staff Members and Permission Groups dashboard pages come later,
  in the admin phase; M1.2 is API-only for staff management.
- **Acceptance:** contract tests for every guarded field returning permission error; dashboard
  shows not-allowed page for a user lacking `MANAGE_PRODUCTS`.
- **Status:** Approved (2026-11-09), run continuously like M1.1.

| Step | What | Status |
|---|---|---|
| M1.2.1 | Permission enum (ARCHITECTURE §8) + `permission_group`, group↔permission, user↔group tables; effective permissions = union (superuser = all) + tests | Approved |
| M1.2.2 | `requirePermission(ctx, …)`; `me { userPermissions }`; contract-test pattern for guarded fields | Approved |
| M1.2.3 | Minimal staff API: `permissionGroupCreate/Update`, `staffCreate`, each guarded by `MANAGE_STAFF` + tests | Approved |
| M1.2.4 | Dashboard: sidebar items filtered by permission, route guard + Saleor's not-allowed page | Approved |

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

---

## P0 decisions (resolved)

1. **Decided: ADR-0001…0010 all Accepted** (2026-11-06).
2. **Decided: PostgreSQL 18** (2026-11-06) — native `uuidv7()`; matches local psql 18.
3. **Decided: Biome** (2026-11-06).
4. **Decided: roadmap-only sidebar items** (2026-11-06).
5. **Decided: Saleor names except where ours is clearer** (2026-11-06). Every deviation is
   listed in ARCHITECTURE §4 "Naming deviations from Saleor" with its reason.
