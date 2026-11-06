# ADR-0003: Database access = Kysely query builder + hand-written SQL migrations

Status: Superseded by ADR-0011 (2026-11-06). Accepted earlier the same day; replaced before any database code was committed.

## Context
Inventory and checkout correctness depend on explicit transactions, row locks
(`SELECT … FOR UPDATE`), CHECK constraints and unique indexes — Saleor relies on these too
(e.g. `stock_qs_select_for_update()` in `saleor/warehouse/lock_objects.py`, used by `saleor/warehouse/management.py`). The owner should see the SQL.

## Decision
PostgreSQL 18. Kysely for typed queries (types generated from the live DB with kysely-codegen).
Migrations are plain `.sql` files, forward-only, applied by a tiny runner that records them in a
`schema_migrations` table.

## Alternatives
- **Prisma**: great DX, but hides SQL, weak support for row locks/raw constraints, schema DSL is
  another language.
- **Drizzle**: good; schema-in-TS generates migrations. Generated migrations are one more layer
  between you and the DDL; acceptable alternative if you prefer TS schema definitions.
- **Raw `pg` only**: maximally transparent but untyped results.

## Consequences
- + SQL constraints carry the invariants; queries read like SQL; locks are explicit.
- − No ORM relations/lazy loading: joins and batching (DataLoader) are written by hand.
- − DB types must be regenerated after each migration (one command, checked in CI).
