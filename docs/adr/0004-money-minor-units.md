# ADR-0004: Money = integer minor units + ISO 4217 currency

Status: Superseded by ADR-0013 (2026-11-06). Replaced before any money code was committed.

## Context
Saleor stores `Decimal(12,3)` amounts with a separate `currency` column and uses the `prices`
library (`Money`, `TaxedMoney`); JavaScript has no native decimal type and floats are unsafe.

## Decision
Store `<name>_amount bigint` (minor units, e.g. cents) next to a `currency char(3)` column on every
monetary row. In TS, a tiny `Money { amount: bigint; currency }` value module with add/multiply and
a currency-mismatch guard. GraphQL exposes Saleor's shape `Money { amount: Float!, currency: String! }`
for output; inputs take a `PositiveDecimal` string scalar converted exactly to minor units.

## Alternatives
- **NUMERIC + decimal.js**: mirrors Saleor exactly; adds a decimal library on every path.
- **Floats**: rejected (rounding errors).

## Consequences
- + Exact arithmetic with native bigint; storing currency per row keeps multi-currency possible later.
- − Currency exponent table needed (2 for USD/EUR, 0 for JPY). Only our single currency initially.
- − Float output is for display only; clients must never compute totals from it (server computes).
