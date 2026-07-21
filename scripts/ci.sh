#!/usr/bin/env bash
# CI wrapper with a DURABLE log. The pre-push hook runs `npm run ci`; before this wrapper a
# failing test's assertion diff lived only in terminal scrollback and was lost forever once
# a rerun passed (winisd_tools BUGS.md 2026-07-21 observability entry). Every run now tees
# its full output to git-ignored ci-logs/ci-<UTC-stamp>.log.
set -u
mkdir -p ci-logs
LOG="ci-logs/ci-$(date -u +%Y%m%dT%H%M%SZ).log"
# The drivers bundle is DERIVED and untracked (human ruling 2026-07-21): CI uses both
# repos — regenerate it from the sibling winisd_drivers checkout before testing.
{ node scripts/bundle-drivers.mjs && npm run lint && npm run typecheck && npm run test; } 2>&1 | tee "$LOG"
status=${PIPESTATUS[0]}
echo "ci: exit ${status} — log retained at ${LOG}" | tee -a "$LOG"
exit "${status}"
