#!/usr/bin/env bash
# The browser lock (scripts/suite-lock.sh): shared runs overlap each other; the exclusive suite waits for
# them and keeps every new shared run waiting until it ends. Real processes, scratch lock. Not a locked spec.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/suite-lock.XXXXXX")"
PIDS=(); fails=0
cleanup() { for p in "${PIDS[@]}"; do kill -KILL -- "-$p" 2> /dev/null; kill -KILL "$p" 2> /dev/null; done; rm -rf "$SCRATCH"; }
trap cleanup EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"
export SUITE_RUN_LOCK="$SCRATCH/suite-run.lock"
L="$REPO/scripts/suite-lock.sh"
# A command that marks its start, then holds until its release file exists.
cat > "$SCRATCH/job.sh" << 'J'
#!/usr/bin/env bash
: > "$1.started"
while [ ! -e "$1.release" ]; do sleep 0.1; done
J
started() { for _ in $(seq 1 100); do [ -e "$SCRATCH/$1.started" ] && return 0; sleep 0.1; done; return 1; }
start() { setsid bash "$L" "$2" -- bash "$SCRATCH/job.sh" "$SCRATCH/$1" > "$SCRATCH/$1.out" 2>&1 & PIDS+=("$!"); }

# 1. two shared runs overlap
start s1 shared; start s2 shared
started s1 && started s2 && ok "two shared runs overlap" || fail "shared runs did not overlap"

# 2. the exclusive run waits while shared runs are going, and says so
start x exclusive; sleep 1
[ ! -e "$SCRATCH/x.started" ] && ok "the suite waits for running browser specs" || fail "the suite started over shared runs"
grep -q "waiting: browser runs are in progress" "$SCRATCH/x.out" && ok "the wait is announced" || fail "no wait message: $(cat "$SCRATCH/x.out")"

# 3. a shared run started after the suite is waiting still gets in (flock does not queue), the suite starts when all end
: > "$SCRATCH/s1.release"; : > "$SCRATCH/s2.release"
started x && ok "the suite starts when the shared runs end" || fail "the suite never started"

# 4. while the suite holds the lock, a new shared run waits, says so, and starts after it
start s3 shared; sleep 1
[ ! -e "$SCRATCH/s3.started" ] && ok "a browser spec waits for the running suite" || fail "a spec ran during the suite"
grep -q "waiting: the post-land suite is running" "$SCRATCH/s3.out" && ok "the spec's wait is announced" || fail "no wait message: $(cat "$SCRATCH/s3.out")"
: > "$SCRATCH/x.release"
started s3 && ok "the spec starts after the suite ends" || fail "the spec never started"
: > "$SCRATCH/s3.release"

# 5. a killed suite frees the lock (the kernel releases it)
start x2 exclusive; started x2
start s4 shared; sleep 0.5
kill -KILL -- "-${PIDS[-2]}" 2> /dev/null; kill -KILL -- "$(pgrep -P "${PIDS[-2]}" 2> /dev/null | head -1)" 2> /dev/null
started s4 && ok "a killed suite frees the lock" || fail "the lock stayed held after the suite was killed"
: > "$SCRATCH/s4.release"

# 6. the command's own exit status comes back
bash "$L" shared -- bash -c 'exit 7'; [ $? = 7 ] && ok "exit status passes through" || fail "exit status lost"

[ $fails = 0 ] && { echo "suite-lock: all passed"; exit 0; }
echo "suite-lock: $fails failed"; exit 1
