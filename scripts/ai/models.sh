#!/usr/bin/env bash
# Lists the models OpenCode can use with your OpenCode Go subscription, and the current choice
# per role from .opencode/team.env.
#
#   scripts/ai/models.sh          # opencode-go models only
#   scripts/ai/models.sh --all    # every provider OpenCode knows (other providers may bill elsewhere)
source "$(dirname "$0")/lib.sh"

OC="$(resolve_bin opencode)"

if [[ "${1:-}" == "--all" ]]; then
  "$OC" models
else
  echo "# OpenCode Go models (from \`opencode models\`):"
  "$OC" models | grep '^opencode-go/' || echo "(none: is OpenCode Go authenticated? run \`opencode auth list\`)"
fi

echo
echo "# Current selection (.opencode/team.env):"
if [[ -f "$REPO_ROOT/.opencode/team.env" ]]; then
  grep -E '^OC_MODEL_[A-Z]+=' "$REPO_ROOT/.opencode/team.env" || echo "(no OC_MODEL_* lines)"
else
  echo "(missing: cp .opencode/team.env.example .opencode/team.env)"
fi
