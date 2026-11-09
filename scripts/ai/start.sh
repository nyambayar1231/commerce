#!/usr/bin/env bash
# Starts the team's lead: Claude Code (the orchestrator) in a Herdr terminal at the repo root.
# Running the orchestrator inside Herdr is what lets workers report to it (hc send) and lets it
# wait on them (hc wait --children). Workers are started later by the orchestrator through
# scripts/ai/spawn.sh, one per task; nothing else is started here.
#
#   scripts/ai/start.sh             # new tab "lead" in the Herdr window (space "commerce")
#   scripts/ai/start.sh --headless  # no window: a background hc terminal; then `hc attach lead`
#
# Runs scripts/ai/doctor.sh first and shows its result.
source "$(dirname "$0")/lib.sh"

HC="$(resolve_bin hc)"
JQ="$(resolve_bin jq)"
CLAUDE="$(resolve_bin claude)"

"$REPO_ROOT/scripts/ai/doctor.sh" || echo "(doctor reported problems above; the lead can still start)"
echo

if "$HC" get lead >/dev/null 2>&1; then
  echo "a terminal named 'lead' already exists: hc attach lead"
  exit 0
fi

if [[ "${1:-}" == "--headless" ]]; then
  "$HC" run --bg --keep --outlive-parent --name lead --cwd "$REPO_ROOT" -- "$CLAUDE" >/dev/null
  echo "orchestrator started as terminal 'lead'. Attach with: hc attach lead   (Ctrl+\\ detaches)"
  exit 0
fi

APP="$(resolve_bin herdr-app)"
layout="$("$APP" ls 2>/dev/null)" || die "Herdr window not reachable; open Herdr or use --headless"
space="$(echo "$layout" | "$JQ" -r --arg f "$REPO_ROOT" \
  '[.spaces[] | select(.folder == $f or .name == "commerce")][0].id // empty')"
if [[ -z "$space" ]]; then
  "$APP" do space.new --name commerce --folder "$REPO_ROOT" >/dev/null
  space="$("$APP" ls | "$JQ" -r '[.spaces[] | select(.name == "commerce")][0].id // empty')"
  [[ -n "$space" ]] || die "could not create the Herdr space"
fi
argv="$("$JQ" -cn --arg c "$CLAUDE" '[$c]')"
"$APP" do tab.new --space "$space" --name lead --folder "$REPO_ROOT" --argv "$argv" >/dev/null
echo "orchestrator opened in Herdr: space 'commerce', tab 'lead'."
echo "Give it a task with: \"Follow docs/ai-workflow/orchestrator.md for: <task>\""
