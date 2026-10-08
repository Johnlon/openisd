#!/usr/bin/env bash
# The only path to main: land one task's branch.
#
#   bash scripts/land.sh <task-id>      run from the worker's own clone of the repo
#   bash scripts/land.sh --self-check   every locked sha256 in tasks/*.yml matches its file
#
#   exit 0  landed: origin/main is this branch rebased onto origin/main, pushed
#   exit 1  refused by a gate; main untouched; the message names the gate
#   exit 2  cannot start (no task file, no land.conf, no fetch)
#   exit 3  blocked: the rebase conflicts; it is aborted, tasks/<id>.yml says status: blocked and why,
#           and the worktree is committed and clean
#
# Steps, in order, all under one flock (LAND_LOCK) so landings run one at a time:
#   1. commit everything in the worktree (nothing is ever discarded)
#   2. fetch, rebase onto origin/main
#   3. the task's contract is intact: locked files match their hash, done_test and locked entries
#      are what origin/main has
#   4. no open tasks/fixes/*.yml, unless this task is labelled `fixes`
#   5. lint (the changed files as arguments), typecheck, done_test, attribution (each new commit's
#      message on stdin), each within GATE_DEADLINE_S
#   6. push to origin main, then start the post-land full run on the pushed commit, detached
#      (scripts/land/post-land/run.sh; only when land.conf sets FULL_SUITE_CMD)
#
# land.conf (next to this file, else at the repo root) sets LINT_CMD, optionally LINT_REQUIRES (paths
# that must exist before lint runs), TYPECHECK_CMD, ATTRIBUTION_CMD, GATE_DEADLINE_S, LAND_LOCK.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
# This file is vendored byte for byte into winisd_tools (tools/land/land.sh), so it finds its parts
# by where it sits: the core next to it (tools/land/core) or under land/ (scripts/land/core), and
# land.conf next to it (tools/land/land.conf) or at the repo root.
if [ -d "$HERE/core" ]; then CORE="$HERE/core"; else CORE="$HERE/land/core"; fi
if [ -f "$HERE/land.conf" ]; then CONF="$HERE/land.conf"; else CONF="$ROOT/land.conf"; fi
[ -f "$CONF" ] || { echo "land: no land.conf next to land.sh or in $ROOT" >&2; exit 2; }

# shellcheck source=/dev/null
. "$CONF"
# shellcheck source=./land/core/task.sh
. "$CORE/task.sh"
# shellcheck source=./land/core/gate.sh
. "$CORE/gate.sh"

# --self-check: every locked sha256 in tasks/*.yml matches its file (T000's done_test); nothing lands.
if [ "${1:-}" = "--self-check" ]; then
  task_self_check tasks
  exit $?
fi

ID="${1:?usage: land.sh <task-id> | land.sh --self-check}"
TASK="tasks/$ID.yml"
[ -f "$TASK" ] || { echo "land: no task file $TASK" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/land.XXXXXX")"
GATE_OUT="$WORK/gate.out"
cleanup() {
  local status=$?
  gate_stop
  rm -rf "$WORK"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# 1. commit everything
if [ -n "$(git status --porcelain)" ]; then
  # The subject says what landed: the task's goal (the id alone when the task file has none).
  goal="$(task_field "$TASK" goal)"
  git add -A && git commit -q -m "$ID${goal:+: $goal}" || { echo "land: commit failed" >&2; exit 2; }
fi

# One landing at a time. The lock is released when this process ends, however it ends.
exec 9> "$LAND_LOCK"
flock -n 9 || { echo "land: waiting for another landing"; flock 9; }

# 2. rebase onto origin/main
git fetch -q origin main || { echo "land: fetch failed" >&2; exit 2; }
if ! git rebase -q origin/main > "$WORK/rebase.out" 2>&1; then
  conflicts="$(git diff --name-only --diff-filter=U | tr '\n' ' ')"
  git rebase --abort
  task_mark_blocked "$TASK" "rebase onto origin/main conflicts in: ${conflicts:-unknown files}"
  git add "$TASK" && git commit -q -m "$ID: blocked, rebase onto origin/main conflicts"
  echo "land: BLOCKED $ID: rebase conflicts in ${conflicts:-unknown files}" >&2
  exit 3
fi

# 3. the task's contract is intact
while read -r path hash; do
  [ -n "$path" ] || continue
  actual="$(git show "HEAD:$path" 2>/dev/null | sha256sum | cut -d' ' -f1)"
  [ "$actual" = "$hash" ] || refuse locked "$path changed (locked by $TASK)"
done < <(task_locked "$TASK")
if git cat-file -e "origin/main:$TASK" 2>/dev/null; then
  git show "origin/main:$TASK" > "$WORK/task.origin"
  [ "$(task_contract "$WORK/task.origin")" = "$(task_contract "$TASK")" ] \
    || refuse done_test "$TASK changed its done_test or locked entries since origin/main"
fi

# 4. no open fixes task
if [ "$(task_field "$TASK" label)" != "fixes" ]; then
  open_fixes="$(grep -l '^status: open' tasks/fixes/*.yml 2>/dev/null | tr '\n' ' ')"
  [ -z "$open_fixes" ] || refuse fixes "open fixes task: $open_fixes; land a task labelled fixes first"
fi

# 5. the gates
for required in ${LINT_REQUIRES:-}; do
  [ -e "$required" ] || { GATE_OUT=/dev/null; refuse lint "$required is missing in $ROOT, so lint would run with whatever tool the path finds. Create worktrees with _agent_files/bin/new-worktree.sh, which links it in."; }
done
mapfile -t changed < <(git diff --name-only --diff-filter=ACMR origin/main HEAD)
run_gate lint /dev/null "$LINT_CMD" "${changed[@]}"
run_gate typecheck /dev/null "$TYPECHECK_CMD"
run_gate done_test /dev/null "$(task_field "$TASK" done_test)"
for sha in $(git rev-list origin/main..HEAD); do
  git log -1 --format=%B "$sha" > "$WORK/message"
  run_gate attribution "$WORK/message" "$ATTRIBUTION_CMD"
done

# 6. push
git push -q origin HEAD:main > "$WORK/push.out" 2>&1 || { GATE_OUT="$WORK/push.out"; refuse push "origin rejected the push"; }
pushed="$(git rev-parse HEAD)"
echo "land: landed $ID at ${pushed:0:10}"

# 7. the full run on the pushed commit, in its own session so this landing does not wait for it
if [ -n "${FULL_SUITE_CMD:-}" ] && [ -f "$HERE/land/post-land/run.sh" ]; then
  mkdir -p "$POST_LAND_DIR"
  setsid bash "$HERE/land/post-land/run.sh" "$pushed" >> "$POST_LAND_DIR/post-land.log" 2>&1 9>&- < /dev/null &
fi
