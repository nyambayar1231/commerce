# ADR-0002: GraphQL server = GraphQL Yoga, schema = Pothos (code-first)

Status: Accepted (2026-11-06)

## Context
Saleor defines its schema code-first with Graphene (`saleor/graphql/*/types.py`, `mutations/*.py`).
We want a schema whose resolvers are type-checked against our domain types, plus a printed SDL file
that clients generate types from.

## Decision
GraphQL Yoga (HTTP server, CSRF-prevention plugin, error masking) + Pothos schema builder.
The schema is printed to `apps/api/schema.graphql` and committed; a CI check fails if it is stale.

## Alternatives
- **SDL-first + graphql-codegen resolvers**: very inspectable SDL, but resolver typing is
  generated glue and the schema and implementation can drift.
- **Apollo Server**: fine, heavier; Yoga is smaller and fetch-API based.
- **TypeGraphQL / NestJS**: decorator/DI magic that hides control flow — conflicts with "inspectable".

## Consequences
- + Compile-time errors when a resolver returns the wrong shape; resembles Graphene's code-first style.
- − Pothos is a library to learn; we use only its core + the Relay plugin (introduced explicitly, see ADR-0010).
- − Reviewers read the printed SDL to see the public contract (that's why it's committed).
