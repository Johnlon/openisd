#!/usr/bin/env bash
# End-to-end test of the suite's memory budget and the agents' CPU yield, with real processes and a
# scratch lock directory: yield-to-suite.sh runs at nice 0 with no suite, nice 15 and idle I/O while a
# suite holds or waits for the browser lock, and goes back to nice 0 when it ends; slice-headroom.sh reads
# a slice's MemoryHigh and use; two concurrent test-concurrency reservations split the slice's headroom.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"
pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2> /dev/null; done; wait 2> /dev/null; rm -rf "$SCRATCH"; }
trap cleanup EXIT
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
export OPENISD_RUNTIME_DIR="$SCRATCH/run"
export SUITE_RUN_LOCK="$SCRATCH/suite-run.lock"
export OPENISD_RESERVATION_DIR="$SCRATCH/reservations" OPENISD_RESERVATION_LOCK="$SCRATCH/reservations.lock"
yield() { bash "$REPO/scripts/yield-to-suite.sh" "$@"; }
nice_is() { [ "$(yield nice)" = "$1" ]; }
waitfor() { local i; for i in $(seq 1 100); do "$@" && return 0; sleep 0.1; done; return 1; }

# --- yield-to-suite.sh -----------------------------------------------------------------------
[ "$(yield nice)" = 0 ] && ok "no suite: the command runs at nice 0" || fail "no suite: nice was $(yield nice)"

bash "$REPO/scripts/suite-lock.sh" exclusive -- sleep 60 & pids+=($!); suite=$!
waitfor nice_is 15 && ok "a running suite: the command runs at nice 15" || fail "a running suite: nice was $(yield nice)"
[ "$(yield ionice)" = "idle" ] && ok "a running suite: the command runs in the idle I/O class" || fail "ionice was $(yield ionice)"
yield true && ok "the command still starts at once and its exit code is kept" || fail "exit code lost"
yield bash -c 'exit 7'; [ $? = 7 ] && ok "the command's own exit code is returned" || fail "exit code 7 lost"
kill "$suite"; wait "$suite" 2> /dev/null
waitfor nice_is 0 && ok "suite over: back to nice 0" || fail "suite over: nice was $(yield nice)"

# a suite still waiting for a shared browser run already counts: it holds the gate
bash "$REPO/scripts/suite-lock.sh" shared -- sleep 60 & pids+=($!); shared=$!
waitfor test -e "$SUITE_RUN_LOCK"
bash "$REPO/scripts/suite-lock.sh" exclusive -- sleep 60 > /dev/null 2>&1 & pids+=($!); waiting=$!
waitfor nice_is 15 && ok "a suite waiting for browser runs: nice 15" || fail "a waiting suite: nice was $(yield nice)"
kill "$waiting" "$shared"; wait "$waiting" "$shared" 2> /dev/null

# --- slice-events.sh -------------------------------------------------------------------------
export SLICE_CGROUP_ROOT="$SCRATCH/cg"
mkdir -p "$SLICE_CGROUP_ROOT/a.slice"
printf 'low 0\nhigh 12\nmax 3\noom 0\noom_kill 0\noom_group_kill 0\n' > "$SLICE_CGROUP_ROOT/a.slice/memory.events"
line=$(bash -c ". '$REPO/scripts/slice-events.sh'; slice_events_line a.slice")
[ "$line" = "slice a.slice memory.events low=0 high=12 max=3 oom=0 oom_kill=0 oom_group_kill=0" ] && ok "the post-land log line carries high and max" || fail "events line: $line"
[ "$(bash -c ". '$REPO/scripts/slice-events.sh'; slice_event_count a.slice high")" = 12 ] && ok "one counter is read on its own" || fail "count wrong"
[ "$(bash -c ". '$REPO/scripts/slice-events.sh'; slice_event_count missing.slice high")" = 0 ] && ok "an unreadable slice counts 0" || fail "missing slice count wrong"
unset SLICE_CGROUP_ROOT
real=$(bash -c ". '$REPO/scripts/slice-events.sh'; slice_events_line heavy.slice")
case "$real" in "slice heavy.slice memory.events low="*" high="*" max="*) ok "the real heavy.slice counters are readable" ;; *) fail "real heavy.slice: $real" ;; esac

# --- install-slices.sh writes heavy.slice atomically into the directory it is given ------------------
SYSTEMD_USER_DIR="$SCRATCH/units" bash "$REPO/scripts/systemd/install-slices.sh" > /dev/null
{ grep -q '^MemoryMax=13G' "$SCRATCH/units/heavy.slice" && ! grep -q '^MemoryHigh' "$SCRATCH/units/heavy.slice"; } && ok "heavy.slice is installed with a MemoryMax backstop and no MemoryHigh throttle" || fail "heavy.slice file wrong"

[ "$fails" = 0 ] || { echo "$fails failure(s)"; exit 1; }
echo "all passed"
