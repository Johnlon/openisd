#!/usr/bin/env bash
# Drops a task on a decision: deletes its worktree and its branch, local and on origin, and logs one line (T355,
# John 17 Oct 2026: "don't commit abandoned"; dropped code is not kept either).
#
#   bash scripts/abandon.sh T<n> --by <who decided> "<why>"
#
#   - Nothing is committed or landed: main does not move, the task needs no task of its own, and tasks/T<n>.yml is
#     not edited. The decision is the authority (--by names who made it).
#   - The task's worktree is removed even with uncommitted work, and the branch is deleted (local and origin) even
#     with commits after its tip. Nothing is archived (John, 17 Oct 2026: no archive refs).
#   - The record is one line in the tidy log (TIDY_LOG, default <main>/build/test-logs/tidy-branches.log), the log
#     scripts/land/tidy-branches.sh writes: UTC time, who, why, the branch tip sha, the task's goal, and whether
#     uncommitted work or later commits went with it. There is no second store.
# Exit 0 done; 1 refused (bad arguments, unknown task, task already done, git could not be read or written).
set -uo pipefail

ID="${1:?usage: abandon.sh T<n> --by <who> \"<why>\"}"; shift
[ "${1:-}" = --by ] && [ -n "${2:-}" ] || { echo "abandon: usage: abandon.sh T<n> --by <who decided> \"<why>\"" >&2; exit 1; }
BY="$2"; WHY="${3:?abandon: say why}"
case "$ID" in T[0-9]*) ;; *) echo "abandon: $ID is not a task id" >&2; exit 1 ;; esac

common="$(cd "$(git rev-parse --git-common-dir)" && pwd)" || exit 1
main="$(dirname "$common")"
LOG="${TIDY_LOG:-$main/build/test-logs/tidy-branches.log}"
mkdir -p "$(dirname "$LOG")"
log() { printf '%s tidy-branches: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" | tee -a "$LOG"; }
g() { git -C "$main" "$@"; }

# the same lock as tidy-branches.sh, so the two never remove at once
exec 8> "$common/tidy-branches.lock" || { echo "abandon: cannot open $common/tidy-branches.lock" >&2; exit 1; }
flock -w 120 8 || { echo "abandon: another run is tidying" >&2; exit 1; }
g fetch -q --prune origin || { echo "abandon: cannot fetch origin" >&2; exit 1; }

# The task file on main; for a task that never landed, the one on its branch.
branch="t${ID#T}"
task="$(g show "origin/main:tasks/$ID.yml" 2> /dev/null || g show "refs/heads/$branch:tasks/$ID.yml" 2> /dev/null \
  || g show "refs/remotes/origin/$branch:tasks/$ID.yml" 2> /dev/null)" \
  || { echo "abandon: no tasks/$ID.yml on origin/main or on branch $branch" >&2; exit 1; }
[ "$(sed -n 's/^status: *//p' <<< "$task" | head -n 1)" = done ] && { echo "abandon: $ID is already done" >&2; exit 1; }
goal="$(sed -n 's/^goal: *//p' <<< "$task" | head -n 1)"

tip="$(g rev-parse -q --verify "refs/heads/$branch" || g rev-parse -q --verify "refs/remotes/origin/$branch" || true)"
wt=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*) cur="${line#worktree }" ;;
    "branch refs/heads/$branch") wt="$cur" ;;
  esac
done < <(g worktree list --porcelain)
[ "$wt" = "$main" ] && { echo "abandon: branch $branch is checked out in the main folder; not touching it" >&2; exit 1; }

note=""
if [ -n "$wt" ]; then
  [ -n "$(git -C "$wt" status --porcelain --untracked-files=all 2> /dev/null)" ] && note="$note; uncommitted work discarded"
  g worktree remove --force --force "$wt" || { echo "abandon: could not remove worktree $wt" >&2; exit 1; }
fi
g worktree prune
if g rev-parse -q --verify "refs/heads/$branch" > /dev/null; then
  g branch -q -D "$branch" || { echo "abandon: could not delete $branch" >&2; exit 1; }
fi
if g rev-parse -q --verify "refs/remotes/origin/$branch" > /dev/null; then
  g push -q origin --delete "$branch" || { echo "abandon: could not delete origin/$branch" >&2; exit 1; }
fi
log "abandoned $ID by $BY on $(date -u +%Y-%m-%d): $WHY; branch $branch tip ${tip:0:10}; worktree ${wt:-none}$note; goal: $goal"
echo "abandon: $ID is abandoned; its worktree and branch are deleted and the decision is in $LOG"
