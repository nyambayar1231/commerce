# CLAUDE.md

Working agreement and repository conventions for agents (and humans) working in this repo.
Architecture lives in `ARCHITECTURE.md`; the roadmap and status live in `PLAN.md`;
long-lived decisions live in `docs/adr/`. Do not duplicate their content here.

## What this project is

A deliberately small, Saleor-inspired, headless commerce system built to be fully
understood by its owner. Correctness and inspectability beat feature count.

## Reference repositories (read-only — never modify)

| Path (sibling of this repo) | What it is | License | How we may use it |
|---|---|---|---|
| `../saleor-core` | Saleor API (Python/Django), shallow clone of 3.23 | BSD-3-Clause | Read & cite domain logic; translate, don't port wholesale |
| `../saleor-dashboard` | Saleor Dashboard (React, Macaw UI, Glide) | BSD-3-Clause | Adapt components closely; keep license notice on copied code |
| `../saleor-storefront` | Saleor Storefront (Next.js) | FSL-1.1 (Functional Source License) | Patterns only; write our own code (see ADR-0008) |
| `../saleor-platform` | docker-compose for running real Saleor | BSD-3-Clause | Run real Saleor side-by-side for UX comparison |

When explaining a pattern, cite the reference file path, e.g.
`../saleor-dashboard/src/components/Sidebar/Sidebar.tsx`.

### Copying code from Saleor Dashboard / Core

- Copied or closely adapted files must start with:
  ```
  // Adapted from saleor-dashboard: src/<path> (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
  // See THIRD_PARTY_LICENSES.md
  ```
- Keep `THIRD_PARTY_LICENSES.md` with the full BSD-3-Clause text of each source repo.
- Never copy code from `saleor-storefront`.

## Agent working agreement

1. Work only inside the milestone/step the owner has explicitly approved in `PLAN.md`.
2. Before each step: state briefly what will change.
3. After each step, report: what changed, files involved, how it works, decisions & trade-offs,
   how it was verified (actual commands + output summary).
4. Ask before: expanding scope, adding a new abstraction/package/dependency not named in the
   approved step, changing an accepted ADR, or deviating from the Saleor reference UI.
5. When reproducing Saleor Dashboard UI: inspect the actual reference implementation first and
   match it; any simplification must be explained and approved.
6. After a milestone/sub-milestone: summarize (built, internals, decisions, verification,
   deferred), then **stop** and wait. Never start the next milestone automatically.
   Keep `PLAN.md` lean: it holds only unfinished work. Mark a step Done in its table; when a
   milestone is finished, delete its section (git history keeps it) and carry anything still
   awaiting the owner's approval into "Open items from finished milestones".
7. Report verification faithfully. Failing tests or skipped checks are stated as such.
8. Prefer small, explicit code over clever abstractions. Every abstraction must earn its place.

## AI workflow: Claude Code leads and reviews, one OpenCode implementer writes the code

Claude Code is the lead and reviewer; all commerce code is written by the single OpenCode Go
implementer (`.opencode/agents/implementer.md`, DeepSeek V4.1 Flash) started with
`scripts/ai/spawn.sh`. For every development task follow `docs/ai-workflow/orchestrator.md`; setup
and commands are in `docs/ai-workflow/README.md`; the implementer's rules are in `AGENTS.md`.
In short:

- Investigate briefly, then write a strictly scoped brief (one concept, explicit file list).
- Never accept the worker's summary: collect the real diff (`scripts/ai/collect.sh`) and run the
  checks yourself (`scripts/ai/verify.sh`).
- Review the diff lightly on Opus: correctness, security, scope. Skip nitpicks. No reviewer agents.
- Architecture decisions stay with the lead and the owner, never with the worker.
- One implementer per working directory; use a worktree (`scripts/ai/worktree.sh`) for isolation.
- Be token-efficient on both sides: OpenCode Go has a limited balance (it ran out on 2026-11-09);
  limits are not increased when they run out. While OpenCode is out of funds, Claude Code writes
  the code itself (same brief, checks and commits; `orchestrator.md` step 3 fallback).
- Phase order: API → Admin dashboard (matching Saleor, wired to the real API) → QA →
  Storefront. Storefront work starts only after the owner explicitly confirms API and Admin are
  complete.

## Repository conventions

- Package manager: `pnpm` workspaces; task runner: Turborepo.
- Language: TypeScript (strict) everywhere. Node 22 LTS.
- Layout: `apps/api`, `apps/dashboard`, `apps/storefront`, `packages/*` (only when shared code
  actually exists).
- Backend modules: `apps/api/src/modules/<module>/`; other modules import only from a module's
  `index.ts`. A module never writes another module's tables.
- Database: `packages/db` (`@commerce/db`), Drizzle ORM + postgres.js (ADR-0011). Domain
  functions take an `Executor` (`Db | Tx`) parameter; never call `getDb()` inside them. Table definitions in TS; migrations are SQL files generated
  by `drizzle-kit generate`, committed, and **read in review**. Forward-only; never edit an
  applied migration; never `drizzle-kit push`.
- GraphQL schema is code-first in the API and printed to `apps/api/schema.graphql` (committed);
  clients generate types from that file.
- Money: use `@commerce/contracts` (`mnt`, `addMoney`, `parseDecimal`…), never ad-hoc math.
  `amountMinor` is a safe integer; MNT has 0 decimal places (ADR-0013). Code shared by more
  than one app goes in `packages/contracts` only if it is dependency-free (ADR-0012).
- Lint + format: Biome, one root `biome.json` (2 spaces, double quotes, width 100). Markdown is
  excluded: Biome's Markdown formatter rewrites prose (e.g. `+`/`−` bullets in ADRs).
- TypeScript 6.0 (last JS-based compiler; 7.x Go port deferred until our tools support it).
  Shared configs in `packages/tsconfig` (`base`, `node`, `react`).
- Dependencies are pinned to exact versions (`pnpm add --save-exact`).
- Generated, committed files — never edit by hand: `apps/api/schema.graphql` (`pnpm schema:print`),
  `apps/dashboard/src/graphql/*.generated.ts` (`pnpm codegen`),
  `packages/db/drizzle/**` (drizzle-kit; custom migrations are written inside the generated file).
- GraphQL naming: Saleor's names by default; any deviation goes in ARCHITECTURE §4's
  deviations table with its reason.
- Tests: Vitest. API tests run against a real PostgreSQL (no DB mocks for domain logic).
- Naming: files `camelCase.ts` for modules/hooks, `PascalCase.tsx` for React components
  (matches Saleor Dashboard).

## Commands

Requires Node 22 (`.nvmrc`), pnpm 11 (`packageManager`), Docker.

```
pnpm install
pnpm dev            # turbo: dev task of every app
pnpm typecheck      # turbo: tsc --noEmit per app (cached)
pnpm lint           # biome check . (lint + format check + import order)
pnpm format         # biome format --write .
pnpm test           # turbo: unit tests + API tests on commerce_test (needs `pnpm db:up`)
pnpm db:up          # start Postgres 18 (localhost:5433), the S3 server (localhost:8333) and Mailpit (SMTP localhost:1026, UI localhost:8026), wait until healthy
pnpm db:down        # stop it (data kept in the `postgres-data` volume)
pnpm db:psql        # psql shell inside the container
pnpm --filter @commerce/db db:ping                     # check the app can reach Postgres
pnpm --filter @commerce/db db:generate --name <name>    # migration from schema changes
pnpm --filter @commerce/db db:generate --custom --name <name>   # empty SQL migration (data)
pnpm --filter @commerce/db db:migrate                   # apply migrations (needs db:up)
pnpm --filter @commerce/api dev                         # API on :4000/graphql, watch mode
pnpm --filter @commerce/api worker                      # background jobs: sends the emails (needs EMAIL_URL, SECRET_KEY)
pnpm schema:print   # regenerate apps/api/schema.graphql (commit it)
pnpm codegen        # regenerate dashboard GraphQL types from schema.graphql (commit them)
```

AI workflow (details in `docs/ai-workflow/README.md`):

```
scripts/ai/doctor.sh [--live]                         # verify tools, auth, model, the agent
scripts/ai/start.sh                                   # open the Claude Code lead in Herdr
scripts/ai/worktree.sh add <name>                     # isolated worktree ../commerce-wt/<name>
scripts/ai/spawn.sh <name> <brief.md>                 # start the implementer with a brief
scripts/ai/status.sh                                  # workers and worktrees
scripts/ai/collect.sh <name>                          # evidence: real diff + worker report
scripts/ai/verify.sh [--quick] [--build] [--dir d]    # lint, typecheck, tests, drift
scripts/ai/stop.sh <name>|--all                       # end the implementer (worktrees kept)
```

## Current state

M0 (foundations), M1 (identity), M2 (catalog: categories, products, variants, filtering, media), M3 (inventory: warehouse, stock, stock editing), M5 (checkout API: cart, shipping, addresses, dummy payments, completion into orders) and M6 (orders: list, detail page, fulfil, cancel, mark as paid, refund), M7 (customer accounts: register, customer orders and checkouts, staff customer API and pages) and M8 (background jobs: pg-boss outbox, worker, order and account confirmation emails) done; next is M9 (hardening & deployability, Draft — awaiting the owner's approval).
The AI team setup (`docs/ai-workflow/`) is in place. See `PLAN.md`.
