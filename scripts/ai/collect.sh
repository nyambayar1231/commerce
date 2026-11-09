#!/usr/bin/env bash
# Collects independent evidence of what a worker changed, straight from git, so the orchestrator
# never relies on the worker's own summary. Writes .ai/evidence/<name>-<timestamp>.md and prints
# its path.
#
#   scripts/ai/collect.sh <name>              # worktree ../commerce-wt/<name>
#   scripts/ai/collect.sh <name> --cwd <dir>  # any working tree (e.g. this repo)
#   scripts/ai/collect.sh <name> --base <ref> # also list commits since <ref> (default: main)
#
# Read-only: it never stages or changes anything.
source "$(dirname "$0")/lib.sh"

name="${1:-}"
[[ -n "$name" ]] || { sed -n '2,11p' "$0"; exit 2; }
shift
cwd=""; base="main"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cwd) cwd="${2:-}"; shift 2 ;;
    --base) base="${2:-}"; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done
[[ -n "$cwd" ]] || cwd="$WORKTREE_BASE/$name"
[[ -d "$cwd" ]] || die "no such directory: $cwd"
cwd="$(cd "$cwd" && pwd)"

mkdir -p "$AI_DIR/evidence"
out="$AI_DIR/evidence/$name-$(date +%Y%m%d-%H%M%S).md"
g() { git -C "$cwd" "$@"; }

{
  echo "# Evidence: $name"
  echo
  echo "- Directory: \`$cwd\`"
  echo "- Branch: \`$(g rev-parse --abbrev-ref HEAD)\` at \`$(g rev-parse --short HEAD)\`"
  echo "- Collected: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo
  echo "## Commits since $base (workers must not commit; anything here is a finding)"
  echo '```'
  g log --oneline "$base..HEAD" 2>/dev/null || echo "(base $base not found)"
  echo '```'
  echo
  echo "## git status --porcelain"
  echo '```'
  g status --porcelain
  echo '```'
  echo
  echo "## git diff --stat HEAD (tracked files)"
  echo '```'
  g diff --stat HEAD
  echo '```'
  echo
  echo "## git diff HEAD"
  echo '```diff'
  g diff HEAD
  echo '```'
  echo
  echo "## Untracked files (full content)"
  g ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
    echo
    echo "### $f"
    echo '```'
    if [[ "$(basename "$f")" == .env* && "$(basename "$f")" != ".env.example" ]]; then
      echo "(secret file: content not collected)"
    else
      cat "$cwd/$f"
    fi
    echo '```'
  done
  echo
  echo "## Worker report (.ai/report.md, the worker's claim: verify against the above)"
  if [[ -f "$cwd/.ai/report.md" ]]; then cat "$cwd/.ai/report.md"; else echo "(none)"; fi
} > "$out"

echo "$out"
