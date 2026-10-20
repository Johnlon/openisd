#!/usr/bin/env bash
# bash scripts/budget-cost.sh <command> [args...]    prints "<pool> <MB> <cores>" for a heavy command.
# The figures are measured (scripts/budget.conf). A command it does not recognise is not heavy: it prints
# "none 0 0". BUDGET_CONF replaces the config file in tests.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=budget.conf
. "${BUDGET_CONF:-$HERE/budget.conf}"

targets() { printf '%s\n' "$@" | grep -cE '\.(test|spec)\.(ts|js|mjs)$|/test/' || true; }
specs() { printf '%s\n' "$@" | grep -cE '\.(test|spec)\.(ts|js|mjs)$' || true; }
browser() { # a browser run's cost with the given workers
  local workers="${OPENISD_TEST_WORKERS:-$BROWSER_RUN_MAX_WORKERS}"
  [ "$workers" -le "$BROWSER_RUN_MAX_WORKERS" ] || workers="$BROWSER_RUN_MAX_WORKERS"
  echo "general $((COST_BROWSER_RUN_BASE_MB + workers * COST_BROWSER_WORKER_MB)) $((COST_CPU_BROWSER_RUN_BASE + workers * COST_CPU_BROWSER_WORKER))"
}

case " $* " in
  *playwright\ test*|*test-browser.sh*) browser ;;
  *vitest*)
    if [ "$(targets "$@")" -gt 0 ] && [ "$(targets "$@")" -le 10 ]; then echo "general $COST_VITEST_TARGETED_MB $COST_CPU_VITEST_TARGETED"
    else echo "general $COST_VITEST_FULL_MB $COST_CPU_VITEST_FULL"; fi ;;
  *" typecheck"*|*" tsc "*|*" vue-tsc "*|*typecheck.mjs*) echo "small $COST_TYPECHECK_MB $COST_CPU_TYPECHECK" ;;
  *unit-changed*) echo "general $COST_VITEST_FULL_MB $COST_CPU_VITEST_FULL" ;;
  *unit-architecture*) echo "general $COST_VITEST_FULL_MB $COST_CPU_VITEST_FULL" ;;   # 35 files at the full run's worker count
  *lint-changed*) echo "small $COST_LINT_CHANGED_MB $COST_CPU_LINT_CHANGED" ;;
  *" eslint "*|*" lint"*) echo "general $COST_LINT_MB $COST_CPU_LINT" ;;
  # scripts/test.sh and quiet-test.sh run a spec by its suffix (test.sh header): a browser spec is a browser run,
  # a unit spec is a vitest run. Only commands that name a spec are costed; the rest are not heavy.
  *scripts/test.sh*|*quiet-test.sh*)
    case " $* " in
      *.browser.spec.*) browser ;;
      *) if [ "$(specs "$@")" -gt 10 ]; then echo "general $COST_VITEST_FULL_MB $COST_CPU_VITEST_FULL"
         elif [ "$(specs "$@")" -gt 0 ]; then echo "general $COST_VITEST_TARGETED_MB $COST_CPU_VITEST_TARGETED"
         else echo "none 0 0"; fi ;;
    esac ;;
  *) echo "none 0 0" ;;
esac
