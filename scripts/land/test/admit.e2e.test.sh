#!/usr/bin/env bash
# T011 acceptance (locked; author lots). Machine-wide admission control for heavy jobs.
#
# Contract under test:
#   bash scripts/admit.sh <label> -- <command...>
#       waits FIFO for the one slot under ADMIT_DIR, printing once the label it waits behind;
#       runs the command with ADMIT_TOKEN exported and OPENISD_RUN_ID set; frees the slot on any
#       exit; exits with the command's status.
#   The slot records owner pid and its start time; bash scripts/housekeeping.sh frees a slot whose
#   owner is dead (pid gone, or pid reused with another start time) and logs it.
#   ADMIT_DIR defaults to a machine-wide path; tests point it at a scratch dir.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/admit-e2e.XXXXXX")"
export ADMIT_DIR="$SCRATCH/admit"
fails=0
trap 'rm -rf "$SCRATCH"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
A="$REPO/scripts/admit.sh"
LOG="$SCRATCH/seq"

job() { # job <name> <seconds>
    echo "start $1" >> "$LOG"; sleep "$2"; echo "end $1" >> "$LOG"
}
export -f job; export LOG

# 1. one slot: three heavy jobs run one at a time, in arrival order
timeout 60 bash "$A" first -- bash -c 'job first 2' > "$SCRATCH/o1" 2>&1 & p1=$!
sleep 0.5
timeout 60 bash "$A" second -- bash -c 'job second 1' > "$SCRATCH/o2" 2>&1 & p2=$!
sleep 0.5
timeout 60 bash "$A" third -- bash -c 'job third 1' > "$SCRATCH/o3" 2>&1 & p3=$!
wait $p1 $p2 $p3
seq=$(tr '\n' ' ' < "$LOG")
if [ "$seq" = "start first end first start second end second start third end third " ]; then
    ok "one slot, FIFO"; else fail "order: $seq"; fi
grep -q first "$SCRATCH/o2" && ok "waiter names what it waits behind" || fail "waiter did not name the holder"

# 2. exit status passes through; slot freed after failure
timeout 30 bash "$A" bad -- bash -c 'exit 7'; r=$?
[ $r = 7 ] && ok "exit status passed through" || fail "exit status $r"
timeout 10 bash "$A" after -- true; r=$?
[ $r = 0 ] && ok "slot free after a failed job" || fail "slot stuck after failure (r=$r)"

# 3. token and run id exported to the job
out=$(timeout 10 bash "$A" env -- bash -c 'echo "${ADMIT_TOKEN:-none} ${OPENISD_RUN_ID:-none}"')
case "$out" in *none*) fail "token/run id missing: $out" ;; *) ok "token and run id exported" ;; esac

# 4. a dead owner's slot is freed by the housekeeper, and the waiter then runs
# admit.sh itself is SIGKILLed (no `timeout` wrapper: uutils timeout forwards SIGTERM to its child,
# which lets admit.sh clean up politely, so the owner would not be dead). Amended by lots 2026-10-08.
bash "$A" doomed -- sleep 50 & dpid=$!
sleep 1
kill -KILL "$dpid" 2>/dev/null; wait "$dpid" 2>/dev/null
timeout 60 bash "$A" waiter -- true > "$SCRATCH/o4" 2>&1 & wpid=$!
sleep 1
timeout 30 bash "$REPO/scripts/housekeeping.sh" > "$SCRATCH/hk" 2>&1
wait "$wpid"; r=$?
if [ $r = 0 ] && grep -qi doomed "$SCRATCH/hk"; then ok "dead owner's slot freed, waiter ran"
else fail "dead owner (r=$r): $(tr '\n' ' ' < "$SCRATCH/hk")"; fi

# 5. a land.sh fast gate is not blocked while the slot is held
timeout 60 bash "$A" holder -- sleep 8 & hpid=$!
sleep 1
grep -q 'admit' "$REPO/scripts/land/core/"* 2>/dev/null && fail "land.sh core calls admit (fast gates must not queue)" \
    || ok "land.sh fast gates do not take the slot"
wait "$hpid"

# 6. the heavy wrappers go through admit.sh
# Amended by lots 2026-10-08: the hooks run no suite after T004 (fast hooks), so they are not heavy
# wrappers; the post-land suite is. heavy.sh is the repo copy (T011 D), the live one is replaced from it.
for f in "$REPO/scripts/quiet-test.sh" "$REPO/scripts/heavy.sh" "$REPO/scripts/land/post-land/suite.sh"; do
    if [ -f "$f" ] && grep -q 'admit.sh' "$f"; then ok "uses admit.sh: ${f/#$HOME/~}"
    else fail "does not use admit.sh: ${f/#$HOME/~}"; fi
done

[ $fails = 0 ] && { echo "admit.e2e: all passed"; exit 0; }
echo "admit.e2e: $fails failed"; exit 1
