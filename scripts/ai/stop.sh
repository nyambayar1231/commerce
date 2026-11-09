#!/usr/bin/env bash
# Ends AI workers started by scripts/ai/spawn.sh: kills the program and removes the terminal.
# Only touches Herdr terminals labelled commerce.ai=1, never the owner's other terminals, and
# never stops the Herdr core. Worktrees and their changes are kept (scripts/ai/worktree.sh rm).
#
#   scripts/ai/stop.sh <name>   # one worker
#   scripts/ai/stop.sh --all    # every commerce.ai worker
source "$(dirname "$0")/lib.sh"

HC="$(resolve_bin hc)"
JQ="$(resolve_bin jq)"
target="${1:-}"
[[ -n "$target" ]] || { sed -n '2,8p' "$0"; exit 2; }

stop_one() {
  local t="$1" info
  info="$("$HC" get --json "$t" 2>/dev/null)" || { echo "no terminal $t"; return 0; }
  if [[ "$(echo "$info" | "$JQ" -r '.labels["commerce.ai"] // ""')" != "1" ]]; then
    echo "skipping $t: not started by scripts/ai/spawn.sh"
    return 0
  fi
  if [[ "$(echo "$info" | "$JQ" -r '.state')" == "live" ]]; then "$HC" kill "$t" >/dev/null || true; fi
  "$HC" rm "$t" >/dev/null 2>&1 || true
  echo "stopped $t ($(echo "$info" | "$JQ" -r '.name // "-"'))"
}

if [[ "$target" == "--all" ]]; then
  for addr in $("$HC" ls --all --json | "$JQ" -r '.terminals[].address'); do
    labels="$("$HC" get --json "$addr" 2>/dev/null | "$JQ" -r '.labels["commerce.ai"] // ""' || true)"
    [[ "$labels" == "1" ]] && stop_one "$addr"
  done
  exit 0
fi
stop_one "$target"
