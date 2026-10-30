#!/usr/bin/env bash
# The coverage ratchet on packages/ui src/**/*.ts (T620, John 30 Oct 2026: "add checks to the build for the 100%
# and make the build break with an agent warning not to ignore it").
#
#   bash scripts/coverage-ui.sh [spec paths]      (npm run coverage:ui)
#
# Runs the ui unit tests under v8 coverage (packages/ui/vitest.coverage.config.ts), then
# scripts/coverage-ratchet.mjs against packages/ui/coverage-baseline.json: a new file must be 100 %, an old file
# may not fall below its baseline, and the baseline only rises. Green with a higher number rewrites the baseline;
# the landing agent commits it.
# Gate: .github/workflows/suite.yml job coverage-ui, the landing's candidate run.
# No --coverage.* argument is taken, so a run can never narrow or relax the gate. Each run writes its report to
# its own folder. A run over some specs reports unreached files as short, and so is red: use it to read your files.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
for a in "$@"; do
  case "$a" in
    --coverage*) echo "coverage-ui: refused '$a': the gate takes spec paths only, never coverage options" >&2; exit 2 ;;
  esac
done
report="build/coverage-ui/run-${OPENISD_RUN_ID:-$$}"
node_modules/.bin/vitest run -c packages/ui/vitest.coverage.config.ts --coverage --coverage.reportsDirectory="$PWD/$report" "$@"
rc=$?
if [ "$rc" = 0 ]; then
  node scripts/coverage-ratchet.mjs "$report/coverage-summary.json" packages/ui/coverage-baseline.json
  rc=$?
fi
[ "$rc" = 0 ] && exit 0
cat >&2 <<'BANNER'

################################################################################################################
AGENTS — DO NOT IGNORE THIS FAILURE. THE BUILD IS RED.
Every packages/ui/src TypeScript file keeps at least the coverage in packages/ui/coverage-baseline.json, and a new
file must have 100 % statement, branch, function and line coverage. The ERROR lines above name each file and
measure that is short.

Fix it by covering the code: first cut lines that need no test, then write tests (a vi.fn mock the test verifies
counts). Never:
  - lower the baseline, or edit it downward by hand,
  - add an exclude, or narrow coverage.include,
  - add a /* v8 ignore */, /* c8 ignore */ or /* istanbul ignore */ comment,
  - mark a test skip, todo or expected-fail to get past this,
  - land, retry or rerun hoping it turns green.
A file that cannot be covered is a question for John: raise it on the board and stop.
################################################################################################################
BANNER
exit "$rc"
