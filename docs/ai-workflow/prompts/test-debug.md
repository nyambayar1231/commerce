# Test/debug brief: <short title>

<!-- Template for test-debugger. Copy to .ai/briefs/<name>.md. -->

- **Role:** test-debugger
- **PLAN step:** <step>
- **Working directory:** <../commerce-wt/<name>>

## Problem

<Either "Add tests for <behaviour>" or the bug: what happens, what should happen.>

Reproduce with:

```sh
<exact command, e.g. scripts/ai/verify.sh or pnpm --filter @commerce/api test -- <file>>
```

Observed output (if known):

```
<paste>
```

## Allowed files

- `<test file>` (new or edit)
- `<source file>`: only if the root cause is there

## Rules

- Reproduce first and include the failing output in your report.
- Fix the cause; never weaken, skip or delete tests, and never add DB mocks for domain logic.
- If the test itself is wrong, report it instead of changing it.

## Acceptance criteria

- [ ] The reproduction command fails before and passes after (both outputs in the report)
- [ ] `scripts/ai/verify.sh` passes

## Report

`.ai/report.md` as in AGENTS.md, then the `hc send` line you were given.
