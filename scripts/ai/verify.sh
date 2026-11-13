#!/usr/bin/env bash
# Runs the project's checks in a working tree and prints a summary with exit codes.
# Workers and the orchestrator use the same script, so results are comparable.
#
#   scripts/ai/verify.sh                 # lint, typecheck, tests, schema/codegen/messages drift (cwd)
#   scripts/ai/verify.sh --quick         # lint + typecheck only
#   scripts/ai/verify.sh --build         # also build every app that has a build task
#   scripts/ai/verify.sh --dir <path>    # check another working tree (e.g. a worktree)
#
# API tests share one commerce_test database, so test runs are serialized across all worktrees
# with a lock in the shared git dir. It does not start Postgres: run `pnpm db:up` first.
source "$(dirname "$0")/lib.sh"

dir="$PWD"; quick=0; build=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) dir="${2:-}"; shift 2 ;;
    --quick) quick=1; shift ;;
    --build) build=1; shift ;;
    *) die "unknown option: $1" ;;
  esac
done
dir="$(cd "$dir" && pwd)"
git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$dir is not a git working tree"
PNPM="$(resolve_bin pnpm)"

summary=()
failed=0
step() {  # step <label> <command...>
  local label="$1"; shift
  echo
  echo "=== $label: $* (in $dir)"
  if (cd "$dir" && "$@"); then
    summary+=("PASS  $label")
  else
    local code=$?
    summary+=("FAIL  $label (exit $code)")
    failed=1
  fi
}

step lint "$PNPM" lint
step typecheck "$PNPM" typecheck

if [[ "$quick" == 0 ]]; then
  lock="$(git -C "$dir" rev-parse --git-common-dir)"
  case "$lock" in /*) ;; *) lock="$dir/$lock" ;; esac
  lock="$lock/commerce-ai-test.lock"
  echo
  echo "=== waiting for the shared test-database lock ($lock)"
  # A lock whose owner process is gone (a run killed with its worker) is stale: take it over.
  # Without an owner file (killed between mkdir and the write) it is stale once a minute old.
  # Two waiters could both see the same stale lock; rare enough for a local dev tool.
  until mkdir "$lock" 2>/dev/null; do
    owner_pid="$(cut -d' ' -f1 "$lock/owner" 2>/dev/null || true)"
    if [[ -n "$owner_pid" ]] && ! kill -0 "$owner_pid" 2>/dev/null; then
      echo "=== removing a stale lock (process $owner_pid is gone)"
      rm -rf "$lock"; continue
    fi
    if [[ -z "$owner_pid" && -n "$(find "$lock" -maxdepth 0 -mmin +1 2>/dev/null)" ]]; then
      echo "=== removing a stale lock without an owner"
      rm -rf "$lock"; continue
    fi
    sleep 2
  done
  echo "$$ $dir" > "$lock/owner"
  trap 'rm -rf "$lock"' EXIT
  # Turn a stop signal into a normal exit so the EXIT trap removes the lock.
  trap 'exit 143' TERM INT HUP
  step test "$PNPM" test
  rm -rf "$lock"; trap - EXIT TERM INT HUP

  # Generated, committed files must match their sources.
  step schema-print "$PNPM" schema:print
  step codegen "$PNPM" codegen
  step extract-messages "$PNPM" extract-messages
  step generated-files-in-sync git -C "$dir" diff --exit-code --stat -- apps/api/schema.graphql 'apps/dashboard/src/graphql/*.generated.ts' apps/dashboard/locale/defaultMessages.json
fi

if [[ "$build" == 1 ]]; then
  step build "$PNPM" build
fi

echo
echo "=== summary ($dir)"
printf '%s\n' "${summary[@]}"
exit "$failed"
