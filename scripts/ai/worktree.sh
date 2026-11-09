#!/usr/bin/env bash
# Git worktrees for parallel writers: one worktree per writing worker, so two agents never edit
# the same files. Worktrees live in ../commerce-wt/<name> on branch ai/<name>.
#
#   scripts/ai/worktree.sh add <name> [<base-ref>]   # base defaults to HEAD; runs pnpm install
#   scripts/ai/worktree.sh add <name> --no-install
#   scripts/ai/worktree.sh path <name>
#   scripts/ai/worktree.sh ls
#   scripts/ai/worktree.sh rm <name>                 # refuses if it has uncommitted changes
#
# Nothing here commits, merges or deletes branches. Bringing a reviewed change back into main
# is the owner's decision (see docs/ai-workflow/README.md, "Landing a change").
source "$(dirname "$0")/lib.sh"

cmd="${1:-}"; name="${2:-}"

valid_name() { [[ "$1" =~ ^[a-z0-9][a-z0-9_-]{0,31}$ ]] || die "name must be 1-32 chars of a-z 0-9 - _"; }

case "$cmd" in
  add)
    [[ -n "$name" ]] || die "usage: worktree.sh add <name> [<base-ref>] [--no-install]"
    valid_name "$name"
    base="HEAD"; install=1
    for arg in "${@:3}"; do
      if [[ "$arg" == "--no-install" ]]; then install=0; else base="$arg"; fi
    done
    dir="$WORKTREE_BASE/$name"
    [[ ! -e "$dir" ]] || die "$dir already exists"

    if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
      echo "warning: the main working tree has uncommitted changes. They are NOT in the new"
      echo "         worktree, which starts from '$base'. Commit first if the task depends on them."
    fi

    mkdir -p "$WORKTREE_BASE"
    git -C "$REPO_ROOT" worktree add -b "ai/$name" "$dir" "$base"

    # Keep worker reports out of git in every worktree (shared, local-only exclude file).
    exclude="$(git -C "$REPO_ROOT" rev-parse --git-common-dir)/info/exclude"
    case "$exclude" in /*) ;; *) exclude="$REPO_ROOT/$exclude" ;; esac
    mkdir -p "$(dirname "$exclude")"
    grep -qxF '.ai/' "$exclude" 2>/dev/null || echo '.ai/' >> "$exclude"

    # Local Docker defaults only (.env.example). The real .env is never copied.
    if [[ -f "$dir/.env.example" && ! -e "$dir/.env" ]]; then
      cp "$dir/.env.example" "$dir/.env"
      echo "created $dir/.env from .env.example (local docker-compose defaults)"
    fi

    if [[ "$install" == 1 ]]; then
      (cd "$dir" && "$(resolve_bin pnpm)" install --frozen-lockfile --prefer-offline)
    fi
    echo "$dir"
    ;;
  path)
    valid_name "$name"; echo "$WORKTREE_BASE/$name" ;;
  ls)
    git -C "$REPO_ROOT" worktree list ;;
  rm)
    valid_name "$name"
    dir="$WORKTREE_BASE/$name"
    [[ -d "$dir" ]] || die "no worktree at $dir"
    # Worker files (.ai/, .env from .env.example) are ignored and do not block removal;
    # real changes do.
    if [[ -n "$(git -C "$dir" status --porcelain)" ]]; then
      die "$dir has uncommitted changes; review or discard them first (git -C $dir status)"
    fi
    git -C "$REPO_ROOT" worktree remove --force "$dir"
    echo "removed $dir (branch ai/$name kept; delete it yourself with: git branch -D ai/$name)"
    ;;
  *)
    sed -n '2,13p' "$0"; exit 2 ;;
esac
