#!/usr/bin/env bash
# The commit gate for a claimed task: bash scripts/land/task-gates/check-commit.sh
#
# Run by pre-commit. With a .task at the clone root, every staged path must match a `files:` glob
# of tasks/<id>.yml (git `:(glob)` semantics: ** crosses directories, * does not), or be that task
# file itself. Otherwise exit 1, naming each path. With no .task the commit is outside the task
# process (John's own, say) and is not gated here.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
[ -f .task ] || exit 0
# shellcheck source=../core/task.sh
. "$HERE/../core/task.sh"

ID="$(cat .task)"
TASK="tasks/$ID.yml"
[ -f "$TASK" ] || { echo "check-commit: .task names $ID but $TASK does not exist" >&2; exit 1; }

specs=(":(literal)$TASK")
while IFS= read -r glob; do specs+=(":(glob)$glob"); done < <(task_files "$TASK")

# land.sh's own stamp: a later landing writes `landed: <sha>` into an earlier task's file (T064 step
# 2b). That one-line change to another task file is land.sh's, not the worker's, and passes; any
# other change to a task file outside the allowlist still refuses (T091).
landed_stamp_only() {
  case "$1" in tasks/*.yml) ;; *) return 1 ;; esac
  local lines
  lines="$(git diff --cached -U0 -- "$1" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ')"
  [ -n "$lines" ] && ! printf '%s\n' "$lines" | grep -qvE '^\+landed: [0-9a-f]{7,40}$'
}

outside="$(comm -23 <(git diff --cached --name-only | sort) <(git diff --cached --name-only -- "${specs[@]}" | sort) \
  | while IFS= read -r path; do landed_stamp_only "$path" || echo "$path"; done)"
if [ -n "$outside" ]; then
  echo "check-commit: task $ID may not touch:" >&2
  echo "$outside" | sed 's/^/  /' >&2
  echo "Allowed: $(task_files "$TASK" | tr '\n' ' ')" >&2
  exit 1
fi
