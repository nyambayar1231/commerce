#!/usr/bin/env bash
# Shows the AI workers started by scripts/ai/spawn.sh (Herdr terminals labelled commerce.ai=1),
# plus the worktrees. Other Herdr terminals are left out.
#
#   scripts/ai/status.sh
source "$(dirname "$0")/lib.sh"

HC="$(resolve_bin hc)"
JQ="$(resolve_bin jq)"

printf '%-6s %-24s %-22s %-6s %-9s %-5s %s\n' ADDR NAME ROLE WRITES STATUS TURN CWD
for addr in $("$HC" ls --all --json | "$JQ" -r '.terminals[].address'); do
  info="$("$HC" get --json "$addr" 2>/dev/null || true)"
  [[ -n "$info" ]] || continue
  [[ "$(echo "$info" | "$JQ" -r '.labels["commerce.ai"] // ""')" == "1" ]] || continue
  echo "$info" | "$JQ" -r '[
      .address, (.name // "-"), .labels["commerce.ai.role"], .labels["commerce.ai.writes"],
      (if .state == "finished" then "finished" else (.status.state // "?") end),
      (.turn | tostring), .cwd
    ] | @tsv' | while IFS=$'\t' read -r a n r w s t c; do
      printf '%-6s %-24s %-22s %-6s %-9s %-5s %s\n' "$a" "$n" "$r" "$w" "$s" "$t" "$c"
    done
done

echo
echo "Worktrees:"
git -C "$REPO_ROOT" worktree list
