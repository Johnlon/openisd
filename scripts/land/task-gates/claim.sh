#!/usr/bin/env bash
# Claim a task: bash scripts/land/task-gates/claim.sh <id>
#
# Sets `status: claimed` in tasks/<id>.yml and writes the id to .task at the clone root (git-ignored;
# check-commit.sh reads it). Refused, exit 1, when
#   - the task file lacks id, owner, status, goal, done_test or files; or
#   - a file in the repo is matched by this task's globs and by those of another CLAIMED task.
# Open tasks may overlap: only a claim reserves files. Globs are git pathspec globs (`:(glob)`).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ID="${1:?usage: claim.sh <task-id>}"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
# shellcheck source=../core/task.sh
. "$HERE/../core/task.sh"

TASK="tasks/$ID.yml"
[ -f "$TASK" ] || { echo "claim: no task file $TASK" >&2; exit 1; }
missing="$(task_missing_fields "$TASK")"
[ -z "$missing" ] || { echo "claim: $TASK lacks: $missing" >&2; exit 1; }

# The tracked files a task's globs match, one per line, sorted.
matched_files() {
  local specs=() glob
  while IFS= read -r glob; do specs+=(":(glob)$glob"); done < <(task_files "$1")
  git ls-files -- "${specs[@]}" | sort -u
}

mine="$(matched_files "$TASK")"
for other in tasks/*.yml; do
  [ "$other" = "$TASK" ] && continue
  [ "$(task_field "$other" status)" = "claimed" ] || continue
  shared="$(comm -12 <(echo "$mine") <(matched_files "$other"))"
  if [ -n "$shared" ]; then
    echo "claim: $ID overlaps claimed task $(task_field "$other" id) on: $(echo "$shared" | head -n 5 | tr '\n' ' ')" >&2
    exit 1
  fi
done

sed -i 's/^status: .*/status: claimed/' "$TASK"
echo "$ID" > .task
echo "claim: $ID claimed"
