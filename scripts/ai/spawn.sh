#!/usr/bin/env bash
# Starts one OpenCode worker in a persistent Herdr (hc) terminal and hands it a brief.
#
#   scripts/ai/spawn.sh <role> <name> <brief.md> [--cwd <dir>]
#
#   role   one of the agents in .opencode/agents/ (see `scripts/ai/spawn.sh --roles`)
#   name   Herdr terminal name, 1-32 chars of a-z 0-9 - _ (also used for the evidence files)
#   brief  Markdown task brief (template: docs/ai-workflow/prompts/). It is copied to
#          .ai/briefs/<name>.md and the worker is told to read it.
#   --cwd  where the worker runs. Default: the worktree ../commerce-wt/<name> if it exists,
#          otherwise this repo. Writers should normally get their own worktree.
#
# Run it from the orchestrator's terminal inside Herdr: the worker becomes its child, reports
# with `hc send <orchestrator>`, and `hc wait --children any` returns when it finishes.
#
# Guarantees, checked before launch:
#   - the role's agent loads in the target directory (otherwise OpenCode silently falls back to
#     its full-permission "build" agent, verified during setup);
#   - no other live writer works in the same directory;
#   - the role's model is configured in .opencode/team.env.
source "$(dirname "$0")/lib.sh"

if [[ "${1:-}" == "--roles" ]]; then
  for r in $ROLES; do echo "$r"; done
  exit 0
fi

role="${1:-}"; name="${2:-}"; brief="${3:-}"
[[ -n "$role" && -n "$name" && -n "$brief" ]] || { sed -n '2,21p' "$0"; exit 2; }
shift 3
cwd=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cwd) cwd="${2:-}"; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done

is_role "$role" || die "unknown role '$role' (scripts/ai/spawn.sh --roles)"
[[ "$name" =~ ^[a-z0-9][a-z0-9_-]{0,31}$ ]] || die "name must be 1-32 chars of a-z 0-9 - _"
[[ -f "$brief" ]] || die "brief not found: $brief"

if [[ -z "$cwd" ]]; then
  if [[ -d "$WORKTREE_BASE/$name" ]]; then cwd="$WORKTREE_BASE/$name"; else cwd="$REPO_ROOT"; fi
fi
cwd="$(cd "$cwd" && pwd)"
git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$cwd is not a git working tree"

HC="$(resolve_bin hc)"
OC="$(resolve_bin opencode)"
JQ="$(resolve_bin jq)"

"$HC" server status >/dev/null 2>&1 || die "Herdr core is not reachable (open Herdr, or run: hc server start)"

if "$HC" get "$name" >/dev/null 2>&1; then
  die "a terminal named '$name' already exists (hc get $name); pick another name or stop it"
fi

# One writer per working directory.
if role_writes "$role"; then
  for addr in $("$HC" ls --json | "$JQ" -r '.terminals[].address'); do
    info="$("$HC" get --json "$addr" 2>/dev/null || true)"
    [[ -n "$info" ]] || continue
    other_cwd="$(echo "$info" | "$JQ" -r '.cwd // empty')"
    other_writes="$(echo "$info" | "$JQ" -r '.labels["commerce.ai.writes"] // "0"')"
    other_state="$(echo "$info" | "$JQ" -r '.state')"
    if [[ "$other_state" == "live" && "$other_writes" == "1" && "$other_cwd" == "$cwd" ]]; then
      die "writer $addr already works in $cwd. Use a worktree: scripts/ai/worktree.sh add $name"
    fi
  done
  if [[ "$cwd" == "$REPO_ROOT" && -n "$(git -C "$cwd" status --porcelain)" ]]; then
    echo "warning: $role will edit the main working tree, which has uncommitted changes."
    echo "         Its diff will mix with yours. A worktree keeps them apart."
  fi
fi

load_team_env
model_var="$(model_var_for_role "$role")"
model="${!model_var:-}"
[[ -n "$model" ]] || die "$model_var is empty in .opencode/team.env (pick one: scripts/ai/models.sh)"

# The agent must load in that directory with the main repo's definitions.
agents_json="$(cd "$cwd" && env "$(opencode_env)" "$OC" --standalone debug agents 2>/dev/null)" \
  || die "could not list OpenCode agents in $cwd"
mode="$(echo "$agents_json" | "$JQ" -r --arg r "$role" '.[] | select(.id == $r) | .mode')"
[[ -n "$mode" ]] || die "agent '$role' does not load in $cwd; refusing (OpenCode would fall back to its build agent)"
[[ "$mode" == "primary" ]] || die "agent '$role' has mode '$mode'; it must be 'primary' to be selected"

mkdir -p "$AI_DIR/briefs"
brief_copy="$AI_DIR/briefs/$name.md"
[[ "$(cd "$(dirname "$brief")" && pwd)/$(basename "$brief")" == "$brief_copy" ]] || cp "$brief" "$brief_copy"

writes=0; role_writes "$role" && writes=1
config_content="$("$JQ" -cn --arg a "$role" --arg m "$model" '{default_agent: $a, model: $m}')"

launch="$("$HC" run --bg --json --name "$name" --cwd "$cwd" \
  --label "commerce.ai=1" --label "commerce.ai.role=$role" --label "commerce.ai.writes=$writes" \
  -- env "$(opencode_env)" "OPENCODE_CONFIG_CONTENT=$config_content" "$OC" --standalone)"
addr="$(echo "$launch" | "$JQ" -r '.address')"
echo "started $role as $addr ($name) in $cwd with $model"

# Wait for the TUI to become ready, then deliver the task.
"$HC" wait --timeout 90 "$name" >/dev/null || true

parent="${HC_TERMINAL_ID:-}"
if [[ -n "$parent" ]]; then
  # No | ; & > or backticks in this line: read-only roles' shell rules deny them.
  report_line="When you are done or blocked, run exactly: $HC send $parent \"$name STATUS - see .ai/report.md or my last message\" where STATUS is done, partial or blocked."
else
  report_line="When you are done or blocked, say so in your final message."
fi
message="Read your task brief at $brief_copy and follow it exactly, together with AGENTS.md and the Repository conventions in CLAUDE.md (both in $REPO_ROOT). Work only in $cwd. $report_line"

# A send to a just-booted TUI can be dropped (seen in setup: started=false, empty input).
# Retry only when hc reports not_started and the turn has not advanced, so nothing is sent twice.
sent=0
for attempt in 1 2 3; do
  result="$("$HC" send --wait --timeout 15 --json "$name" "$message" 2>/dev/null || true)"
  if [[ "$(echo "$result" | "$JQ" -r '.started // false')" == "true" ]]; then sent=1; break; fi
  turn="$("$HC" get --json "$name" | "$JQ" -r '.turn // 0')"
  state="$("$HC" get --json "$name" | "$JQ" -r '.status.state // ""')"
  if [[ "$turn" != "0" || "$state" == "working" ]]; then sent=1; break; fi
  echo "task not picked up yet (attempt $attempt); retrying" >&2
  sleep 3
done
[[ "$sent" == 1 ]] || die "could not deliver the task to $name; inspect with: hc read $name --lines 0"

echo "task delivered to $name"
echo "  watch:  hc attach $name        (Ctrl+\\ detaches)"
echo "  status: scripts/ai/status.sh"
echo "  wait:   hc wait --children any"
