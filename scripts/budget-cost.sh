#!/usr/bin/env bash
# bash scripts/budget-cost.sh <command> [args...]    prints "<pool> <MB>" for a heavy command.
# The figures are measured (scripts/budget.conf). A command it does not recognise is not heavy: it prints
# "none 0". BUDGET_CONF replaces the config file in tests.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=budget.conf
. "${BUDGET_CONF:-$HERE/budget.conf}"

targets() { printf '%s\n' "$@" | grep -cE '\.(test|spec)\.(ts|js|mjs)$|/test/' || true; }

case " $* " in
  *playwright\ test*|*test-browser.sh*)
    workers="${OPENISD_TEST_WORKERS:-$BROWSER_RUN_MAX_WORKERS}"
    [ "$workers" -le "$BROWSER_RUN_MAX_WORKERS" ] || workers="$BROWSER_RUN_MAX_WORKERS"
    echo "general $((COST_BROWSER_RUN_BASE_MB + workers * COST_BROWSER_WORKER_MB))" ;;
  *vitest*)
    if [ "$(targets "$@")" -gt 0 ] && [ "$(targets "$@")" -le 10 ]; then echo "general $COST_VITEST_TARGETED_MB"
    else echo "general $COST_VITEST_FULL_MB"; fi ;;
  *" typecheck"*|*" tsc "*|*" vue-tsc "*|*typecheck.mjs*) echo "small $COST_TYPECHECK_MB" ;;
  *unit-changed*) echo "general $COST_VITEST_FULL_MB" ;;
  *unit-architecture*) echo "general $COST_VITEST_FULL_MB" ;;   # 35 files at the full run's worker count
  *lint-changed*) echo "small $COST_LINT_CHANGED_MB" ;;
  *" eslint "*|*" lint"*) echo "general $COST_LINT_MB" ;;
  *) echo "none 0" ;;
esac
