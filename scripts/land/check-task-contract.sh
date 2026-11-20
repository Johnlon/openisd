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

# land.conf is read as data, never sourced (T934 review 3, Codex 19 Nov 2026): the proposed land.conf is the change's own
# file, and sourcing it would run the change's shell in the check that polices it. conf_value <rev> <NAME>: NAME's value
# there, in any form land.conf uses: NAME="v", NAME='v' or NAME=v (QUESTIONS_FILE is unquoted).
# A land.conf that cannot be read fails the read (exit 1), never answers "unset" (T934 review 6).
conf_value() {
  local text
  text="$(git show "$1:land.conf" 2> /dev/null)" || return 1
  printf '%s\n' "$text" | sed -n -e "s/^$2=\"\(.*\)\"[[:space:]]*\$/\1/p" -e "s/^$2='\(.*\)'[[:space:]]*\$/\1/p" \
    -e "s/^$2=\([^\"'[:space:]][^[:space:]]*\)[[:space:]]*\$/\1/p" | head -n 1
}
# GATE_FILES and QUESTIONS_FILE from the environment win (land.sh and ship.sh read their own land.conf); else the proposed
# land.conf's GATE_FILES and the BASE land.conf's QUESTIONS_FILE (a change cannot point the check at a board file of its own).
gate_files_from_env="${GATE_FILES:+1}"
[ -n "${GATE_FILES:-}" ] || GATE_FILES="$(conf_value "$HEAD_REF" GATE_FILES)" || fail gates "cannot read land.conf at $HEAD_REF"
[ -n "${QUESTIONS_FILE:-}" ] || QUESTIONS_FILE="$(conf_value "$BASE" QUESTIONS_FILE)" || fail gates "cannot read land.conf at the base $BASE"
# The protected list is the BASE revision's (T934 review 2, Codex 19 Nov 2026): a change cannot unprotect a file by editing
# its own land.conf. The proposed list is added to it, so a change that protects more is held to more.
head_gate_files="${GATE_FILES:-}"
# Read from land.conf, the base's list fails closed: unreadable or empty, the check refuses rather than trust the proposed list alone.
if [ -z "$gate_files_from_env" ]; then
  base_gate_files="$(conf_value "$BASE" GATE_FILES)" || fail gates "cannot read land.conf at the base $BASE"
  [ -n "${base_gate_files//[[:space:]]/}" ] || fail gates "the base's land.conf ($BASE) sets no GATE_FILES"   # empty or only spaces: no pattern
else
  base_gate_files="$(conf_value "$BASE" GATE_FILES 2> /dev/null)" || base_gate_files=""
fi
GATE_FILES="$base_gate_files ${GATE_FILES:-}"

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
# A done_test must not pick ONE test out of a test file this change touched (T785; T765 passed with a failing test file
# because its done_test ran a single method). Refused selectors: unittest Class or Class.method after the file's module
# name, pytest ::, -k, vitest -t, --testNamePattern, --test-name-pattern, --grep/-g. Not seen (accepted): a selector inside a
# wrapper script or environment variable. A touched test file that adds `.only(` is refused too.
dt_problem="$(task_done_test_problem "$(task_field "$TASK" done_test)")"
[ -z "$dt_problem" ] || fail done_test "$TASK: $dt_problem"
if [ -n "$PR_MODE" ]; then
  dt="$(task_field "$TASK" done_test)"
  while read -r f; do
    case "$f" in *_test.*|*.test.*|*.spec.*|*/test_*.py) ;; *) continue ;; esac
    stem="$(basename "${f%.*}")"
    # the whole diff is read before it is searched: `git diff | grep -q` leaves at the first match, git dies of SIGPIPE and
    # pipefail answers "no .only(" for a long diff (T833). A diff that cannot be read refuses.
    file_diff="$(git diff "$BASE" "$HEAD_REF" -- "$f")" || { fail done_test "cannot read the diff of $f"; continue; }
    if grep -Eq '^\+.*\.only\(' <<< "$file_diff"; then
      fail done_test "$f adds .only(, which runs one test and hides the rest"
    fi
    grep -qwF "$stem" <<< "$dt" || continue
    sel='::| -k[= ]| -k[A-Za-z]|( -k| -t| -g)$| -t[= ]| -g[= ]|testNamePattern|test-name-pattern|--grep'
    if grep -Eq "$sel" <<< "$dt" || grep -Eq "(^|[ .])${stem}\.[A-Za-z0-9_]+" <<< "$dt"; then
      fail done_test "$TASK's done_test selects a single test in $f, a test file this change touched; run the whole file (a failing test in it must block the pull request)"
    fi
  done < <(git diff --name-only --diff-filter=ACMR "$BASE" "$HEAD_REF")
fi
# A file this branch changed that another task locks warns (T786, QO512): refusing here blocked fixes to process tests; the landing task's own locked tests (above) still refuse.
# Every path the change touches, renames split into the old and the new path (T934 review 5: with rename detection on, a
# renamed protected file showed only its new name). Read NUL-delimited into a file, its status checked.
changed_z="$(mktemp)" || exit 2; trap 'rm -f "$changed_z" "${work:-}"' EXIT
git diff --no-renames --name-only -z "$BASE" "$HEAD_REF" > "$changed_z" || fail gates "cannot list the files changed between $BASE and $HEAD_REF"
changed="$(tr '\0' '\n' < "$changed_z")"
for other in tasks/*.yml; do
  [ "$other" = "$TASK" ] && continue
  while read -r path hash; do
    [ -n "$path" ] && [ "$hash" != pending ] && grep -qxF "$path" <<< "$changed" || continue
    actual="$(git show "$HEAD_REF:$path" 2> /dev/null | sha256sum | cut -d' ' -f1)"
    [ "$actual" = "$hash" ] && continue
    # another task's lock only warns: fingerprints refuse only on the landing task's own locked pass-mark test (T786, QO512)
    printf 'WARN\tlocked\t%s changed; %s locks it, update its sha256 there when convenient\n' "$path" "$other"
  done < <(task_locked "$other")
done

# gate files: John approves changes to them (30 Oct 2026). An unset or empty GATE_FILES refuses: deleting the list must not switch the check off.
[ -n "$head_gate_files" ] || fail gates "GATE_FILES is not set in land.conf"
# The patterns reach fnmatch as one literal string, split there (T934 review 5: unquoted, the shell expanded a pattern against
# the checkout, so a deleted scripts/coverage-a.sh dropped out while scripts/coverage-b.sh remained). A matcher failure refuses.
gate_hits="$(GATE_PATTERNS="$GATE_FILES" python3 -I -c '
import fnmatch, os, sys
globs = os.environ["GATE_PATTERNS"].split()
if not globs:
    sys.exit("no gate patterns")
paths = [p for p in open(sys.argv[1], "rb").read().decode("utf-8").split("\0") if p]
print(" ".join(p for p in paths if any(fnmatch.fnmatchcase(p, g) for g in globs)))
' "$changed_z")" || fail gates "cannot match the changed files against GATE_FILES"
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
    python3 -I - "$QUESTIONS_FILE" "$gates_qo" "$gates_id" <<'PY' || fail gates "$gates_msg (board item $gates_qo has no answer by John in $QUESTIONS_FILE)"
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
