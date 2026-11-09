# Review brief: <name>

<!-- Template for code-reviewer / security-reviewer (OpenCode) and for the Opus subagents.
     Copy to .ai/briefs/<name>-review.md. Start the reviewer with --cwd on the implementer's
     worktree, after the implementer has stopped. -->

- **Role:** code-reviewer | security-reviewer
- **Change under review:** the uncommitted diff in your working directory
- **Original task brief:** `<repo>/.ai/briefs/<name>.md`
- **Worker report (a claim, not evidence):** `.ai/report.md` in your working directory
- **Evidence collected by the lead:** `<repo>/.ai/evidence/<file>.md`

## Focus

<Anything specific: e.g. "the transaction boundary in checkoutComplete", "permission checks on
the new mutations", "does the list match ../saleor-dashboard/src/products/…">

## Deliverable

The review format from your agent instructions, as your final message: a verdict, findings
ranked by severity with `path:line` and a concrete scenario, scope violations, mismatches
between the report and the diff, and the commands you ran.
