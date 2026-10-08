#!/usr/bin/env bash
# scripts/lib/progress.sh: the one progress line every loop prints.
#   <label> 37/120 (31%) elapsed 2m10s ETA 4m50s     ETA = elapsed / done * remaining
# Not one of the locked T001-T005 specs.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
. "$REPO/scripts/lib/progress.sh"
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
eq()   { [ "$2" = "$3" ] && ok "$1" || fail "$1: got '$2', want '$3'"; }

eq "the example line"          "$(progress_line suite 37 120 130)"  "suite 37/120 (31%) elapsed 2m10s ETA 4m52s"
eq "half way"                  "$(progress_line unit 50 100 60)"    "unit 50/100 (50%) elapsed 1m00s ETA 1m00s"
eq "nothing done yet"          "$(progress_line unit 0 100 12)"     "unit 0/100 (0%) elapsed 0m12s ETA unknown"
eq "all done"                  "$(progress_line unit 100 100 75)"   "unit 100/100 (100%) elapsed 1m15s ETA 0m00s"
eq "an hour and more"          "$(progress_line big 1 4 3700)"      "big 1/4 (25%) elapsed 1h01m40s ETA 3h05m00s"
eq "total unknown"             "$(progress_line unit 7 0 30)"       "unit 7/? elapsed 0m30s ETA unknown"
eq "waiting names position and holder" \
   "$(progress_waiting_line suite 2 "unit run of maryu" 45)" \
   "suite waiting for slot: 2 ahead, holder unit run of maryu, 45 s"
eq "end line, ok"              "$(progress_end_line suite 0 130)"   "suite finished: ok after 2m10s"
eq "end line, failed"          "$(progress_end_line suite 7 130)"   "suite finished: FAILED (exit 7) after 2m10s"

# a heartbeat prints on its interval and stops when told
out=$(mktemp); trap 'rm -f "$out"' EXIT
progress_heartbeat_start 1 "$out" echo beat
sleep 3.5
progress_heartbeat_stop
n=$(wc -l < "$out")
[ "$n" -ge 2 ] && [ "$n" -le 5 ] && ok "heartbeat prints repeatedly ($n lines)" || fail "heartbeat ($n lines)"
sleep 1.5; m=$(wc -l < "$out")
[ "$m" = "$n" ] && ok "heartbeat stops when stopped" || fail "heartbeat kept going ($n -> $m)"

[ $fails = 0 ] && { echo "progress: all passed"; exit 0; }
echo "progress: $fails failed"; exit 1
