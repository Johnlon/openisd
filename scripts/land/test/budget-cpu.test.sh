#!/usr/bin/env bash
# CPU admission (scripts/budget.sh --cpu, T487) with real concurrent processes in a scratch lock directory:
# CPU tokens block a job when the cores are used up, memory and CPU are taken together or not at all,
# a call from another repo's cwd works, a job asking for too many cores is capped, and a wait shows the load.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"
pids=()
cleanup() { for p in "${pids[@]}"; do kill -9 -- "-$p" 2> /dev/null; kill -9 "$p" 2> /dev/null; done; wait 2> /dev/null; rm -rf "$SCRATCH"; }
trap cleanup EXIT
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
cat > "$SCRATCH/budget.conf" <<'CONF'
BUDGET_MB=900
TOKEN_MB=100
POOL_SMALL_MB=300
POOL_GENERAL_MB=400
CPU_TOKENS=2
CONF
export BUDGET_CONF="$SCRATCH/budget.conf" BUDGET_DIR="$SCRATCH/locks" OPENISD_RUNTIME_DIR="$SCRATCH/run" OPENISD_STATE_DIR="$SCRATCH/state"
B="$REPO/scripts/budget.sh"
started() { [ -e "$SCRATCH/$1.started" ]; }
waitfor() { local i; for i in $(seq 1 100); do "$@" && return 0; sleep 0.1; done; return 1; }
job() { # name pool mb cpu
  setsid bash "$B" "$2" "$3" --cpu "$4" -- bash -c "touch '$SCRATCH/$1.started'; while [ ! -e '$SCRATCH/$1.release' ]; do sleep 0.1; done" > "$SCRATCH/$1.log" 2>&1 &
  pids+=($!)
}
release() { touch "$SCRATCH/$1.release"; }

job a general 100 2; waitfor started a && ok "a job whose cores are free starts" || fail "a did not start: $(cat "$SCRATCH/a.log")"
job b general 100 1
sleep 1
if started b; then fail "b started with every core in use and memory free"; else ok "memory is free but the cores are used up: b waits"; fi
grep -q "cpu" "$SCRATCH/b.log" && ok "the wait names the cores" || fail "no cpu in the wait message: $(cat "$SCRATCH/b.log")"
grep -Eq "load [0-9]+\.[0-9]+" "$SCRATCH/b.log" && ok "the wait shows the load average" || fail "no load in the wait message: $(cat "$SCRATCH/b.log")"

# atomic: b must hold no memory token while it waits for cores
busy=0; for t in "$SCRATCH"/locks/general/t*; do
  [ -e "$t" ] || continue
  flock -n "$t" -c true || busy=$((busy + 1))
done
[ "$busy" = 1 ] && ok "the waiting job holds no memory (only a's token is held)" || fail "memory tokens held while b waits: $busy (wanted 1, a's)"

release a
waitfor started b && ok "b starts when the cores free" || fail "b never started"
release b

# a different pool shares the cores
job c small 100 2; waitfor started c
job d general 100 1
sleep 1
if started d; then fail "d (general) started while c (small) holds both cores"; else ok "the cores are shared across pools"; fi
release c; waitfor started d && ok "and it starts when they free" || fail "d never started"
release d

# a call from another repo's cwd works, needing nothing from that repo
mkdir -p "$SCRATCH/elsewhere"
( cd "$SCRATCH/elsewhere" && bash "$B" general 100 --cpu 1 -- bash -c 'echo ran-elsewhere' ) > "$SCRATCH/else.out" 2>&1
grep -q ran-elsewhere "$SCRATCH/else.out" && ok "budget.sh works from any cwd" || fail "other cwd: $(cat "$SCRATCH/else.out")"

# asking for more cores than there are is capped, with a note, and still runs
bash "$B" general 100 --cpu 99 -- bash -c 'echo ran-capped' > "$SCRATCH/cap.out" 2>&1
grep -q ran-capped "$SCRATCH/cap.out" && ok "a job asking 99 of 2 cores runs (capped)" || fail "capped: $(cat "$SCRATCH/cap.out")"
grep -q "capped" "$SCRATCH/cap.out" && ok "and says it was capped" || fail "no cap note: $(cat "$SCRATCH/cap.out")"

# no --cpu means one core
job e general 100 1; waitfor started e
bash "$B" general 100 -- bash -c 'echo ran-default' > "$SCRATCH/def.out" 2>&1
grep -q ran-default "$SCRATCH/def.out" && ok "no --cpu defaults to 1 core (one left beside e)" || fail "default cpu: $(cat "$SCRATCH/def.out")"
release e

# the old suite pool name is an alias of general
bash "$B" suite 100 -- bash -c 'echo ran-suite' > "$SCRATCH/suite.out" 2>&1
grep -q ran-suite "$SCRATCH/suite.out" && ok "pool name suite still works (alias of general)" || fail "suite alias: $(cat "$SCRATCH/suite.out")"

[ "$fails" = 0 ] || { echo "$fails failure(s)"; exit 1; }
echo "all passed"
