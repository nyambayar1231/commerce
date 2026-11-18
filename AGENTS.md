# AGENTS.md

Rules for AI coding agents working in this repository (OpenCode reads this file; Claude Code
reads `CLAUDE.md`). The repository conventions in `CLAUDE.md` → "Repository conventions" apply
to every agent: read that section before changing code.

The team layout, roles and lifecycle are documented in `docs/ai-workflow/README.md`.

## Who decides

- **Claude Code (the lead)** owns planning, scoping, architecture, review, commits and the final
  report. It works only inside the milestone/step the owner approved in `PLAN.md`.
- **The OpenCode implementer** (`.opencode/agents/implementer.md`) does exactly the task in its
  brief, nothing more. It never widens its own scope, never starts other agents, and never
  decides architecture. When the brief is ambiguous or wrong, stop and report `blocked` with the
  question.

## Hard rules for every worker

1. Edit only the files your brief allows. If a fix needs another file, stop and report it.
2. Never commit, push, stage, stash, reset, rebase, merge, switch branches or create worktrees.
   The lead commits after reviewing your diff.
3. Never read, print or edit `.env` or any credential. `.env.example` is fine.
4. Never hand-edit generated files: `apps/api/schema.graphql`, `**/*.generated.ts`,
   `packages/db/drizzle/meta/**`. Regenerate them with the commands in `CLAUDE.md`.
5. Never edit an applied migration. Never run `drizzle-kit push`.
6. Never add, remove or upgrade a dependency unless the brief names it explicitly.
7. Never edit project governance: `CLAUDE.md`, `AGENTS.md`, `PLAN.md`, `ARCHITECTURE.md`,
   `docs/**`, `.opencode/**`, `.claude/**`, `scripts/ai/**`.
8. The sibling repos `../saleor-*` are read-only references. Never copy code from
   `../saleor-storefront` (ADR-0008). Code adapted from `../saleor-dashboard` or
   `../saleor-core` carries the license header from `CLAUDE.md`.
9. Do not touch `apps/storefront` (Phase 4 is gated on the owner's explicit approval).
10. API tests share one `commerce_test` database. Run them only when the brief says so, and
    through `scripts/ai/verify.sh`, which serializes test runs between workers.

## Browser checks

You may use the `browse` tools to check dashboard UI you changed (owner, 2026-11-18). They drive
the owner's own Chrome through a paired extension, so you see the dashboard already signed in.

- Only `http://localhost:5173` (the dashboard dev server, if it's running) and, for comparison, the
  real Saleor dashboard at `http://localhost:9000/dashboard/`. No other sites.
- Never type passwords, tokens or payment data. If a page asks you to sign in, stop and report it.
- Prefer reading pages over changing data. Make test data only when the check needs it: name it
  `ZZ <purpose> QA`, delete it before you finish, and list it in your report. Never edit or delete
  existing data.
- Keep it short (a few checks of what you changed) and close the tabs you open. The lead still
  checks every UI step before committing; your browser results go in the report as evidence.

## Evidence, not claims

Your report is checked against the real `git diff` and re-run commands. Write it to
`.ai/report.md` in your working directory. Use exactly this shape:

```markdown
## Worker report: <terminal name>
- Status: done | partial | blocked
- Brief: <path of the brief you were given>
- Files changed: <paste `git status --porcelain`>
- Diff size: <paste `git diff --stat`>
- Commands run (each with exit code and the decisive output lines, copied, not paraphrased):
  - `<command>` → exit <n>: <lines>
- Tests: <pass/fail counts copied from the runner output, or "not run" and why>
- Not done / known issues / assumptions: <list, or "none">
- Questions for the orchestrator: <list, or "none">
```

Never write "tests pass" without the runner output that shows it. If you did not run something,
say so.

When finished or blocked, send one short line to the orchestrator with the `hc send` command
given in your brief (no `;`, `&`, `|`, `>` or backticks in the message). Then stop and wait.
