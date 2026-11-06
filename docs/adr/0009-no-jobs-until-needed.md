# ADR-0009: No background job system until a requirement needs it

Status: Accepted (2026-11-06)

## Context
Saleor uses Celery + Redis for webhooks, emails, search-vector updates, and expiring checkouts.

## Decision
No queue/worker in early milestones. Time-based state is evaluated at read time (e.g. a checkout
older than N days is treated as expired). When the first real async requirement appears
(order-confirmation email, M8), introduce a transactional outbox table + a Postgres-backed queue
(pg-boss) — no Redis.

## Alternatives
- BullMQ/Redis from day one: extra infra and failure modes with nothing to process.

## Consequences
- + Fewer moving parts; every request's effects are visible synchronously.
- − M8 must add an outbox (written inside the same transaction as the business change) to avoid
  lost or phantom emails.
