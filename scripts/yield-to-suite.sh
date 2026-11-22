#!/usr/bin/env bash
# bash scripts/yield-to-suite.sh <command> [args...]
# Runs the command at once. While the post-land suite holds the browser lock (scripts/suite-lock.sh)
# the command runs under nice -n 15 and ionice -c3 (idle class, where ionice exists), so it yields
# CPU and disk to the suite instead of slowing its browsers into page-load timeouts (F45).
# It never waits and never refuses: lint, typecheck and unit runs still start immediately.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=paths.sh
. "$HERE/paths.sh"
[ $# -gt 0 ] || { echo "usage: yield-to-suite.sh <command> [args...]" >&2; exit 2; }

# The suite holds the gate lock from the moment it starts waiting until it ends. A shared try-lock
# that fails therefore means a suite is running or about to run. The probe's own descriptor closes
# before the command starts, so the command never inherits the lock.
suite_active() {
  local gate="$SUITE_RUN_LOCK.gate"
  [ -e "$gate" ] || return 1
  ! ( flock -s -n 8 ) 8< "$gate" 2> /dev/null
}

if suite_active; then
  if command -v ionice > /dev/null 2>&1; then exec nice -n 15 ionice -c3 "$@"; fi
  exec nice -n 15 "$@"
fi
exec "$@"
