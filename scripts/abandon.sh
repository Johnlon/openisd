#!/usr/bin/env bash
# Records the decision that a task is abandoned, lands it, and removes the task's worktree and branch (T334, John
# 17 Oct 2026: remove a worktree and branch "if decisions mean it is abandoned").
#
#   bash scripts/abandon.sh T<n> --by <who decided> "<why>"
#
#   1. A task of its own (scripts/new-task.sh) writes into tasks/T<n>.yml: status abandoned, abandoned_by,
#      abandoned_on, abandoned_why, abandoned_tip (the branch's last commit), and lands it with land.sh.
#   2. scripts/land/tidy-branches.sh --only T<n> deletes the task's worktree and branch, local and on origin, with
#      a log line naming the tip. Nothing is archived (John, 17 Oct 2026). A worktree with uncommitted work is kept,
#      and said so; a branch with commits after abandoned_tip is kept.
# Exit 0 done; 1 refused (unknown task, already done or abandoned, landing refused); 4 recorded but something kept.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ID="${1:?usage: abandon.sh T<n> --by <who> \"<why>\"}"; shift
[ "${1:-}" = --by ] && [ -n "${2:-}" ] || { echo "abandon: usage: abandon.sh T<n> --by <who decided> \"<why>\"" >&2; exit 1; }
BY="$2"; WHY="${3:?abandon: say why}"
case "$ID" in T[0-9]*) ;; *) echo "abandon: $ID is not a task id" >&2; exit 1 ;; esac

common="$(git rev-parse --git-common-dir)" || exit 1
main="$(cd "$(dirname "$common")" && pwd)"
g() { git -C "$main" "$@"; }
g fetch -q origin || { echo "abandon: cannot fetch origin" >&2; exit 1; }
# The task file on main; for a task that never landed, the one on its branch (new-task.sh commits it there first).
branch="t${ID#T}"
task="$(g show "origin/main:tasks/$ID.yml" 2> /dev/null || g show "refs/heads/$branch:tasks/$ID.yml" 2> /dev/null \
  || g show "refs/remotes/origin/$branch:tasks/$ID.yml" 2> /dev/null)" \
  || { echo "abandon: no tasks/$ID.yml on origin/main or on branch $branch" >&2; exit 1; }
status="$(sed -n 's/^status: *//p' <<< "$task" | head -n 1)"
case "$status" in done|abandoned) echo "abandon: $ID is already $status" >&2; exit 1 ;; esac

# the branch's last commit, which the decision names
tip="$(g rev-parse -q --verify "refs/heads/$branch" || g rev-parse -q --verify "refs/remotes/origin/$branch")"

# 1. record and land the decision
out="$(cd "$main" && bash scripts/new-task.sh "$BY" "Record that $ID is abandoned: $WHY")" || { echo "abandon: new-task.sh failed" >&2; exit 1; }
rec="$(cut -d' ' -f1 <<< "$out")"; wt="$(cut -d' ' -f2- <<< "$out")"
f="$wt/tasks/$ID.yml"
printf '%s\n' "$task" > "$f"
sed -i '/^status:/d; /^abandoned_by:/d; /^abandoned_on:/d; /^abandoned_why:/d; /^abandoned_tip:/d; /^archived:/d' "$f"
sed -i "/^owner:/a status: abandoned\nabandoned_by: $BY\nabandoned_on: $(date -u +%Y-%m-%d)\nabandoned_why: $WHY\nabandoned_tip: ${tip:-none}" "$f"
sed -i "s|^  - tasks/$rec.yml\$|&\n  - tasks/$ID.yml|" "$wt/tasks/$rec.yml"
sed -i "s|^done_test: .*|done_test: grep -qx 'status: abandoned' tasks/$ID.yml|" "$wt/tasks/$rec.yml"
git -C "$wt" add "tasks/$ID.yml" "tasks/$rec.yml" && git -C "$wt" commit -q -m "$rec: $ID is abandoned ($BY): $WHY" \
  || { echo "abandon: could not commit the decision in $wt" >&2; exit 1; }
(cd "$wt" && bash scripts/land.sh "$rec"); landed=$?
# land.sh exit 4: landed, but the main folder is held; the decision is on main all the same.
[ "$landed" = 0 ] || [ "$landed" = 4 ] || { echo "abandon: landing $rec refused; the decision is not on main (see above)" >&2; exit 1; }

# 2. remove the abandoned task's worktree and branch, then the recording task's own
held="$(bash "$HERE/land/tidy-branches.sh" --only "$ID" "$main" | sed -n 's/^held: //p')"
bash "$HERE/land/tidy-branches.sh" --only "$rec" "$main" > /dev/null
if [ -n "$held" ]; then echo "abandon: $ID recorded, but kept: $held" >&2; exit 4; fi
echo "abandon: $ID is abandoned, recorded by $rec, and its worktree and branch are removed"
