# Brief: <short title>

<!-- Template for backend-implementer / dashboard-implementer. Copy to .ai/briefs/<name>.md and
     fill every section. Delete these comments. A worker gets nothing but this brief, AGENTS.md
     and CLAUDE.md, so write what it needs. -->

- **Role:** backend-implementer | dashboard-implementer
- **PLAN step:** <e.g. M1.1, approved by the owner on YYYY-MM-DD>
- **Working directory:** <../commerce-wt/<name> or repo root>

## Goal

<One or two sentences: the behaviour that must exist when you are done.>

## Allowed files

You may create or edit only these. Anything else: stop and report `blocked`.

- `<path>`: <what changes>
- `<path>` (new): <what it contains>

Generated files you may regenerate (never hand-edit): <e.g. apps/api/schema.graphql via
`pnpm schema:print`, a migration via `pnpm --filter @commerce/db db:generate --name <name>`>.

## Out of scope

- <things that look related but must not be done in this task>
- No new dependencies, abstractions or packages <unless named here>.

## Context to read first

- `ARCHITECTURE.md` §<n>: <why>
- `docs/adr/<file>`: <why>
- `<our file>:<lines>`: <the pattern to follow>
- Reference: `../saleor-core/<path>` or `../saleor-dashboard/src/<path>`: <what to match>

## Decisions already made

<Architecture choices the lead made, so the worker does not make them. E.g. table and column
names, GraphQL type and field names (Saleor's), error codes.>

## Acceptance criteria

- [ ] <observable behaviour 1>
- [ ] <test that proves it, including the failure path>
- [ ] `scripts/ai/verify.sh --quick` passes
- [ ] <`scripts/ai/verify.sh` passes (API tests), if applicable>

## Report

Write the report from AGENTS.md to `.ai/report.md`, with real command output. Then send the
`hc send` line you were given and stop.
