#!/usr/bin/env bash
# Ship one finished task: its branch goes to GitHub as a pull request that merges itself when the checks pass
# (T749, QO481 A, John 10 Nov 2026), and its worktree goes at once.
#
#   bash scripts/ship.sh T<n> [--no-local-check]     run from the task's own worktree
#
#   exit 0  pushed, pull request open with auto-merge, worktree and local branch removed (the branch on GitHub keeps the work)
#   exit 1  a local check is red (nothing pushed), or GitHub refused the push / pull request / auto-merge (nothing removed)
#   exit 2  cannot ship (no task file, no land.conf, not the task's own branch, fetch failed, main folder)
#   exit 3  blocked: the rebase conflicts; it is aborted, the task says status: blocked and why, the branch is
#           pushed, and nothing is removed
#
# Steps: 1 commit everything (nothing discarded; the hooks run), 2 status done, 3 fetch and rebase onto origin/main,
# 3b the task contract (the PR `task` job's check, run locally; a refusal exits 1, nothing pushed), 4 quick local check (lint on the changed files + typecheck; --no-local-check skips), 5 push branch t<n> (the only
# ref this script ever pushes; --force-with-lease against the sha it just read, because a rebase rewrites history),
# 6 open or reuse the pull request, gh pr merge --auto --squash, 7 remove the worktree and local branch once the
# remote branch is the local commit.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
# shellcheck source=/dev/null
. "$HERE/lib/main-folder.sh"
refuse_in_main_folder ship
if [ -f "$HERE/land.conf" ]; then CONF="$HERE/land.conf"; else CONF="$ROOT/land.conf"; fi
[ -f "$CONF" ] || { echo "ship: no land.conf in $ROOT" >&2; exit 2; }
# shellcheck source=/dev/null
. "$HERE/paths.sh"
# shellcheck source=/dev/null
. "$HERE/land/pr-title.sh"
# shellcheck source=/dev/null
. "$CONF"
# shellcheck source=/dev/null
. "$HERE/land/core/task.sh"
# shellcheck source=/dev/null
. "$HERE/lib/ts-log.sh"
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"

LOCAL_CHECK=1
ID=""
for arg in "$@"; do
  case "$arg" in
    --no-local-check) LOCAL_CHECK="" ;;
    T[0-9]*) ID="$arg" ;;
    *) echo "usage: ship.sh T<n> [--no-local-check]" >&2; exit 2 ;;
  esac
done
[ -n "$ID" ] || { echo "usage: ship.sh T<n> [--no-local-check]" >&2; exit 2; }
BRANCH="$(printf '%s' "$ID" | tr 'T' 't')"
TASK="tasks/$ID.yml"
[ -f "$TASK" ] || { echo "ship: no task file $TASK" >&2; exit 2; }
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
[ "$CURRENT" = "$BRANCH" ] || { echo "ship: REFUSED: this worktree is on '$CURRENT', not $BRANCH; ship pushes only the task's own branch" >&2; exit 2; }

run_start "ship-$ID"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ship.XXXXXX")"
trap 'status=$?; run_end "ship-$ID" "$status" 2>/dev/null || true; rm -rf "$WORK"; exit "$status"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Every network call is bounded so a stall cannot hang the shipper.
NET_TIMEOUT_S="${LAND_NET_TIMEOUT_S:-120}"
net() {
  timeout -k 5 "$NET_TIMEOUT_S" "$@"; local s=$?
  if [ "$s" = 124 ] || [ "$s" = 137 ]; then echo "ship: $1 $2 timed out after ${NET_TIMEOUT_S}s (the network stalled)" >&2; fi
  return "$s"
}
GH="${LAND_GH:-gh}"
REPO="${ACTIONS_REPO:?ship: ACTIONS_REPO is not set in land.conf}"

# push_branch: the only push. It names the task's own branch and nothing else.
push_branch() {
  local remote_sha
  remote_sha="$(net git ls-remote origin "refs/heads/$BRANCH" | cut -f1)" || return 1
  net git push -q --force-with-lease="refs/heads/$BRANCH:$remote_sha" origin "HEAD:refs/heads/$BRANCH"
}
goal="$(task_field "$TASK" goal)"

# 1. commit everything: the files git reports changed, new or deleted, by name
mapfile -d '' files < <(git ls-files -m -o -d --exclude-standard -z)
if [ "${#files[@]}" -gt 0 ]; then
  git add -A -- "${files[@]}" || { echo "ship: git add failed" >&2; exit 2; }
fi
if ! git diff --cached --quiet; then
  git commit -q -m "(auto) $ID${goal:+: $goal}" || { echo "ship: commit failed" >&2; exit 2; }
fi

# 2. status done
case "$(task_field "$TASK" status)" in
  open|claimed|todo|blocked)
    task_mark_done "$TASK"
    git add -- "$TASK" && git commit -q -m "(auto) $ID: status done" || { echo "ship: status commit failed" >&2; exit 2; }
    ;;
esac

# 3. fetch, rebase onto origin/main
net git fetch -q origin main || { echo "ship: fetch failed" >&2; exit 2; }
if ! git merge-base --is-ancestor origin/main HEAD; then
  if ! git rebase -q origin/main > "$WORK/rebase.out" 2>&1; then
    conflicts="$(git diff --name-only --diff-filter=U | tr '\n' ' ')"
    git rebase --abort
    task_mark_blocked "$TASK" "rebase onto origin/main conflicts in: ${conflicts:-unknown files}"
    git add -- "$TASK" && git commit -q -m "(auto) $ID: blocked, rebase onto origin/main conflicts"
    push_branch || echo "ship: could not push $BRANCH" >&2
    echo "ship: BLOCKED $ID: rebase conflicts in ${conflicts:-unknown files}; branch $BRANCH is pushed, nothing removed" >&2
    exit 3
  fi
fi

# 3b. the task contract, exactly as the pull request's `task` job runs it (T758): locked hashes, task id and owner,
# status, gate files, and every changed file inside the task's `files` allowlist. A refusal names the files and
# nothing is pushed. The board file is not read (a GitHub runner has none), so the local verdict equals CI's.
contract="$(GATE_FILES="${GATE_FILES:-}" QUESTIONS_FILE=/nonexistent bash "$HERE/land/check-task-contract.sh" "$ID" origin/main HEAD --pr 2>&1)" || {
  printf '%s\n' "$contract" >&2
  echo "ship: the task contract refuses $ID (the pull request's task check would fail); nothing pushed. Offending files are listed above" >&2
  exit 1
}

# 4. quick local check: lint on the changed files, typecheck
if [ -n "$LOCAL_CHECK" ]; then
  mapfile -t changed < <(git diff --name-only --diff-filter=d origin/main HEAD)
  if [ -n "${LINT_CMD:-}" ] && [ "${#changed[@]}" -gt 0 ]; then
    bash -c "$LINT_CMD \"\$@\"" ship "${changed[@]}" > "$WORK/check.out" 2>&1 \
      || { tail -30 "$WORK/check.out" >&2; echo "ship: lint failed; nothing pushed" >&2; exit 1; }
  fi
  if [ -n "${TYPECHECK_CMD:-}" ]; then
    bash -c "$TYPECHECK_CMD" > "$WORK/check.out" 2>&1 \
      || { tail -30 "$WORK/check.out" >&2; echo "ship: typecheck failed; nothing pushed" >&2; exit 1; }
  fi
fi

# 5. push the task's own branch, then confirm the remote holds this commit
push_branch || { echo "ship: push of $BRANCH failed; nothing removed" >&2; exit 1; }
local_sha="$(git rev-parse HEAD)"
remote_sha="$(net git ls-remote origin "refs/heads/$BRANCH" | cut -f1)"
[ "$remote_sha" = "$local_sha" ] || { echo "ship: origin/$BRANCH is '$remote_sha', not $local_sha; nothing removed" >&2; exit 1; }

# 6. pull request with auto-merge (squash)
{ task_field "$TASK" release_note | grep -v '^internal$'; echo; echo "Opened by scripts/ship.sh for $ID: $goal"; } > "$WORK/body.md"
title="$(pr_title "(auto) $ID" "$goal")"
pr="$(ACTIONS_REPO="$REPO" LAND_GH="$GH" bash "$HERE/land/pr.sh" open "$ID" "$BRANCH" "$title" "$WORK/body.md")" \
  || { echo "ship: no pull request; branch $BRANCH is on GitHub, nothing removed" >&2; exit 1; }
net "$GH" pr merge "$pr" --repo "$REPO" --auto --squash > "$WORK/merge.out" 2>&1 \
  || { tail -3 "$WORK/merge.out" >&2; echo "ship: auto-merge not set on pull request #$pr; nothing removed" >&2; exit 1; }

# 7. the worktree and the local branch go; the branch on GitHub holds the work
main_dir="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
cd "$main_dir" || exit 1
git worktree remove --force "$ROOT" && git branch -q -D "$BRANCH" || { echo "ship: pushed, but could not remove $ROOT / $BRANCH" >&2; exit 1; }
echo "ship: $ID shipped: https://github.com/$REPO/pull/$pr (auto-merge on; worktree removed)"
