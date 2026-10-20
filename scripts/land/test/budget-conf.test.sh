#!/usr/bin/env bash
# The configured memory figures fit together (scripts/budget.conf): the pools add up to the budget or less,
# the suite's cost fits the general pool, every CPU cost is set, and every job the scripts start fits the pool it draws from. When a
# job grows, re-measure (scripts/measure-peak.sh) and change budget.conf; this test fails until they fit.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# shellcheck source=../../budget.conf
. "$REPO/scripts/budget.conf"
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }

total=$((POOL_SMALL_MB + POOL_GENERAL_MB))
[ "$total" -le "$BUDGET_MB" ] && ok "pools ($total MB) fit the budget ($BUDGET_MB MB)" || fail "pools are $total MB, the budget $BUDGET_MB MB"
[ "$COST_SUITE_MB" -le "$POOL_GENERAL_MB" ] && ok "the suite ($COST_SUITE_MB MB) fits the general pool ($POOL_GENERAL_MB MB)" || fail "the suite needs $COST_SUITE_MB MB, the general pool is $POOL_GENERAL_MB MB"
[ -z "${POOL_SUITE_MB:-}" ] && ok "there is no idle suite pool any more" || fail "POOL_SUITE_MB is still set"
[ "$COST_CPU_VITEST_FULL" = "$VITEST_FULL_WORKERS" ] && ok "a full unit run costs one core per worker ($VITEST_FULL_WORKERS)" || fail "COST_CPU_VITEST_FULL=$COST_CPU_VITEST_FULL, workers $VITEST_FULL_WORKERS"
[ "$CPU_TOKENS" -ge 1 ] && ok "CPU_TOKENS is $CPU_TOKENS" || fail "CPU_TOKENS is '$CPU_TOKENS'"
[ $((COST_TYPECHECK_MB + 2 * COST_LINT_CHANGED_MB)) -le "$POOL_SMALL_MB" ] && ok "one typecheck and two changed-file lints fit the always-free pool" || fail "the small pool cannot hold a typecheck and two changed-file lints"
[ $((COST_LINT_MB + COST_BROWSER_RUN_BASE_MB + BROWSER_RUN_MAX_WORKERS * COST_BROWSER_WORKER_MB)) -le "$POOL_GENERAL_MB" ] && ok "a full lint and a browser run fit the general pool together" || fail "the general pool cannot hold a full lint and a browser run"
[ $((COST_VITEST_FULL_MB + COST_BROWSER_RUN_BASE_MB + BROWSER_RUN_MAX_WORKERS * COST_BROWSER_WORKER_MB)) -le "$POOL_GENERAL_MB" ] && ok "a full unit run and a browser run fit the general pool together" || fail "the general pool cannot hold a full unit run and a browser run"

configured=$(sed -n 's/^const WORKERS = \([0-9]*\);.*/\1/p' "$REPO/vitest.config.ts")
[ "$configured" = "$VITEST_FULL_WORKERS" ] && ok "vitest.config.ts runs $configured workers, as the full unit cost assumes" || fail "vitest.config.ts has '$configured' workers, budget.conf costs $VITEST_FULL_WORKERS"
no_load=$(grep -c 'loadavg' "$REPO/vitest.config.ts" || true)
[ "$no_load" = 0 ] && ok "vitest.config.ts does not size workers from the load average" || fail "vitest.config.ts reads the load average again"

cost() { bash "$REPO/scripts/budget-cost.sh" "$@"; }
check() { # description expected-pool command...
  local what="$1" want="$2"; shift 2
  local got; got="$(cost "$@")"
  [ "${got%% *}" = "$want" ] && ok "$what is costed in the $want pool ($got MB, cores)" || fail "$what: got '$got', wanted pool $want"
  [ "$(echo "$got" | wc -w)" = 3 ] || fail "$what: '$got' is not <pool> <MB> <cores>"
}
check "a browser spec run" general node_modules/.bin/playwright test packages/ui/test/ui/a.browser.spec.ts
check "a targeted unit run" general node_modules/.bin/vitest run packages/design/test/a.test.ts
check "the full unit suite" general node_modules/.bin/vitest run
check "a full lint" general npx eslint --max-warnings 0 packages/
check "a changed-file lint" small bash scripts/land/lint-changed.sh a.ts
check "a typecheck" small npm run typecheck
check "a unit spec run by test.sh" general bash scripts/test.sh packages/design/test/a.test.ts
check "a browser spec run by test.sh" general bash scripts/test.sh packages/ui/test/ui/a.browser.spec.ts
check "a typecheck run by quiet-test.sh" small bash scripts/quiet-test.sh npm run typecheck
check "an unrelated command" none ls
cores() { cost "$@" | cut -d' ' -f3; }
[ "$(cores node_modules/.bin/vitest run packages/design/test/a.test.ts)" = "$COST_CPU_VITEST_TARGETED" ] && ok "a targeted unit run costs $COST_CPU_VITEST_TARGETED cores" || fail "targeted unit cores"
[ "$(cores node_modules/.bin/playwright test packages/ui/test/ui/a.browser.spec.ts)" = "$((COST_CPU_BROWSER_RUN_BASE + BROWSER_RUN_MAX_WORKERS * COST_CPU_BROWSER_WORKER))" ] && ok "a browser run costs 1 + workers cores" || fail "browser cores"
[ "$(cores npm run typecheck)" = "$COST_CPU_TYPECHECK" ] && ok "a typecheck costs $COST_CPU_TYPECHECK cores" || fail "typecheck cores"

[ "$fails" = 0 ] || { echo "$fails failure(s)"; exit 1; }
echo "all passed"
