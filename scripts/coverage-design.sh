#!/usr/bin/env bash
# The 100 % coverage gate on packages/design engine/ and domain/ (John, 30 Oct 2026: "add checks to the build for
# the 100% and make the build break with an agent warning not to ignore it").
#
#   bash scripts/coverage-design.sh [spec paths]      (npm run coverage:design)
#
# Runs the design package's own unit tests under v8 coverage with per-file 100 % thresholds
# (packages/design/vitest.coverage.config.ts). Red when any file is below 100 %, and then prints the warning below.
# Gate: .github/workflows/suite.yml job coverage, the landing's candidate run (no arguments: every spec).
# Spec paths pick tests for a local run; no --coverage.* argument is taken, so a run can never narrow or relax the
# gate. Each run writes its report to its own folder, so two runs at once do not collide.
# A run over some specs reports every file those specs do not reach as short: read the ERROR lines for your files.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
for a in "$@"; do
  case "$a" in
    --coverage*) echo "coverage-design: refused '$a': the gate takes spec paths only, never coverage options" >&2; exit 2 ;;
  esac
done
report="build/coverage-design/run-${OPENISD_RUN_ID:-$$}"
node_modules/.bin/vitest run -c packages/design/vitest.coverage.config.ts --coverage --coverage.reportsDirectory="$PWD/$report" "$@"
rc=$?
[ "$rc" = 0 ] && exit 0
cat >&2 <<'EOF'

################################################################################################################
AGENTS — DO NOT IGNORE THIS FAILURE. THE BUILD IS RED.
Every file in packages/design/engine and packages/design/domain must have 100 % statement, branch, function and
line coverage. The ERROR lines above name each file and measure that is short.

Fix it by covering the code: first cut lines that need no test, then write tests (a vi.fn mock the test verifies
counts). Never:
  - lower a threshold, or turn perFile off,
  - add an exclude, or narrow coverage.include,
  - add a /* v8 ignore */, /* c8 ignore */ or /* istanbul ignore */ comment,
  - mark a test skip, todo or expected-fail to get past this,
  - land, retry or rerun hoping it turns green.
A file that cannot reach 100 % is a design question for John: raise it on the board and stop.
################################################################################################################
EOF
exit "$rc"
