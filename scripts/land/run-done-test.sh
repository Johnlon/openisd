#!/usr/bin/env bash
# The done_test gate, shared by scripts/land.sh and the pull request check (T749):
#
#   bash scripts/land/run-done-test.sh <task-file>      run from the repo root
#
# Runs the task's done_test. A browser spec is refused: it takes minutes under load and overran the gate deadline
# (T036, 11 Oct 2026); the browser half runs in the full suite, never as a task's done_test.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 2
task="${1:?usage: run-done-test.sh <task-file>}"
done_test="$(sed -n 's/^done_test: *//p' "$task" | head -n 1)"
[ -n "$done_test" ] || { echo "done_test: $task has no done_test" >&2; exit 1; }
case "$done_test" in
  *.browser.spec.ts*) echo "done_test: names a browser spec ($done_test); browser specs run in the full suite, name a unit spec" >&2; exit 1 ;;
esac
exec bash -c "$done_test"
