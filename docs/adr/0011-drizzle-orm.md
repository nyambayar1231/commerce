# ADR-0011: Database access = Drizzle ORM + drizzle-kit generated SQL migrations

Status: Accepted (2026-11-06). Supersedes ADR-0003.

## Context
ADR-0003 chose Kysely + hand-written SQL migrations. Before any database code was committed,
the owner chose Drizzle instead: it is already familiar, and learning Kysely would cost time
that should go into the commerce domain. ADR-0003's underlying requirements still hold:
invariants enforced by PostgreSQL constraints, explicit transactions and row locks
(`SELECT … FOR UPDATE`), and SQL that a reviewer can actually see.

## Decision
- `drizzle-orm` with the **postgres.js** driver (3.4.x; same as the owner's dino-publishing
  project), `drizzle-kit` for migrations.
- Everything database-related lives in **`packages/db` (`@commerce/db`)**: client, schema files,
  migrations. Apps import its TypeScript source directly (no build step).
- Client API: lazy `getDb()`, `closeDb()`, and the types `Db`, `Tx`, `Executor = Db | Tx`.
  Domain functions take an `Executor`; functions that must run inside a transaction take `Tx`
  (`Db` is not assignable to `Tx`, so this is checked by the compiler).
- **Schema in TypeScript** (`pgTable(...)`), including `check()`, `unique()` and indexes. The
  TS schema is the source of truth for table shapes and query types; no separate codegen step.
- **Migrations are generated SQL files that we commit and review.** `drizzle-kit generate`
  writes them; reviewing the generated SQL is part of every schema change. Anything the schema
  DSL can't express (seed rows, special constraints) goes in a custom SQL migration
  (`drizzle-kit generate --custom`). Never `drizzle-kit push` against a shared database.
- **Query style:** Drizzle's SQL-like builder (`db.select().from(...)`) by default. The relational
  API (`db.query.x.findMany({ with })`) is fine for simple nested reads. Locks via `.for("update")`,
  and the `sql` template when raw SQL is clearer.
- Money columns use `bigint(..., { mode: "bigint" })`, so values arrive as JS `bigint` (ADR-0004).
- Pin the stable 0.x line; Drizzle 1.0 is in beta at the time of writing.

## Alternatives
- **Kysely (ADR-0003)**: SQL stays the schema's source of truth and types are generated from the
  live DB; rejected because the owner would have to learn it.
- **Plain `pg`**: no abstraction, but untyped results and string-assembled dynamic queries
  (filters, sort, cursors), which are risky in M2.3's list filtering.

## Consequences
- + Familiar API; types come directly from the schema; `bigint` mode removes the custom type parser.
- + Migrations remain plain SQL files under review, so constraints and indexes stay visible.
- − Two representations of the schema to keep in mind (TS definition + generated SQL); a reviewer
  must read the generated SQL, not just the TS diff.
- − drizzle-kit's diffing has to guess renames (it asks interactively); a wrong answer can
  generate DROP + ADD instead of RENAME. Always read the generated migration.
- − A future upgrade to Drizzle 1.0 is a contained but real task.
