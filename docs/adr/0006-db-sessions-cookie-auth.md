# ADR-0006: Auth = opaque DB-backed sessions in HttpOnly cookies

Status: Accepted (2026-11-06)

## Context
Saleor uses JWT access + refresh tokens (`saleor/core/jwt.py`, `tokenCreate`/`tokenRefresh`
mutations) with the dashboard storing tokens client-side. We run locally first but must be
deployable later (same-site subdomains like `api.`, `admin.`, `shop.`).

## Decision
`session` table (random 256-bit token, stored as SHA-256 hash, user_id, expires_at, kind:
staff|customer). Browser clients get an `HttpOnly; Secure; SameSite=Lax` cookie. Yoga's
CSRF-prevention plugin requires a non-simple header on every request. Server-side scripts/tests may
send the same token as `Authorization: Bearer`. Passwords hashed with argon2id.

## Alternatives
- **Saleor JWT model**: stateless, but revocation needs a denylist/rotation, tokens in JS are
  XSS-exposed, and refresh flows add client complexity.
- **Third-party auth (Auth.js, Clerk)**: hides the part we want to learn.

## Consequences
- + Instant revocation (delete row), no refresh-token dance, tokens not readable by JS.
- − One indexed DB lookup per authenticated request (cheap; cacheable later).
- − Requires same-site deployment (or a token mode) for dashboard/API on different domains.
