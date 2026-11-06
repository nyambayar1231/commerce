# ADR-0007: Dashboard = Vite + React 18 + Macaw UI + Glide Data Grid + Apollo Client

Status: Accepted (2026-11-06)

## Context
Saleor Dashboard (`../saleor-dashboard/package.json`) uses Vite, React 18, `@saleor/macaw-ui-next`
(npm `@saleor/macaw-ui@3.x`) plus legacy `@saleor/macaw-ui@0.7`, Glide Data Grid 5.3, Apollo
Client 3, React Router 5, react-intl. Fidelity is a primary goal.

## Decision
- Vite SPA, React 18 (same major as the reference so adapted components work unchanged).
- Macaw UI = `@saleor/macaw-ui` 3.x only (the "macaw-ui-next" line). No legacy 0.7, no MUI.
- Glide Data Grid at the reference's major (5.x) so Saleor custom cells/theme adapt directly.
- Apollo Client 3 + GraphQL Code Generator (typed documents). Normalized cache keeps list and detail
  views consistent after mutations, which is how Saleor Dashboard behaves.
- React Router 6 (v5 is legacy; differences are confined to route definitions/hooks).
- react-intl with a single `en` locale — keeps Saleor components' `useIntl`/`defineMessages`
  code adaptable verbatim and keeps i18n possible later.
- Forms: react-hook-form + our Saleor-style Savebar/ExitFormDialog for dirty state.

## Alternatives
- shadcn/Tailwind: rejected by requirement. urql: lighter, but document cache would diverge from
  Saleor's list/detail consistency behavior. TanStack Router: good but further from the reference.

## Consequences
- + Close visual and behavioral parity; Saleor files can be adapted with minimal changes.
- − Glide 5.x is not the newest major; upgrading later is a contained task.
- − Apollo cache normalization requires `id` + `__typename` discipline in every query.
