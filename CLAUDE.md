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
   deferred), update `PLAN.md` status, then **stop** and wait. Never start the next milestone
   automatically.
7. Report verification faithfully. Failing tests or skipped checks are stated as such.
8. Prefer small, explicit code over clever abstractions. Every abstraction must earn its place.

## AI team: Claude Code leads, OpenCode Go implements, Herdr runs the terminals

Claude Code is the orchestrator and architect; implementation is delegated to OpenCode workers
(`.opencode/agents/`) through `scripts/ai/spawn.sh`. For every development task follow
`docs/ai-workflow/orchestrator.md`; setup, roles and commands are in
`docs/ai-workflow/README.md`; worker rules are in `AGENTS.md`. In short:

- Investigate, then write a strictly scoped brief (one concept, explicit file list).
- One writer per working directory; parallel writers get separate worktrees
  (`scripts/ai/worktree.sh`) and disjoint files, otherwise run sequentially.
- Never accept a worker's summary: collect the real diff (`scripts/ai/collect.sh`), run the
  checks yourself (`scripts/ai/verify.sh`), and have the diff reviewed independently (OpenCode
  `code-reviewer` / `security-reviewer`, then the `opus-code-reviewer` /
  `opus-security-reviewer` subagents).
- Architecture decisions stay with the lead and the owner, never with a worker.
- Never commit, push or deploy; the owner lands changes.
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
pnpm db:up          # start Postgres 18 on localhost:5433 and wait until healthy
pnpm db:down        # stop it (data kept in the `postgres-data` volume)
pnpm db:psql        # psql shell inside the container
pnpm --filter @commerce/db db:ping                     # check the app can reach Postgres
pnpm --filter @commerce/db db:generate --name <name>    # migration from schema changes
pnpm --filter @commerce/db db:generate --custom --name <name>   # empty SQL migration (data)
pnpm --filter @commerce/db db:migrate                   # apply migrations (needs db:up)
pnpm --filter @commerce/api dev                         # API on :4000/graphql, watch mode
pnpm schema:print   # regenerate apps/api/schema.graphql (commit it)
```

AI team (details in `docs/ai-workflow/README.md`):

```
scripts/ai/doctor.sh                                  # verify tools, auth, models, agents
scripts/ai/start.sh                                   # open the Claude Code lead in Herdr
scripts/ai/worktree.sh add <name>                     # isolated worktree ../commerce-wt/<name>
scripts/ai/spawn.sh <role> <name> <brief.md>          # start an OpenCode worker with a brief
scripts/ai/status.sh                                  # workers and worktrees
scripts/ai/collect.sh <name>                          # evidence: real diff + worker report
scripts/ai/verify.sh [--quick] [--build] [--dir d]    # lint, typecheck, tests, drift
scripts/ai/stop.sh <name>|--all                       # end workers (worktrees kept)
```

Planned: `codegen` (M0.3).

## Current state

M0.1 and M0.2 done. Next: M0.3 (dashboard shell), awaiting owner approval. See `PLAN.md`.
