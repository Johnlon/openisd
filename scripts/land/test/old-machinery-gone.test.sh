#!/usr/bin/env bash
# T008 acceptance: the slow-run queue, commit marker, tested-tree skip, rerun.mjs and the Vite
# watchdog are gone, and nothing live refers to them. The new S3 watchdog (scripts/land/watchdog.sh)
# is a different thing and stays. Historical records (bugs/, tasks/, questions.yml, archives, the
# log, this file and the retired-terms check in rules-docs) may name them.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO" || exit 2
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

for p in scripts/slow-run scripts/vite-watchdog.sh scripts/watchdog.sh scripts/health-check.sh scripts/test-setup/own-queue-state.mjs; do
  if [ -e "$p" ]; then fail "still exists: $p"; else ok "gone: $p"; fi
done
[ -f scripts/land/watchdog.sh ] && ok "kept: scripts/land/watchdog.sh (S3)" || fail "missing: scripts/land/watchdog.sh"

PATTERN='slow-run|slow_queue|slowrun|vite-watchdog|scripts/watchdog\.sh|rerun\.mjs|SLOW_RUN|health-check\.sh'
hits="$(git grep -nE "$PATTERN" -- . \
  ':!bugs' ':!tasks' ':!questions.yml' ':!*_archive/*' ':!docs/LOG.md' ':!docs/plans' \
  ':!scripts/land/test/old-machinery-gone.test.sh' ':!scripts/land/test/rules-docs.test.sh' 2>/dev/null)"
if [ -z "$hits" ]; then ok "no live reference remains"; else fail "references remain:"; printf '%s\n' "$hits" | cut -c1-200; fi

[ $fails = 0 ] && { echo "old-machinery-gone: all passed"; exit 0; }
echo "old-machinery-gone: $fails failed"; exit 1
