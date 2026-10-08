#!/usr/bin/env bash
# Acceptance test for scripts/housekeeping.sh. Builds slot records by hand (no admit.sh needed).
# Every process started here is killed by pid in the EXIT trap; none is found by command text.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
H="$REPO/scripts/housekeeping.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/housekeeping-test.XXXXXX")"
export ADMIT_DIR="$SCRATCH/admit"
export HOUSEKEEPING_LOG="$SCRATCH/logs/housekeeping.log"
PIDS=()
fails=0
cleanup() { for p in "${PIDS[@]}"; do kill -KILL "$p" 2> /dev/null; done; rm -rf "$SCRATCH"; }
trap cleanup EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
mkdir -p "$ADMIT_DIR/q"

holder() { # holder <rec-file>: background process holding the record's exclusive lock; pid in HPID
  ( exec 9>> "$1"; flock -x 9; exec sleep 300 ) &
  HPID=$!; PIDS+=("$HPID")
  sleep 0.5
}
starttime() { local s; s=$(cat "/proc/$1/stat"); s=${s##*) }; set -- $s; echo "${20}"; }

# 1. dead owner (lock holder SIGKILLed), live owner, and live lock with a gone pid
dead="$ADMIT_DIR/q/00000001.rec"; live="$ADMIT_DIR/q/00000002.rec"; odd="$ADMIT_DIR/q/00000003.rec"
printf 'pid=999999\nstart=1\nlabel=doomed\nrun=r1\nqueued=1\n' > "$dead"
holder "$dead"; kill -KILL "$HPID"; wait "$HPID" 2> /dev/null
holder "$live"
printf 'pid=%s\nstart=%s\nlabel=alive\nrun=r2\nqueued=1\n' "$HPID" "$(starttime "$HPID")" > "$live"
printf 'pid=999998\nstart=1\nlabel=oddball\nrun=r3\nqueued=1\n' > "$odd"
holder "$odd"

out=$(timeout 30 bash "$H" 2>&1); r=$?
[ $r = 0 ] && ok "exit 0" || fail "exit $r: $out"
grep -qi doomed <<< "$out" && ok "line names doomed" || fail "no doomed line: $out"
grep -q 'freed slot 00000001 of "doomed" (owner pid 999999 is dead)' <<< "$out" && ok "exact line" || fail "line format: $out"
[ ! -e "$dead" ] && ok "dead record removed" || fail "dead record still there"
[ -e "$live" ] && ok "live record kept" || fail "live record removed"
[ -e "$odd" ] && ok "held record with gone pid kept" || fail "held record removed"
grep -q '1 slot(s) freed, 2 live' <<< "$out" && ok "summary line" || fail "summary: $out"
grep -q 'freed slot 00000001 of "doomed"' "$HOUSEKEEPING_LOG" && ok "log has the line" || fail "log missing line"
grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*housekeeping: 1 slot' "$HOUSEKEEPING_LOG" && ok "log has timestamp + summary" || fail "log summary"

# 2. zombie owner whose lock is free counts as dead
z="$ADMIT_DIR/q/00000004.rec"
printf 'pid=999997\nstart=1\nlabel=gone\nrun=r4\nqueued=1\n' > "$z"
timeout 30 bash "$H" > /dev/null 2>&1
[ ! -e "$z" ] && ok "free-lock record removed" || fail "free-lock record kept"

# 3. missing ADMIT_DIR is nothing to do
ADMIT_DIR="$SCRATCH/nope" timeout 30 bash "$H" > /dev/null 2>&1; r=$?
[ $r = 0 ] && ok "missing ADMIT_DIR exits 0" || fail "missing dir exit $r"

# 4. unreadable q dir fails loudly (skipped as root: permissions do not bind)
if [ "$(id -u)" != 0 ]; then
  chmod 000 "$ADMIT_DIR/q"
  err=$(timeout 30 bash "$H" 2>&1 > /dev/null); r=$?
  chmod 755 "$ADMIT_DIR/q"
  [ $r != 0 ] && [ -n "$err" ] && ok "unreadable dir fails with cause" || fail "unreadable dir r=$r err=$err"
fi

# 5. a concurrent scan is refused politely
( exec 8> "$ADMIT_DIR/housekeeping.lock"; flock -x 8; exec sleep 300 ) & PIDS+=("$!")
sleep 0.5
out=$(timeout 30 bash "$H" 2>&1); r=$?
[ $r = 0 ] && grep -q 'another scan is running' <<< "$out" && ok "busy lock handled" || fail "busy lock r=$r: $out"

[ $fails = 0 ] && echo "ALL OK" || echo "$fails FAILED"
exit $((fails > 0))
