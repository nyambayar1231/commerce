# Orchestrator procedure

What Claude Code (the lead) does for **every** development task, whichever implementer writes it
(the team and model routing are in [`README.md`](README.md)). It sits on top of the agent
working agreement in `CLAUDE.md` (approved PLAN step only, small steps). Setup and the team are in
[`README.md`](README.md). Keep it token-efficient: the implementer does the reading and writing on
OpenCode; the lead spends its tokens on the brief and the review.

## 0. Gate

- The step is **Approved** in `PLAN.md` (or explicitly requested by the owner). Otherwise ask.
- Phase order API → Admin → QA → Storefront; never start storefront work without the owner's go.
- State briefly what will change.

## 1. Investigate, briefly

Read the PLAN step, the ARCHITECTURE section/ADR it touches and only the code needed to make the
decisions. Leave wide reading to the implementer.

## 2. Brief

Copy `prompts/implement.md` to `.ai/briefs/<name>.md`. Fill in: goal, PLAN step, allowed files,
out of scope, the decisions already made (names, types, error codes), tests, acceptance criteria.
One concept per brief. Architecture decisions are the lead's (with the owner), never the worker's.

If the step needs a new dependency or `package.json` script, add it yourself before spawning
(pinned, `--save-exact`): the implementer's package edits stop for the owner by design.

## 3. Delegate

Pick the implementer from the routing table in `README.md` ("The team") and write it in the
brief's **Role** line.

**OpenCode (DeepSeek, GLM):**

```sh
scripts/ai/spawn.sh <name> .ai/briefs/<name>.md               # DeepSeek (OC_MODEL_IMPLEMENT)
scripts/ai/spawn.sh <name> .ai/briefs/<name>.md --model ui    # GLM-5.3 (OC_MODEL_UI)
# or, for isolation: scripts/ai/worktree.sh add <name>  (then spawn picks the worktree)
```

**Claude subagents (Sonnet, Haiku):** create the worktree with `scripts/ai/worktree.sh add <name>`
(it has `.env` and dependencies), then start the Agent tool with `model: "sonnet"` or `"haiku"`, in
the background. The prompt is only: *"You are an implementer. Work only in `../commerce-wt/<name>`.
Read `.ai/briefs/<name>.md` and follow it exactly, together with `AGENTS.md` and the Repository
conventions in `CLAUDE.md`. Never commit, stage or switch branches. Run the checks the brief names,
write `.ai/report.md` in that worktree, and end with done, partial or blocked."* The brief file
lives in the main repo's `.ai/briefs/`; copy it into the worktree's `.ai/briefs/` first.

Never pipe `spawn.sh` into `head`: a closed pipe kills it before the brief is delivered.
Wait with `hc wait --children any` (in the background for long steps), never `sleep`.
`blocked` means a permission prompt or a question: ask the owner, never force it.

**Fallback when OpenCode is out of funds** ("Insufficient account funds", or `doctor.sh --live`
fails on the model): its briefs go to a Sonnet subagent, with the same brief. If Claude usage runs
out too, the lead implements the brief itself, in the main tree, with the same allowed files and
acceptance criteria, then continues with steps 5–8 (skip 4). Never top up or wait for the
usage reset; the owner chose this fallback on 2026-11-09. Check once per step whether OpenCode has
funds again (a single short `opencode run`, or the next spawn), not repeatedly.

## 4. Evidence

```sh
scripts/ai/stop.sh <name>                   # OpenCode workers only
scripts/ai/collect.sh <name> [--cwd .]      # Claude subagents: --cwd ../commerce-wt/<name>
```

Check: only allowed files changed, no commits, the worker's claims match the diff.

## 5. Verify

`scripts/ai/verify.sh` yourself (Postgres up: `pnpm db:up`). Add a manual check when tests
can't cover it (a CLI in a real terminal via `hc run`, a quick look in Chrome). Remove any test data
you created in the dev database.

## 6. Light review (the lead, on Opus)

Read the diff once, looking only for things that matter:
- **Correctness:** wrong logic, missed edge cases the brief named, broken invariants.
- **Security:** auth/permission checks, secrets, injection, money/stock integrity.
- **Scope and conventions that bite later:** module boundaries, `Executor`, migrations,
  generated files, Saleor naming, license headers.

Skip style and naming nits that Biome or a later step will settle. No separate reviewer agents.

## 7. Fix only what matters

Send real issues to the same session, or start a short fix brief:
`hc send <name> "Fix only: 1) path:line … Then rerun scripts/ai/verify.sh and update .ai/report.md."`
Re-verify. Escalate to the owner after two rounds.

## 8. Commit and report

Mark the step Done in `PLAN.md` (no Result paragraphs: the details go in the commit and the
report; an item that still needs the owner's approval goes in "Open items from finished
milestones"), commit the step (one commit per sub-step), and report to the owner: what changed, files, verification (actual commands and
results), review findings and what was fixed, anything deferred. Push only when the owner asked.
Template: [`prompts/final-report.md`](prompts/final-report.md).
