# ADR-0008: Storefront = Next.js App Router; Saleor Storefront used for patterns only

Status: Accepted (2026-11-06)

## Context
`../saleor-storefront` is licensed FSL-1.1 (Functional Source License), not BSD. It uses Next.js
App Router, server components, urql and Tailwind.

## Decision
Next.js (App Router) + Tailwind for the storefront (the Macaw requirement applies to the dashboard
only). Catalog pages are server components calling the API with `fetch` + typed documents;
cart/checkout mutations go through Server Actions so the checkout token stays in an HttpOnly
cookie on the storefront domain. We read Saleor Storefront for structure and flows but write our
own code.

## Alternatives
- Vite SPA storefront: simpler, but no SSR/SEO and the checkout token ends up in JS-readable storage.
- Remix/React Router framework mode: viable; Next.js matches the reference and is the most common.

## Consequences
- + SEO-friendly catalog, secure checkout token, no licensing ambiguity.
- − Server components/Server Actions are an additional mental model to learn.
