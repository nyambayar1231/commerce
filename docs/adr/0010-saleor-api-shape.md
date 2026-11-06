# ADR-0010: Saleor-style API shape

Status: Accepted (2026-11-06)

## Context
Saleor Dashboard's grids, pagination and form-error handling assume Saleor's API conventions:
Relay global IDs (`base64("Product:<pk>")`, `saleor/graphql/core/connection.py`), cursor
connections (`first/after/last/before`, `pageInfo`, `totalCount`), and mutations returning
`{ <entity>, errors: [{ field, code, message }] }` (`saleor/graphql/core/mutations.py`).

## Decision
Adopt these conventions: UUID primary keys in DB, global IDs in GraphQL, a `node(id)` query,
keyset-paginated connections, and errors-as-data for expected (validation/business) failures.
Unexpected failures surface as masked GraphQL errors.

## Alternatives
- Offset pagination + thrown GraphQL errors: simpler, but every dashboard list/form pattern would
  have to be redesigned away from the reference.

## Consequences
- + Dashboard patterns (pagination, field-error mapping) port directly.
- − Keyset pagination with arbitrary sort columns requires (sort_value, id) cursors and matching indexes.
