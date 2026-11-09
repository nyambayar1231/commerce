# Final report: <PLAN step> <title>

<!-- The lead's report to the owner after step 10 of orchestrator.md. Facts only; failures and
     skipped checks are stated as such (CLAUDE.md rule 7). -->

## What changed
<behaviour in two or three sentences>

## Files
<`git status --porcelain` of the worktree, grouped by area>

## How it works
<the mechanism, citing `path:line`>

## Decisions and trade-offs
<each decision, the alternatives, and why; anything that needs owner approval is marked **Needs approval**>

## Verification
| Command | Where | Result |
|---|---|---|
| `scripts/ai/verify.sh` | `../commerce-wt/<name>` | <PASS/FAIL per step, test counts> |

## Reviews
- code-reviewer (<model>): <verdict, findings fixed / rejected with reason>
- opus-code-reviewer: <verdict, …>
- security (if applicable): <…>

## Workers used
<role, terminal name, model, rounds>

## Deferred / known issues
<list or "none">

## For you to do
- Land the change: <worktree path, branch ai/<name>>
- <approvals needed>
