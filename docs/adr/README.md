# Architecture Decision Records

Lightweight ADRs for decisions with long-term consequences. Format: Context → Decision →
Alternatives → Consequences. Status is one of: Proposed, Accepted, Superseded by ADR-XXXX.

| # | Title | Status |
|---|---|---|
| 0001 | TypeScript modular monolith | Accepted |
| 0002 | GraphQL: Yoga server + Pothos code-first schema | Accepted |
| 0003 | Database access: Kysely + hand-written SQL migrations | Superseded by 0011 |
| 0004 | Money as integer minor units + currency | Superseded by 0013 |
| 0005 | Single channel without a Channel table; single Warehouse table | Accepted |
| 0006 | Auth: opaque DB-backed sessions in HttpOnly cookies | Accepted |
| 0007 | Dashboard stack: Vite, React, Macaw UI, Glide, Apollo | Accepted |
| 0008 | Storefront: Next.js, Saleor Storefront used for patterns only | Accepted |
| 0009 | No background job system until a requirement needs it | Accepted |
| 0010 | Saleor-style API shape: Relay global IDs, connections, errors-as-data | Accepted |
| 0011 | Database access: Drizzle ORM + drizzle-kit generated SQL migrations | Accepted |
| 0012 | Shared domain contracts in `packages/contracts` | Accepted |
| 0013 | Money = integer `number` of minor units; MNT has 0 decimal places | Accepted |
