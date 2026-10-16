#!/usr/bin/env bash
# The browser lock: bash scripts/suite-lock.sh <shared|exclusive> -- <command> [args...]
#
# The post-land full suite takes it exclusive; every browser spec run an agent starts (scripts/test.sh
# on a *.browser.spec.ts) takes it shared. Shared runs overlap each other as before; none overlaps the
# full suite, which an overlap pushed past the page-load timeouts and into the kernel's OOM kill
# (16 Oct 2026: F34, F35). The lock is flock on $SUITE_RUN_LOCK, held by the command and every
# process it starts, and released by the kernel when the last of them ends however it ends.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=paths.sh
. "$HERE/paths.sh"
mode="${1:-}"; shift || true
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "usage: suite-lock.sh <shared|exclusive> -- <command> [args...]" >&2; exit 2; }
case "$mode" in
  shared)    flag=-s; waiting="the post-land suite is running; this browser run starts when it ends" ;;
  exclusive) flag=-x; waiting="browser runs are in progress; the suite starts when they end" ;;
  *) echo "suite-lock: mode is shared or exclusive, got '$mode'" >&2; exit 2 ;;
esac
flock "$flag" -n "$SUITE_RUN_LOCK" true 2> /dev/null || echo "suite-lock: waiting: $waiting" >&2
exec flock "$flag" "$SUITE_RUN_LOCK" "$@"
