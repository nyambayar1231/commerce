# ADR-0012: Shared domain contracts in `packages/contracts`

Status: Accepted (2026-11-06)

## Context
Some domain rules must behave identically in the API, the dashboard and the storefront:
money arithmetic and parsing first, later things like validation rules for addresses or
order-status labels. Copying them per app invites drift (e.g. the dashboard rounding a price
the API would reject). The owner's dino-publishing project solves this with
`packages/contracts`.

## Decision
- A workspace package `@commerce/contracts` holds domain contracts shared by more than one app.
- It is **plain TypeScript with no runtime dependencies and no Node or browser APIs**, so it runs
  unchanged in the API (Node), the dashboard (Vite) and the storefront (Next.js, server and client).
- Apps import its TypeScript source directly (`exports` → `src/index.ts`), like `@commerce/db`.
- Each contract ships with its unit tests in the package (`vitest run`).
- First contract: `money.ts` (ADR-0013).
- Admission rule: something goes into contracts only when a second app needs it, or when it
  defines a value that crosses the API boundary (like `Money`). App-specific code stays in the app.

## Alternatives
- **Money inside `apps/api`** (first M0.2.6 draft): fine until the dashboard parses a price input
  and has to re-implement the same rules.
- **Generated types only (GraphQL codegen):** gives shapes but not behaviour (parsing, arithmetic).

## Consequences
- + One implementation and one test suite for rules every app must agree on.
- − Another package to keep dependency-free; a contract can't use zod, Node or DOM APIs unless
  this ADR is revisited.
- − The dashboard/storefront bundlers must accept `.ts` imports from a workspace package
  (verified when those apps are set up in M0.3/M4).
