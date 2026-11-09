#!/usr/bin/env bash
# Checks that the AI team setup is usable: tools, authentication, Herdr core, model choices,
# agent definitions and script syntax. Read-only; prints PASS/WARN/FAIL and exits 1 on FAIL.
#
#   scripts/ai/doctor.sh          # static checks
#   scripts/ai/doctor.sh --live   # also send each configured model a one-word prompt
source "$(dirname "$0")/lib.sh"
set +e
live=0; [[ "${1:-}" == "--live" ]] && live=1

fails=0
pass() { echo "PASS  $*"; }
warn() { echo "WARN  $*"; }
fail() { echo "FAIL  $*"; fails=$((fails + 1)); }

# --- tools
for bin in git node pnpm jq hc opencode claude; do
  p="$(resolve_bin "$bin" 2>/dev/null)"
  if [[ -n "$p" ]]; then pass "$bin: $p"; else
    if [[ "$bin" == claude ]]; then warn "claude CLI not found (only needed to start the orchestrator)"; else fail "$bin not found"; fi
  fi
done
HC="$(resolve_bin hc 2>/dev/null)"; OC="$(resolve_bin opencode 2>/dev/null)"; JQ="$(resolve_bin jq 2>/dev/null)"
[[ -n "$HC" && -n "$OC" && -n "$JQ" ]] || { echo; echo "$fails failure(s)"; exit 1; }

pass "hc $("$HC" --version 2>/dev/null | awk '{print $2}'), opencode $("$OC" --version 2>/dev/null)"

# --- Herdr core
if status="$("$HC" server status 2>/dev/null)"; then
  pass "Herdr core running (live terminals: $(echo "$status" | "$JQ" -r '.live'))"
else
  fail "Herdr core not reachable: open Herdr, or run hc server start"
fi
if [[ -n "${HC_TERMINAL_ID:-}" ]]; then
  pass "this shell is Herdr terminal $HC_TERMINAL_ID (workers will report to it)"
else
  warn "not inside a Herdr terminal: start the orchestrator with scripts/ai/start.sh so workers can report back"
fi

# --- OpenCode authentication (prints provider names only, never keys)
if "$OC" auth list 2>/dev/null | grep -q '^OpenCode Go'; then
  pass "OpenCode Go credentials stored"
else
  fail "OpenCode Go not authenticated: run opencode auth login (choose OpenCode Go)"
fi

# --- models
if [[ -f "$REPO_ROOT/.opencode/team.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$REPO_ROOT/.opencode/team.env"; set +a
  available="$("$OC" models 2>/dev/null)"
  for var in OC_MODEL_RESEARCH OC_MODEL_BACKEND OC_MODEL_DASHBOARD OC_MODEL_TEST OC_MODEL_REVIEW; do
    val="${!var:-}"
    if [[ -z "$val" ]]; then fail "$var is empty (scripts/ai/models.sh)"; continue; fi
    if ! grep -qxF "${val%%#*}" <<<"$available"; then fail "$var=$val is not in opencode models"; continue; fi
    if [[ "$val" == opencode-go/* ]]; then pass "$var=$val"; else warn "$var=$val is not an opencode-go model (may bill another account)"; fi
    # Listed is not the same as usable (account region, plan): --live sends a one-word prompt.
    if [[ "$live" == 1 ]]; then
      reply="$(cd "${TMPDIR:-/tmp}" && "$OC" --standalone run -m "$val" "Reply with exactly the word OK and nothing else." 2>&1 | tail -3)"
      if grep -q 'OK' <<<"$reply" && ! grep -qi 'error' <<<"$reply"; then pass "$var answers live"; else fail "$var=$val does not answer: $(tr '\n' ' ' <<<"$reply" | cut -c1-160)"; fi
    fi
  done
  for impl in OC_MODEL_BACKEND OC_MODEL_DASHBOARD; do
    if [[ -n "${OC_MODEL_REVIEW:-}" && "${OC_MODEL_REVIEW:-}" == "${!impl:-}" ]]; then
      warn "OC_MODEL_REVIEW equals $impl: the first-pass review is not independent"
    fi
  done
else
  fail ".opencode/team.env missing: cp .opencode/team.env.example .opencode/team.env and pick models"
fi

# --- OpenCode agents (loaded exactly the way spawn.sh loads them)
agents="$(cd "$REPO_ROOT" && env "$(opencode_env)" "$OC" --standalone debug agents 2>/dev/null)"
if [[ -z "$agents" ]]; then
  fail "opencode debug agents failed (config error?): run it in $REPO_ROOT to see why"
else
  for r in $ROLES; do
    mode="$(echo "$agents" | "$JQ" -r --arg r "$r" '.[] | select(.id == $r) | .mode')"
    if [[ "$mode" == primary ]]; then
      # Secrets rules must come after every allow (last match wins).
      last="$(echo "$agents" | "$JQ" -r --arg r "$r" '[.[] | select(.id == $r) | .permissions[] | select(.action == "read" and .resource == "*.env")] | last | .effect')"
      if [[ "$last" == deny ]]; then pass "agent $r loads (primary, .env read denied)"; else fail "agent $r: last read *.env rule is '$last', expected deny"; fi
    else
      fail "agent $r: not loaded or mode '$mode' (must be primary)"
    fi
  done
fi

# --- Claude Code agents
for f in "$REPO_ROOT"/.claude/agents/*.md; do
  n="$(sed -n 's/^name: //p' "$f" | head -1)"; m="$(sed -n 's/^model: //p' "$f" | head -1)"
  if [[ -n "$n" && "$m" == opus ]]; then pass "claude agent $n (model: $m)"; else fail "claude agent $f: missing name or model is not opus"; fi
done
if "$JQ" empty "$REPO_ROOT/.claude/settings.json" 2>/dev/null; then pass ".claude/settings.json is valid JSON"; else fail ".claude/settings.json invalid"; fi

# --- scripts
for s in "$REPO_ROOT"/scripts/ai/*.sh; do
  if bash -n "$s" 2>/dev/null; then :; else fail "syntax error in $s"; fi
done
pass "bash -n on scripts/ai/*.sh"

# --- git state
for p in .ai/x .opencode/team.env; do
  if git -C "$REPO_ROOT" check-ignore -q "$p"; then pass "$p is gitignored"; else fail "$p is not gitignored"; fi
done
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  warn "main working tree has uncommitted changes (new worktrees will not contain them)"
fi

echo
if [[ "$fails" == 0 ]]; then echo "doctor: all required checks passed"; else echo "doctor: $fails failure(s)"; fi
[[ "$fails" == 0 ]]
