# Shared helpers for scripts/ai/*.sh. Sourced, never executed directly.
# shellcheck shell=bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Worktrees live next to the repo, never inside it: ../commerce-wt/<name>
WORKTREE_BASE="${COMMERCE_WORKTREE_BASE:-$(dirname "$REPO_ROOT")/commerce-wt}"
AI_DIR="$REPO_ROOT/.ai"   # briefs, evidence, locks (gitignored)

# The one worker role: .opencode/agents/implementer.md (the lead reviews; there are no other agents).
ROLE="implementer"

die() { echo "error: $*" >&2; exit 1; }

# Absolute path of a CLI. Programs started by `hc run <cmd>` do not get the login shell's PATH,
# so everything handed to hc must be absolute (verified: `env opencode` → exit 127).
resolve_bin() {
  local name="$1" p=""
  p="$(command -v "$name" 2>/dev/null || true)"
  if [[ -z "$p" ]]; then
    for dir in "$HOME/.opencode/bin" "$HOME/.local/bin" /opt/homebrew/bin /usr/local/bin; do
      if [[ -x "$dir/$name" ]]; then p="$dir/$name"; break; fi
    done
  fi
  [[ -n "$p" ]] || die "$name not found (install it or add it to PATH)"
  echo "$p"
}

# Loads .opencode/team.env (model choices). Not committed: see .opencode/team.env.example.
load_team_env() {
  local f="$REPO_ROOT/.opencode/team.env"
  [[ -f "$f" ]] || die "missing .opencode/team.env: cp .opencode/team.env.example .opencode/team.env, then pick models with scripts/ai/models.sh"
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

# Every opencode call for a worker uses the main repo's agent definitions, even inside a
# worktree whose checkout predates them (verified: OPENCODE_CONFIG_DIR loads agents from it).
opencode_env() {
  echo "OPENCODE_CONFIG_DIR=$REPO_ROOT/.opencode"
}
