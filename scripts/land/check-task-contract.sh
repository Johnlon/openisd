#!/usr/bin/env bash
# The task-contract gate, shared by scripts/land.sh and the pull request check (.github/workflows/pr.yml, T749):
#
#   bash scripts/land/check-task-contract.sh <task-id> <base> <head> [--pr [<other-task-id>...]]      run from the repo root, <head> checked out
#
# One copy of: the task id is this task's own (another owner on <base> refuses), locked files match their hash,
# done_test and locked entries are what <base> has, a file another task locks is not changed without its hash,
# and a gate file (GATE_FILES, land.conf) changes only with `gates_approved: QO<n>` in the task file.
# Task files are never deleted or renamed (T767). --pr adds what a pull request needs and land.sh never asked: the task file is well formed and its status is
# valid, and every changed file matches the task's `files:` allowlist (scripts/land/task-gates/check-commit.sh).
#
# A pull request may carry several tasks (T762): run this once per task, naming the others after --pr; a file may then
# be in any of their allowlists, and gates_approved may sit on any one of them.
#
# Exit 0 clean. Exit 1: the first problem, on stdout as `REFUSE<TAB><gate><TAB><detail>` (land.sh turns that
# into its refusal); more lines may follow. The board check of gates_approved reads QUESTIONS_FILE (land.conf);
# where that file does not exist (a GitHub runner) the field must still be a well-formed QO<n>.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$DIR/core" ]; then CORE="$DIR/core"; else CORE="$DIR/land/core"; fi
ID="${1:?usage: check-task-contract.sh <task-id> <base> <head> [--pr [<other-task-id>...]]}"; BASE="${2:?}"; HEAD_REF="${3:?}"
PR_MODE=""; [ "${4:-}" = "--pr" ] && PR_MODE=1
CO_TASKS=("${@:5}")   # the other tasks the same pull request carries (T762): a file may be in any carried task's allowlist
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
# shellcheck source=./core/task.sh
. "$CORE/task.sh"
TASK="tasks/$ID.yml"

fail() { printf 'REFUSE\t%s\t%s\n' "$1" "$2"; exit 1; }
[ -f "$TASK" ] || fail task-id "no task file $TASK"

if [ -z "${GATE_FILES:-}" ]; then
  # shellcheck source=/dev/null
  [ -f "$ROOT/scripts/paths.sh" ] && . "$ROOT/scripts/paths.sh"; set +u
  # shellcheck source=/dev/null
  [ -f "$ROOT/land.conf" ] && . "$ROOT/land.conf"
fi

if [ -n "$PR_MODE" ]; then
  # `why:` is asked of a task file this pull request adds or really changes; a hash-only or status-only edit of an old one is exempt (T767)
  why_flag=""; task_old_edit_exempt "$BASE" "$HEAD_REF" "$TASK" || why_flag=--why
  missing="$(task_missing_fields "$TASK" $why_flag)"
  [ -z "$missing" ] || fail task-file "$TASK lacks: $missing"
  if [ -n "$why_flag" ] && [ -z "$missing" ]; then
    why_problem="$(task_why_problem "$TASK")"; [ -z "$why_problem" ] || fail task-file "$TASK: $why_problem"
  fi
  case "$(task_field "$TASK" status)" in open|claimed|todo|blocked|done) ;; *) fail task-file "$TASK has status '$(task_field "$TASK" status)'; it must be open, claimed, todo, blocked or done" ;; esac
fi

# task files are the record of why each change was made, so none is deleted or renamed (T767, QO528)
gone="$(git diff --no-renames --name-only --diff-filter=D "$BASE" "$HEAD_REF" -- ':(glob)tasks/T*.yml' | tr '\n' ' ')"
[ -z "$gone" ] || fail task-deleted "task files are never deleted or renamed: ${gone}"

# the id is this task's own: a tasks/<id>.yml already on base under another owner is another task's (17 Oct 2026, T321)
main_owner="$(git show "$BASE:$TASK" 2> /dev/null | sed -n 's/^owner: *//p' | head -n 1)"
if [ -n "$main_owner" ] && [ "$main_owner" != "$(task_field "$TASK" owner)" ]; then
  fail task-id "$TASK on main is $main_owner's task ($(git show "$BASE:$TASK" | sed -n 's/^goal: *//p' | head -n 1)); this branch would overwrite it. Claim a fresh id with scripts/new-task.sh and move the work there"
fi

# the task's contract is intact
while read -r path hash; do
  [ -n "$path" ] || continue
  actual="$(git show "$HEAD_REF:$path" 2> /dev/null | sha256sum | cut -d' ' -f1)"
  [ "$actual" = "$hash" ] || fail locked "$path changed (locked by $ID)"
done < <(task_locked "$TASK")
if git cat-file -e "$BASE:$TASK" 2> /dev/null; then
  work="$(mktemp)"; trap 'rm -f "$work"' EXIT
  git show "$BASE:$TASK" > "$work"
  [ "$(task_contract "$work")" = "$(task_contract "$TASK")" ] || fail done_test "$TASK changed its done_test or locked entries since main"
fi
# A file this branch changed that another task locks needs that task's hash updated in the same landing (T235, T249, T261).
changed="$(git diff --name-only "$BASE" "$HEAD_REF")"
for other in tasks/*.yml; do
  [ "$other" = "$TASK" ] && continue
  while read -r path hash; do
    [ -n "$path" ] && [ "$hash" != pending ] && grep -qxF "$path" <<< "$changed" || continue
    actual="$(git show "$HEAD_REF:$path" 2> /dev/null | sha256sum | cut -d' ' -f1)"
    [ "$actual" = "$hash" ] || fail locked "$path changed (locked by $other); update its sha256 there in this landing"
  done < <(task_locked "$other")
done

# gate files: John approves changes to them (30 Oct 2026). An unset or empty GATE_FILES refuses: deleting the list must not switch the check off.
[ -n "${GATE_FILES:-}" ] || fail gates "GATE_FILES is not set in land.conf"
gate_hits="$(printf '%s\n' "$changed" | python3 -c '
import fnmatch, sys
globs = sys.argv[1:]
for line in sys.stdin.read().split("\n"):
    if line and any(fnmatch.fnmatchcase(line, g) for g in globs):
        print(line)
' $GATE_FILES | tr '\n' ' ')"
if [ -n "$gate_hits" ]; then
  gates_qo="$(task_field "$TASK" gates_approved)"; gates_id="$ID"
  # a pull request carrying several tasks needs the approval on one of them (T762): the first that has it speaks for the change
  for co in "${CO_TASKS[@]}"; do
    [ -n "$gates_qo" ] && break
    gates_qo="$(task_field "tasks/$co.yml" gates_approved)"; [ -z "$gates_qo" ] || gates_id="$co"
  done
  gates_msg="gate files changed: ${gate_hits}; a gate file changed; John approves gate changes: put the change to John as a board item and add gates_approved: QO<n> to the task once he has answered"
  [ -n "$gates_qo" ] || fail gates "$gates_msg"
  printf '%s' "$gates_qo" | grep -Eq '^QO[0-9]+$' || fail gates "gates_approved '$gates_qo' is not QO<n>"
  if [ -f "${QUESTIONS_FILE:-/nonexistent}" ]; then
    # exit 0 only when the item with id == gates_approved names this task and has a thread entry by John
    python3 - "$QUESTIONS_FILE" "$gates_qo" "$gates_id" <<'PY' || fail gates "$gates_msg (board item $gates_qo has no answer by John in $QUESTIONS_FILE)"
import re, sys, yaml
path, qo, task_id = sys.argv[1], sys.argv[2], sys.argv[3]
names_task = re.compile(r"(?<![A-Za-z0-9])" + re.escape(task_id) + r"(?![A-Za-z0-9])")
with open(path) as f:
    doc = yaml.safe_load(f)
items = doc.get("questions", []) if isinstance(doc, dict) else doc
for item in items or []:
    if isinstance(item, dict) and item.get("id") == qo:
        text = str(item.get("title", "")) + "\n" + str(item.get("body", ""))
        sys.exit(0 if names_task.search(text) and any(isinstance(t, dict) and t.get("by") == "John" for t in item.get("thread") or []) else 1)
sys.exit(1)
PY
  elif [ -z "$PR_MODE" ]; then
    fail gates "$gates_msg (board file ${QUESTIONS_FILE:-unset} not found)"
  fi
fi

if [ -n "$PR_MODE" ]; then
  out="$(bash "$CORE/../task-gates/check-commit.sh" "$BASE" "$HEAD_REF" "$ID" "${CO_TASKS[@]}" 2>&1)" || fail files "$(printf '%s' "$out" | tr '\n' ' ')"
fi
exit 0
