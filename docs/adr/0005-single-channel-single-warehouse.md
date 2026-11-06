# ADR-0005: No Channel table now; a real (single-row) Warehouse table

Status: Accepted (2026-11-06)

## Context
Saleor puts price/visibility on `ProductVariantChannelListing`/`ProductChannelListing` per
`Channel` (`saleor/channel/models.py`, `saleor/product/models.py`) and stock on
`Stock(warehouse, product_variant)` (`saleor/warehouse/models.py`). We need one channel and one
warehouse but should not paint ourselves into a corner.

## Decision
- **Channel**: not modelled. Shop settings hold the single currency; price and `isPublished` live
  on variant/product. Every money column carries `currency`, and checkout/order snapshot the currency.
- **Warehouse**: modelled as a table with one seeded row, because stock is naturally keyed by
  (variant, warehouse) and allocation logic is per stock row.

## Alternatives
- Full Saleor channel listings with one channel: every catalog query joins listings — significant
  complexity tax on every milestone for a capability we don't need.

## Consequences
- + Catalog code stays simple.
- − Adding channels later = migration that moves price/publish fields into listing tables and adds
  `channel_id` to checkout/order. Documented as an extension point in ARCHITECTURE.md §12.
- + Adding warehouses later only needs a warehouse-selection strategy; schema already fits.
