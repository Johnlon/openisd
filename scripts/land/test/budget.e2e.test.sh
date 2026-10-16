#!/usr/bin/env bash
# End-to-end test of the memory admission pool (scripts/budget.sh) with real concurrent processes in a
# scratch lock directory and a small scratch config: 4 general tokens, 3 small, 2 suite.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"
pids=()
cleanup() { for p in "${pids[@]}"; do kill -9 "$p" 2> /dev/null; done; wait 2> /dev/null; rm -rf "$SCRATCH"; }
trap cleanup EXIT
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
cat > "$SCRATCH/budget.conf" <<'CONF'
BUDGET_MB=900
TOKEN_MB=100
POOL_SUITE_MB=200
POOL_SMALL_MB=300
POOL_GENERAL_MB=400
CONF
export BUDGET_CONF="$SCRATCH/budget.conf" BUDGET_DIR="$SCRATCH/locks" OPENISD_RUNTIME_DIR="$SCRATCH/run"
B="$REPO/scripts/budget.sh"
started() { [ -e "$SCRATCH/$1.started" ]; }
waitfor() { local i; for i in $(seq 1 100); do "$@" && return 0; sleep 0.1; done; return 1; }
# A job: records that it started, then holds its tokens until its release file appears.
job() { # name pool mb
  setsid bash "$B" "$2" "$3" -- bash -c "touch '$SCRATCH/$1.started'; while [ ! -e '$SCRATCH/$1.release' ]; do sleep 0.1; done" > "$SCRATCH/$1.log" 2>&1 &
  pids+=($!)
}
release() { touch "$SCRATCH/$1.release"; }

job a general 200; waitfor started a && ok "a job that fits starts at once" || fail "a did not start"
job b general 200; waitfor started b && ok "a second job that fits alongside starts at once" || fail "b did not start"
job c general 100
sleep 1
if started c; then fail "c started with the pool full"; else ok "a job that does not fit waits"; fi
grep -q "waiting for the general pool" "$SCRATCH/c.log" && ok "the wait is announced" || fail "no announcement: $(cat "$SCRATCH/c.log")"
release a
waitfor started c && ok "it starts the moment a job ends" || fail "c never started"
grep -q "starting" "$SCRATCH/c.log" && ok "and says it is starting" || fail "no start line"

# arrival order: a big job waiting is not overtaken by a later small one
job d general 300   # 2 held by b + 1 by c: only 1 token free, d needs 3
sleep 0.5
job e general 100   # fits the free token, but d is ahead
sleep 1
if started e; then fail "e overtook the waiting big job d"; else ok "a later small job does not overtake a waiting big one"; fi
release b; release c
waitfor started d && ok "the big job starts once enough is free" || fail "d never started"
waitfor started e && ok "then the small one" || fail "e never started"
release d; release e

# the small pool is separate: lint-sized jobs start at once however full the general pool is
job f general 400; waitfor started f
job g small 300; waitfor started g && ok "the small pool is free while the general pool is full" || fail "g did not start"
job h suite 200; waitfor started h && ok "the suite pool is its own reserve" || fail "h did not start"
release g; release h

# a job killed outright frees its tokens (the kernel drops the flocks; no cleanup runs)
release f
job j general 400; waitfor started j
holder=${pids[-1]}
job k general 100
sleep 0.5
if started k; then fail "k started in a full pool"; else ok "k waits behind j"; fi
kill -9 -- "-$holder" 2> /dev/null
waitfor started k && ok "a job killed with SIGKILL frees its tokens and the next one starts" || fail "k never started after j was killed"
release k

[ "$fails" = 0 ] || { echo "$fails failure(s)"; exit 1; }
echo "all passed"
