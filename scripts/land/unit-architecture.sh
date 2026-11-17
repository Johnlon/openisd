#!/usr/bin/env bash
# The architecture gate of scripts/land.sh: bash scripts/land/unit-architecture.sh
#
# Runs every architecture unit test (packages/**/architecture*.test.ts and packages/**/architecture/**),
# whatever files the landing changed. They read the source tree rather than import it, so the unit
# gate's import graph (unit-changed.sh, `vitest --changed`) never picks them: F52 and F53 (17 Oct 2026)
# turned main red on architecture tests no landing ran. All of them take about 45 s.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
# The tests, one per line: every architecture test, plus the ones that read the source tree whatever the diff (T815:
# branch-map.test.ts, "every UI branch is mapped to a view", failed four pull requests after the push).
list_specs() {
  git ls-files ':(glob)packages/**/architecture*.test.ts' ':(glob)packages/**/architecture/**/*.test.ts'
  echo packages/ui/test/scripts/branch-map.test.ts
}
[ "${1:-}" = --list ] && { list_specs; exit 0; }
# Memory admission: the job starts when its measured cost fits its pool (scripts/budget.conf), else it waits.
BUDGET_SELF="${BASH_SOURCE[0]}" . scripts/budget-enter.sh "$@"

# A gate takes no heavy lane (T044): enter heavy.slice directly so ~/bin/npx skips the lane queue.
case "${OPENISD_CI_RUNNER:+heavy.slice}$(cat /proc/self/cgroup 2>/dev/null)" in
  *heavy.slice*) ;;
  *) exec bash scripts/heavy.sh bash "${BASH_SOURCE[0]}" "$@" ;;
esac

mapfile -t specs < <(list_specs)
[ "${#specs[@]}" -gt 0 ] || { echo "architecture: no architecture test found; the glob or the tree is wrong" >&2; exit 1; }
echo "architecture: ${#specs[@]} test files"

. scripts/lib/ts-log.sh
run_start "unit-architecture"
rc=0
node_modules/.bin/vitest run "${specs[@]}" || rc=$?
run_end "unit-architecture" "$rc"
exit "$rc"
