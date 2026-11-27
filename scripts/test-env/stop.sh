#!/usr/bin/env bash
# Stops the QA environment started by scripts/test-env/start.sh: each saved PID and its children
# (pnpm and vite run child processes). Never anything else (the owner's dev servers keep running).
set -uo pipefail

DIR="$(cd "$(dirname "$0")/../.." && pwd)/.ai/test-env"

stop_tree() { # <pid>
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do stop_tree "$child"; done
  kill "$1" 2>/dev/null
}

stopped=0
for pidfile in "$DIR"/*.pid; do
  [ -e "$pidfile" ] || continue
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    stop_tree "$pid"
    echo "stopped $(basename "$pidfile" .pid) ($pid)"
    stopped=$((stopped + 1))
  fi
  rm -f "$pidfile"
done
echo "QA environment: $stopped process(es) stopped"
