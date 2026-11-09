# Shared helpers for scripts/ai/*.sh. Sourced, never executed directly.
# shellcheck shell=bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Worktrees live next to the repo, never inside it: ../commerce-wt/<name>
WORKTREE_BASE="${COMMERCE_WORKTREE_BASE:-$(dirname "$REPO_ROOT")/commerce-wt}"
AI_DIR="$REPO_ROOT/.ai"   # briefs, evidence, locks (gitignored)

# The worker roles; each is a file in .opencode/agents/<role>.md.
ROLES="backend-researcher backend-implementer dashboard-researcher dashboard-implementer test-debugger code-reviewer security-reviewer"

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

is_role() {
  local r
  for r in $ROLES; do [[ "$r" == "$1" ]] && return 0; done
  return 1
}

# Roles that may edit files. Two writers never share a working directory.
role_writes() {
  case "$1" in
    backend-implementer|dashboard-implementer|test-debugger) return 0 ;;
    *) return 1 ;;
  esac
}

model_var_for_role() {
  case "$1" in
    backend-researcher|dashboard-researcher) echo OC_MODEL_RESEARCH ;;
    backend-implementer|dashboard-implementer) echo OC_MODEL_IMPLEMENT ;;
    test-debugger) echo OC_MODEL_TEST ;;
    code-reviewer|security-reviewer) echo OC_MODEL_REVIEW ;;
    *) return 1 ;;
  esac
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
