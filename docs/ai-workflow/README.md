# AI workflow

How this repo is developed with **Claude Code** (lead and reviewer) + **implementers** (the
OpenCode Go implementer agent on DeepSeek or GLM, and Claude Sonnet/Haiku subagents) + **Herdr**
(persistent agent terminals). The per-task procedure the lead follows is
in [`orchestrator.md`](orchestrator.md); the implementer's rules are in
[`/AGENTS.md`](../../AGENTS.md).

Built and verified with Herdr core `hc` 0.1.18, OpenCode 2.2.6 and Claude Code (Opus 5.5).

## The team

| Role | Runs on | Started with | Gets |
|---|---|---|---|
| **Lead** | Claude Code (Opus), your session | `scripts/ai/start.sh` | Architecture, ADRs, dependencies, briefs, reading every diff, `verify.sh`, commits, reports |
| **Implementer: DeepSeek** | OpenCode Go, `OC_MODEL_IMPLEMENT` (DeepSeek V4.1 Flash) | `spawn.sh <name> <brief>` | API, DB, dashboard (wrote M1–M14; the cheapest) |
| **Implementer: GLM** | OpenCode Go, `OC_MODEL_UI` (GLM-5.3) | `spawn.sh <name> <brief> --model ui` | Storefront UI adapted from Paper (pages, components) |
| **Implementer: Sonnet** | Claude Code subagent (`model: sonnet`, worktree) | the lead's Agent tool | Security- and state-critical code: scaffolds and conventions, sessions/auth, cart, checkout, e2e, deploy |
| **Implementer: Haiku** | Claude Code subagent (`model: haiku`, worktree) | the lead's Agent tool | Mechanical, fully specified work: message catalogs, translation drafts, SEO files, license headers |

All implementers follow the same `AGENTS.md` and the same brief template, and the lead treats their
work the same way: it reads the real diff and runs the checks itself. Owner decision 2026-11-19
(PLAN "Storefront programme"), which replaced the single-implementer team of 2026-11-09.

- **Escalation:** a brief that fails review twice moves up a tier (Haiku → GLM → Sonnet;
  DeepSeek → Sonnet).
- **Budgets:** if OpenCode Go runs out of funds, its briefs go to Sonnet, then to the lead. Limits
  are never raised (organization rule).
- **Parallelism:** at most two implementers at a time, each in its own worktree, with file lists
  that don't overlap.

History: a larger team (researchers, separate backend/dashboard implementers, test/debug, two
OpenCode reviewers, a browser tester, two Opus review subagents) ran until 2026-11-09. Several
OpenCode runs per step used up the OpenCode Go balance, so the owner reduced it to this pair.

Claude subagents have no OpenCode rules: their guardrails are their brief, `AGENTS.md`, a
separate worktree and the lead's diff check (`orchestrator.md` step 4).

The OpenCode implementer is guardrailed by OpenCode permission rules, not only by its prompt: no commits,
pushes, staging, resets or branch switches; no `.env`; no edits to governance or generated files; no browser tools; dependency changes stop for the owner (`ask`).

## One-time setup (manual, by you)

1. **OpenCode Go login:** `opencode auth list` shows `OpenCode Go … stored`
   (otherwise `opencode auth login`).
2. **Model:** `cp .opencode/team.env.example .opencode/team.env` and set
   `OC_MODEL_IMPLEMENT=opencode-go/deepseek-v4.1-flash` and `OC_MODEL_UI=opencode-go/glm-5.3`
   (gitignored; `scripts/ai/models.sh` lists models).
3. **Herdr** app running (`hc server status` prints JSON).
4. `scripts/ai/doctor.sh --live` ends with `all required checks passed` (`--live` also proves the
   model answers, i.e. the account has funds).

## Daily use

```sh
scripts/ai/start.sh                 # Claude Code as tab "lead" in Herdr (or --headless)
```

Tell the lead: *"Follow docs/ai-workflow/orchestrator.md for PLAN step M1.1.3."* Watch or steer:

```sh
scripts/ai/status.sh                # the implementer and worktrees
hc attach <name>                    # take over its terminal; Ctrl+\ detaches
hc send <name> "Focus on X"         # steer it
scripts/ai/stop.sh <name>           # end it (worktrees are kept)
```

| Script | What it does |
|---|---|
| `scripts/ai/doctor.sh [--live]` | Tools, Herdr core, OpenCode Go auth, the model, the implementer's rules, settings JSON, script syntax, gitignore |
| `scripts/ai/models.sh [--all]` | Available OpenCode Go models and the current choice |
| `scripts/ai/worktree.sh add <name>` | Isolated worktree `../commerce-wt/<name>` (branch `ai/<name>`, `.env` from `.env.example`, `pnpm install`) |
| `scripts/ai/spawn.sh <name> <brief.md> [--cwd d]` | Starts the implementer in a Herdr terminal and delivers the brief; refuses if the agent doesn't load or another implementer works in the same folder |
| `scripts/ai/collect.sh <name> [--cwd d]` | `.ai/evidence/<name>-<time>.md`: commits, status, full diff, new files, then the worker's report |
| `scripts/ai/verify.sh [--quick] [--build] [--dir d]` | lint, typecheck, tests (serialized on the shared test DB), schema/codegen drift, optional build |
| `scripts/ai/stop.sh <name>\|--all` | Ends implementers this setup started; never other terminals |

Runtime files live in `.ai/` (gitignored): `briefs/`, `evidence/`, the worker's `.ai/report.md`.

## Browser QA (tester agent)

A local copy of the whole shop and an OpenCode **tester** agent (`--role tester`, DeepSeek) that
walks the customer and staff journeys in the browser and reports; the lead reviews the report and
re-checks every failure. How to run it: [testing.md](testing.md); the journeys:
[test-plan.md](test-plan.md). Owner request, 2026-11-27.

## Browser checks

The implementer may check its own UI work with `browse` (OpenCode's Chrome driver, through its
paired extension in your Chrome) since 2026-11-18: the server is declared in `.opencode/opencode.json`
(workers don't read the global config) and `browse_*` is allowed in the agent's permissions, while
OpenCode's `execute` stays denied. The rules are in AGENTS.md ("Browser checks"). The lead still
checks every UI step in Claude in Chrome before committing.

## Development phases (owner priority)

API → Admin dashboard (matching Saleor, wired to the real API) → QA → Storefront. The storefront
(M4 and the parts moved to Phase 4) starts only after you confirm API and Admin are complete;
confirmed on 2026-11-19.
`PLAN.md` decides which step is approved.

## Facts the scripts rely on (verified 2026-11-09)

- Herdr has no per-repo config (templates are global), so `spawn.sh` launches with `hc run`.
- `hc run <cmd>` doesn't get your login `PATH`; the scripts pass absolute binaries.
- The first message to a just-started OpenCode TUI can be dropped; `spawn.sh` retries only when
  Herdr reports `not_started` and the turn hasn't advanced.
- OpenCode falls back to its full-permission **build** agent if the requested agent is missing or
  not `mode: primary`; `spawn.sh` refuses to launch in that case.
- The TUI has no `--agent`/`--model` flags: they go through `OPENCODE_CONFIG_CONTENT`, which needs
  `--standalone`. `OPENCODE_CONFIG_DIR` (set by `spawn.sh`) replaces the global OpenCode config, so
  every worker uses this repo's `.opencode/` definitions even in a worktree.
- Permission rules are ordered, **last match wins**; `edit` globs are repo-relative; shell rules
  match the whole command string. The `browser` rule does not gate MCP tools; `browse_*` and
  OpenCode's `execute` must be denied explicitly.
- Guardrails are not a sandbox: the real protection is the worktree, no commit rights, the lead
  reading the actual diff, and you landing the change.
