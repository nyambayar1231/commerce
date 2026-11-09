# AI team workflow

How this repo is developed with **Claude Code** (lead) + **OpenCode Go** (workers) +
**Herdr** (persistent agent terminals). This is the user guide. The step-by-step procedure the
lead follows for every task is in [`orchestrator.md`](orchestrator.md); worker rules are in
[`/AGENTS.md`](../../AGENTS.md).

Versions this was built and verified against (2026-11-09): Herdr core `hc` 0.1.18, OpenCode
2.2.6, Claude Code with Opus 5.5.

## The team

| Role | Runs on | Defined in | Can edit? | Job |
|---|---|---|---|---|
| **Orchestrator / architect** | Claude Code (Opus), your session | `CLAUDE.md`, `orchestrator.md` | yes, but delegates code | Investigates, writes scoped briefs, delegates, inspects diffs, runs checks, decides architecture questions with you, writes the final report |
| Backend researcher | OpenCode Go | `.opencode/agents/backend-researcher.md` | no | Maps `apps/api`, `packages/db` and `../saleor-core` for a task, with citations |
| Backend implementer | OpenCode Go | `.opencode/agents/backend-implementer.md` | `apps/api`, `packages/*` | Implements one API/DB brief with tests |
| Dashboard researcher | OpenCode Go | `.opencode/agents/dashboard-researcher.md` | no | Inventories `../saleor-dashboard` against our dashboard and schema |
| Dashboard implementer | OpenCode Go | `.opencode/agents/dashboard-implementer.md` | `apps/dashboard` | Implements one dashboard brief that matches Saleor and uses our API |
| Test & debugging engineer | OpenCode Go | `.opencode/agents/test-debugger.md` | app code, not migrations | Reproduces, finds root cause, fixes, adds tests |
| Code reviewer (first pass) | OpenCode Go, a different model from the implementer | `.opencode/agents/code-reviewer.md` | no | Reviews the actual diff for correctness, scope, conventions |
| Security reviewer (first pass) | OpenCode Go | `.opencode/agents/security-reviewer.md` | no | Reviews the actual diff for authz, injection, secrets, commerce integrity |
| Final code review | Claude Opus subagent | `.claude/agents/opus-code-reviewer.md` | no | Critical review before a step is reported done |
| Final security review | Claude Opus subagent | `.claude/agents/opus-security-reviewer.md` | no | Required for auth, permissions, checkout, payments, orders, raw SQL, dependencies |

Researchers and reviewers are enforced read-only by OpenCode permission rules, not only by
their prompts. Implementers cannot commit, push, stage, reset or switch branches, cannot edit
governance or generated files, cannot read `.env`, cannot start other agents, and are blocked
(`ask`) on dependency changes. See "What the guardrails are" below for their limits.

## One-time setup (manual, by you)

1. **OpenCode Go login.** Check with `opencode auth list` (you should see `OpenCode Go … stored`).
   If missing: `opencode auth login` and pick OpenCode Go. Credentials stay in OpenCode; nothing
   in this repo reads or copies them.
2. **Pick models.** No model ID is committed.
   ```sh
   cp .opencode/team.env.example .opencode/team.env   # gitignored
   scripts/ai/models.sh                               # lists opencode-go/* models
   $EDITOR .opencode/team.env                         # OC_MODEL_RESEARCH/BACKEND/DASHBOARD/TEST/REVIEW
   scripts/ai/doctor.sh --live                        # each model must actually answer
   ```
   Choose a model family for `OC_MODEL_REVIEW` that differs from both implementers. A model can
   be listed but unusable on your account (for example region-restricted models need "Global"
   enabled in the OpenCode console), which is what `--live` catches.
3. **Herdr.** The Herdr app must be running (it runs the `hc` core). `hc server status` should
   print JSON.
4. **Check everything:** `scripts/ai/doctor.sh` must end with `all required checks passed`.
5. **Commit the infrastructure** (`AGENTS.md`, `.opencode/agents`, `.claude/`, `scripts/ai`,
   `docs/ai-workflow`, `.gitignore`) when you are happy with it. Workers in worktrees always
   load agent definitions from this repo's `.opencode/` (via `OPENCODE_CONFIG_DIR`), but
   `AGENTS.md`, scripts and docs only exist inside a new worktree once they are committed.

## Daily use

```sh
scripts/ai/start.sh                 # opens Claude Code as tab "lead" in Herdr (space "commerce")
                                    # (or: scripts/ai/start.sh --headless, then hc attach lead)
```

Then tell the lead what to do, for example:

> Follow docs/ai-workflow/orchestrator.md for PLAN step M1.1 (approved). Stop after the report.

The lead runs the procedure: investigate → brief → worktree → spawn worker → wait → collect
evidence → run checks → reviews → fix loop → report. Watch and steer at any time:

```sh
scripts/ai/status.sh                # workers (role, status, turn, folder) and worktrees
hc attach <name>                    # take over a worker's terminal; Ctrl+\ detaches
hc read <name> --lines 60           # its screen and history without attaching
hc send <name> "Focus on X"         # steer it
scripts/ai/stop.sh <name>           # end one worker (or --all); worktrees are kept
```

Every command the lead uses is a script you can run by hand too:

| Script | What it does |
|---|---|
| `scripts/ai/doctor.sh [--live]` | Verifies tools, Herdr core, OpenCode Go auth, models, that all 7 agents load with `.env` denied, Claude agents, settings JSON, script syntax, gitignore |
| `scripts/ai/models.sh [--all]` | Lists available OpenCode Go models and the current choice |
| `scripts/ai/worktree.sh add <name> [<base>]` | New worktree `../commerce-wt/<name>` on branch `ai/<name>`, `.env` from `.env.example`, `pnpm install` |
| `scripts/ai/worktree.sh rm <name>` | Removes a clean worktree (keeps the branch) |
| `scripts/ai/spawn.sh <role> <name> <brief.md> [--cwd dir]` | Starts a worker in a Herdr terminal and delivers its brief (refuses unsafe launches, see the script header) |
| `scripts/ai/status.sh` | Lists workers and worktrees |
| `scripts/ai/collect.sh <name> [--cwd dir]` | Writes `.ai/evidence/<name>-<time>.md`: commits, status, full diff, untracked files, then the worker's report |
| `scripts/ai/verify.sh [--quick] [--build] [--dir d]` | lint, typecheck, tests (serialized on the shared test DB), schema/codegen drift, optional build |
| `scripts/ai/stop.sh <name>\|--all` | Kills and removes workers this setup started; never other terminals |

Runtime files go to `.ai/` (gitignored): `briefs/`, `evidence/`, and each worker's
`.ai/report.md` inside its worktree.

## Landing a change

Nothing is committed automatically. When the lead reports a step as verified, you decide:
review the diff in the worktree, then commit on its branch (`git -C ../commerce-wt/<name> …`)
and merge, or apply the diff to main yourself. Afterwards `scripts/ai/worktree.sh rm <name>`.

## Development phases (owner priority, enforced by the lead)

1. **API**: database, auth, authorization, catalog, products, variants, inventory, checkout,
   orders, following `ARCHITECTURE.md` and `PLAN.md`.
2. **Admin dashboard**: matches Saleor Dashboard closely and is wired to our real API.
3. **Quality assurance**: integration, API and dashboard tests, security review, production
   builds.
4. **Storefront**: only after you explicitly confirm API and Admin are complete. Until then, no
   agent edits `apps/storefront` (implementers are denied by permission rule).

`PLAN.md` still decides *which step* is approved; the phases decide *order*. Where a PLAN step
spans API and dashboard, the API part is done and verified first.

## How the pieces connect

```
you ──► Claude Code "lead" (Herdr terminal, $HC_TERMINAL_ID)
          │  scripts/ai/spawn.sh role name brief
          ▼
        hc run --bg --name <name> --cwd ../commerce-wt/<name>
          env OPENCODE_CONFIG_DIR=<repo>/.opencode
              OPENCODE_CONFIG_CONTENT={"default_agent":"<role>","model":"<from team.env>"}
          opencode --standalone            (interactive TUI, persistent, attachable)
          │  hc send <name> "Read your brief at .ai/briefs/<name>.md …"
          ▼
        worker edits only its worktree, writes .ai/report.md,
        runs: hc send <lead> "<name> done - see .ai/report.md"
          │
          ▼
lead: hc wait --children any → collect.sh → verify.sh → reviewers → report to you
```

- **Claude → OpenCode delegation** is a Herdr terminal running the OpenCode TUI with a
  per-launch agent and model. Workers stay interactive, so the lead (or you) can send
  follow-ups to the same session instead of starting over.
- **Herdr** keeps each worker alive in its own terminal (surviving a closed window), tracks
  its status (`idle`, `working`, `blocked`, `done`) from OpenCode's own reports, delivers
  messages both ways, and lets you attach. `blocked` means the worker needs a person (for
  example a dependency `ask`); the lead must ask you, never force it.
- **Claude Opus** reviews run as Claude Code subagents of the lead (`.claude/agents/`), not in
  Herdr.

## What the guardrails are, and are not

Verified on 2026-11-09 with probe agents in a scratch repo:
- `edit` rules use repo-relative globs. A writer could not write outside its directory
  (absolute or `../`), could not write `secret/*` or `**/*.generated.ts` when denied, and
  could still write allowed files.
- Shell rules match the whole command string: `git commit …` and `cat .env` were denied, and
  `echo` was allowed. Read-only agents could not edit or run commands outside their allow-list.
- Rules are ordered and the **last match wins**. That is why every agent ends with the `.env`
  rules, and `doctor.sh` checks it.

Limits: these are guardrails on one tool, not a sandbox. A writing agent has a general shell,
and a determined command could get around a glob, for example by building a file write in a
script it creates. That is why the real protections are structural: a separate worktree per
writer, no commit rights, the lead reading the actual diff, and you landing the change.

## Herdr: supported and not supported

- Herdr has no per-repo configuration. Its reusable *templates* live only in
  `~/.config/herdr-core/templates/` (global). This repo therefore has no `.herdr/` folder;
  `spawn.sh` launches workers directly with `hc run`, which is the pattern Herdr's manual
  documents for agents without a template.
- Programs launched by `hc run <cmd>` do not get your login `PATH`. The scripts pass absolute
  binary paths (`resolve_bin` in `scripts/ai/lib.sh`).
- A task sent right after the OpenCode TUI starts can be dropped (`started: false`).
  `spawn.sh` retries only when Herdr reports `not_started` and the turn has not advanced, so a
  task is never delivered twice.
- OpenCode silently falls back to its full-permission **build** agent if the requested agent
  does not exist, or is not `mode: primary`. `spawn.sh` refuses to launch unless the role loads
  as primary in the target directory.
- The OpenCode TUI has no `--agent`/`--model` flags; they are passed through
  `OPENCODE_CONFIG_CONTENT`, which needs `--standalone`. The shared background service ignores
  per-launch environment.

## Changing the team

- **Model for a role:** edit `.opencode/team.env`, then run `scripts/ai/doctor.sh`.
- **Permissions or prompt of a worker:** edit `.opencode/agents/<role>.md`. Keep the ordering
  (allow, then deny, then the `.env` rules last), then run `scripts/ai/doctor.sh`. The schema is
  `https://opencode.ai/config.json` (`$defs/Config.AgentEncoded`); `opencode debug agents`
  shows the effective rules.
- **New role:** add the agent file, add it to `ROLES` (and `role_writes` if it edits) in
  `scripts/ai/lib.sh`, map its model in `model_var_for_role`, and add a row above.
