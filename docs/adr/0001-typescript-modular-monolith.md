# ADR-0001: TypeScript modular monolith

Status: Accepted (2026-11-06)

## Context
Saleor Core is a Django modular monolith (`saleor/product`, `saleor/checkout`, `saleor/order`,
`saleor/warehouse`, `saleor/account`, each with models + business logic, plus `saleor/graphql/*`
as the API layer). We want the same domain boundaries, but the owner must understand and modify
every line across backend, dashboard and storefront.

## Decision
One TypeScript (Node 22) API process structured as modules (`identity`, `catalog`, `inventory`,
`checkout`, `payments`, `orders`, `shop`). Modules expose a public `index.ts`; cross-module calls go
through it; a module owns its tables exclusively.

## Alternatives
- **Python/Django like Saleor**: closest to the reference, but adds a second toolchain and a
  second type system; GraphQL types can't be shared directly with the TS clients.
- **Microservices**: distributed transactions for checkout→order→stock would dominate the
  learning effort for no benefit at this scale.

## Consequences
- + One language, one type system, one test runner, Turborepo caches everything.
- + Checkout completion can be a single ACID transaction across modules.
- − Saleor's Python must be *translated*, not mirrored; citations point to concepts, not identical code.
- − Module boundaries are enforced by convention (and later a Biome `noRestrictedImports` rule), not by process isolation.
