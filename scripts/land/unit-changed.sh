#!/usr/bin/env bash
# The unit gate of scripts/land.sh: bash scripts/land/unit-changed.sh <changed file…>
#
# Runs every vitest file that the change can reach: the changed test files themselves and every
# test that imports a changed source file (vitest's module graph, `--changed origin/main`). Five
# landings on 10–11 Oct 2026 pushed 14 unit failures in 7 files to main because the landing gate ran
# only the task's own done_test; post-land found them hours later (F7–F9) and every landing was
# refused for ~11 h (docs/SDLC.md, R1/S1). The browser half still runs post-land.
#
# The changed-file list is the same one lint gets (vs origin/main); it is only used to say what the
# gate is about and to skip the run when nothing under packages/ changed.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
# Memory admission: the job starts when its measured cost fits its pool (scripts/budget.conf), else it waits.
BUDGET_SELF="${BASH_SOURCE[0]}" . scripts/budget-enter.sh "$@"

# A gate takes no heavy lane (T044): enter heavy.slice directly so ~/bin/npx skips the lane queue.
case "$(cat /proc/self/cgroup 2>/dev/null)" in
  *heavy.slice*) ;;
  *) exec bash scripts/heavy.sh bash "${BASH_SOURCE[0]}" "$@" ;;
esac

touched=0
for f in "$@"; do
  case "$f" in
    packages/*|vitest.config.ts|package.json|package-lock.json) touched=1 ;;
  esac
done
[ "$touched" = 1 ] || { echo "unit: no file under packages/ changed"; exit 0; }

# --changed <ref>: every test file related to a file that differs from <ref>, by import graph.
# --passWithNoTests: a change that reaches no test (docs under packages/, say) is not a failure.
. scripts/lib/ts-log.sh
run_start "unit-changed"
rc=0
node_modules/.bin/vitest run --changed origin/main --passWithNoTests || rc=$?
run_end "unit-changed" "$rc"
exit "$rc"
