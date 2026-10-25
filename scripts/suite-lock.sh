#!/usr/bin/env bash
# The browser lock: bash scripts/suite-lock.sh <shared|exclusive> -- <command> [args...]
#
# The post-land full suite takes it exclusive; every browser spec run an agent starts (scripts/test.sh
# on a *.browser.spec.ts) takes it shared. Shared runs overlap each other as before; none overlaps the
# full suite, which an overlap pushed past the page-load timeouts and into the kernel's OOM kill
# (16 Oct 2026: F34, F35). The locks are flock on $SUITE_RUN_LOCK and $SUITE_RUN_LOCK.gate, held by the
# command and every process it starts, and released by the kernel when the last of them ends however it
# ends.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=paths.sh
. "$HERE/paths.sh"
mode="${1:-}"; shift || true
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "usage: suite-lock.sh <shared|exclusive> -- <command> [args...]" >&2; exit 2; }
case "$mode" in
  shared)    flag=-s; waiting="the post-land suite is running or waiting for browser runs; this browser run starts when it ends" ;;
  exclusive) flag=-x; waiting="browser runs are in progress; the suite starts when they end" ;;
  *) echo "suite-lock: mode is shared or exclusive, got '$mode'" >&2; exit 2 ;;
esac
# Two locks, so a waiting suite is not starved by a stream of short browser runs. The GATE is taken
# first: a browser run holds it only while it takes the RUN lock, the suite holds it until it ends. The
# suite takes the gate at once (no run holds it for long), which stops new browser runs entering, then
# waits on the RUN lock for the runs already going. A browser run takes the run lock shared and lets go
# of the gate, so browser runs still overlap each other.
GATE="$SUITE_RUN_LOCK.gate"
# While the suite waits it records "<pid> <start>" in $SUITE_RUN_LOCK.waiting (mtime = when it began):
# a wait is not a hang, and a signal that ends the run during it is not a red (post-land/run.sh,
# watchdog.sh read it by pid and start time).
WAITING="$SUITE_RUN_LOCK.waiting"
mark_waiting() {
  [ "$mode" = exclusive ] && [ ! -e "$WAITING.mine.$$" ] || return 0
  : > "$WAITING.mine.$$"
  printf '%s %s\n' "$$" "$(awk '{print $22}' "/proc/$$/stat")" > "$WAITING"
}
trap '[ "$mode" = exclusive ] && { rm -f "$WAITING" "$WAITING.mine.$$"; }' EXIT
exec 8> "$GATE"
if ! flock "$flag" -n 8; then
  echo "suite-lock: waiting: $waiting" >&2
  mark_waiting
  flock "$flag" 8
fi
exec 9> "$SUITE_RUN_LOCK"
if ! flock "$flag" -n 9; then
  echo "suite-lock: waiting: $waiting" >&2
  mark_waiting
  flock "$flag" 9
fi
[ "$mode" = shared ] && exec 8>&-
trap - EXIT
[ "$mode" = exclusive ] && rm -f "$WAITING" "$WAITING.mine.$$"
exec "$@"
