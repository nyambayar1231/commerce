# ADR-0013: Money = integer `number` of minor units; MNT has 0 decimal places

Status: Accepted (2026-11-06). Supersedes ADR-0004.

## Context
ADR-0004 chose `bigint` minor units with ISO 4217 exponents (MNT = 2, the unused möngö). Two
facts changed the trade-off before any money code was committed:
1. The shop (Hantesi-Mongolia) prices in whole tögrög; möngö are not used in practice.
2. Money became a shared contract (ADR-0012) crossing JSON, GraphQL and React props, where
   `bigint` cannot be serialized (`JSON.stringify(1n)` throws).

## Decision
- `Money = { amountMinor: number; currency: CurrencyCode }`, defined in `@commerce/contracts`.
- `amountMinor` is always a **safe integer**: every constructor and operation checks
  `Number.isSafeInteger`, so precision loss throws instead of happening silently.
- `CURRENCIES` lists exponents explicitly; today only `MNT: { exponent: 0 }` (1 minor unit =
  1 tögrög). The currency stays on every value and every money column, so adding a currency is
  a table entry plus data, not a redesign.
- Database: money columns are Postgres `bigint` (int4 tops out at ~2.1 billion), read through
  Drizzle with `{ mode: "number" }`.
- Parsing input is exact and never rounds (`"15000.5"` is rejected for MNT).
- GraphQL output keeps Saleor's `Money { amount: Float!, currency: String! }`; with exponent 0
  `amount` equals `amountMinor`.

## Alternatives
- **bigint (ADR-0004):** unlimited range, but needs conversion at every JSON boundary.
- **MNT exponent 2 (ISO):** standard-conformant, but every amount ×100 and decimals the UI must hide.
- **Decimal strings / decimal.js:** exact, but arithmetic needs a library everywhere.

## Consequences
- + Plain numbers everywhere; no serialization adapters.
- + Safe-integer range (~9×10¹⁵ tögrög) far exceeds any realistic amount.
- − A payment provider that expects 2-decimal MNT minor units needs a ×100 conversion in its
  adapter.
- − Adding a currency with an exponent > 0 needs care in display and input (already supported by
  `parseDecimal`/`formatDecimal`).
