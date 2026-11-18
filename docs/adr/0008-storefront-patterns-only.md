# ADR-0008: Storefront = Next.js App Router; Saleor Storefront UI adapted under FSL

Status: Accepted (2026-11-06), amended 2026-11-19 (see "Amendment")

## Context
`../saleor-storefront` ("Paper") is licensed FSL-1.1-ALv2 (Functional Source License), not BSD. It
uses Next.js App Router, server components, urql and Tailwind.

## Decision (2026-11-06)
Next.js (App Router) + Tailwind for the storefront (the Macaw requirement applies to the dashboard
only). Catalog pages are server components calling the API with `fetch` + typed documents;
cart/checkout mutations go through Server Actions so the checkout token stays in an HttpOnly
cookie on the storefront domain. We read Saleor Storefront for structure and flows but write our
own code.

## Amendment (2026-11-19, owner decision)
The owner wants the storefront to look and behave like Paper, reusing its code as much as is
sensible. The last sentence of the decision is replaced by:

- **UI is adapted from Paper.** Markup, Tailwind classes, design tokens (`brand.css`, the Tailwind
  config), component structure and client-side UI behaviour may be copied and adapted.
- **Logic stays ours.** The data layer, sessions and auth, cart, checkout and payment logic are
  written for our API (ADR-0015). Paper's versions are tied to Saleor channels, JWTs and app tokens.
- **Every adapted file starts with:**
  ```
  // Adapted from saleor-storefront: src/<path> (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
  // See THIRD_PARTY_LICENSES.md
  ```
  Adapted files stay under FSL-1.1-ALv2 (its terms cover "all copies, modifications and
  derivatives"); the full text is in `THIRD_PARTY_LICENSES.md`. Each one becomes Apache-2.0 on the
  second anniversary of the Paper version it came from.
- **Permitted purpose.** FSL allows any use except a *Competing Use*: offering the software to
  others in a commercial product or service that substitutes for Paper or offers substantially
  similar functionality. Running our own shop on it is not that. **Never package, sell or host
  this storefront for others as a storefront template or service.** (Owner's reading of the
  license; not legal advice.)
- **No Saleor or Paper trademarks**: no Paper logo, name or "Paper sign". The shop name is used,
  as in the dashboard (M1.1.6).

## Alternatives
- Vite SPA storefront: simpler, but no SSR/SEO and the checkout token ends up in JS-readable storage.
- Remix/React Router framework mode: viable; Next.js matches the reference and is the most common.
- Patterns only (the original decision): no license constraints on our code, but slower, and the
  result drifts from Paper's look.

## Consequences
- + SEO-friendly catalog, secure checkout token, close visual parity with Paper.
- + Each adapted file can be compared with its source line by line.
- − Part of `apps/storefront` is FSL-licensed, not freely relicensable, until each file's
  Apache-2.0 date. The repo is public, so the license text and headers must be kept.
- − Server components/Server Actions are an additional mental model to learn.
