# Research brief: <short title>

<!-- Template for backend-researcher / dashboard-researcher. Copy to .ai/briefs/<name>.md. -->

- **Role:** backend-researcher | dashboard-researcher (read-only)
- **For PLAN step:** <e.g. M2.1>

## Questions to answer

1. <Precise question, e.g. "Which Saleor mutations and error codes does categoryCreate have,
   and which of them does ARCHITECTURE §4 keep?">
2. <…>

## Where to look

- Our code: `<paths>`
- Reference: `../saleor-core/<paths>` / `../saleor-dashboard/src/<paths>`
- Docs: `ARCHITECTURE.md` §<n>, `docs/adr/<file>`, `PLAN.md` <step>

## Deliverable (your final message)

- Answers with `path:line` citations, separating **verified facts**, **inferences** and
  **open questions**.
- The files a change would touch, and the risks or invariants involved.
- For dashboard research: the component/route/state inventory and the API gaps against
  `apps/api/schema.graphql`.

Keep it under ~150 lines. Do not write code beyond short sketches. You cannot edit files.
