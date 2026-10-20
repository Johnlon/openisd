#!/usr/bin/env bash
# A landing gate's deadline starts after the gate is admitted (T487): scripts/land/core/gate.sh run_gate asks
# scripts/budget-cost.sh what the gate costs and waits for it outside `timeout`. Real processes, scratch locks.
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
COST_VITEST_FULL_MB=200
COST_CPU_VITEST_FULL=1
CONF
export BUDGET_CONF="$SCRATCH/budget.conf" BUDGET_DIR="$SCRATCH/locks" OPENISD_RUNTIME_DIR="$SCRATCH/run" OPENISD_STATE_DIR="$SCRATCH/state"
# A gate whose command line is costed as a unit run (budget-cost.sh: unit-changed).
cat > "$SCRATCH/unit-changed.sh" <<'EOS'
#!/usr/bin/env bash
sleep 0.1
echo gate-ran
EOS
. "$REPO/scripts/land/core/gate.sh"
trap - EXIT
GATE_OUT="$SCRATCH/gate.out"

# 1. A blocker holds the whole general pool for 4 s; the gate has a 2 s deadline and a 0.1 s job: it must pass.
setsid bash "$REPO/scripts/budget.sh" general 400 --cpu 1 -- sleep 4 > /dev/null 2>&1 &
pids+=($!)
sleep 0.5
GATE_DEADLINE_S=2
start=$SECONDS
( run_gate unit /dev/null "bash $SCRATCH/unit-changed.sh" ) > "$SCRATCH/r1.out" 2>&1
rc=$?
waited=$((SECONDS - start))
[ "$rc" = 0 ] && ok "a gate that waited past its deadline for the pool still passes (waited ${waited} s)" || fail "gate refused (rc $rc): $(cat "$SCRATCH/r1.out")"
[ "$waited" -ge 3 ] && ok "it really waited for the blocker" || fail "the gate did not wait (${waited} s)"
grep -q gate-ran "$GATE_OUT" && ok "and the gate command ran" || fail "gate did not run: $(cat "$GATE_OUT")"
grep -q "deadline" "$SCRATCH/r1.out" && fail "a wait was reported as a deadline kill" || ok "no deadline message for a wait"

# 2. A real overrun is still a deadline kill (admitted at once, then slower than the deadline).
cat > "$SCRATCH/unit-changed.sh" <<'EOS'
#!/usr/bin/env bash
sleep 30
EOS
GATE_DEADLINE_S=1
( run_gate unit /dev/null "bash $SCRATCH/unit-changed.sh" ) > "$SCRATCH/r2.out" 2>&1
rc=$?
[ "$rc" = 1 ] && grep -q "no result within its 1 s deadline" "$SCRATCH/r2.out" && ok "a job slower than the deadline is still killed as a deadline" || fail "overrun: rc $rc $(cat "$SCRATCH/r2.out")"

# 3. gate_stop on a waiting gate leaves nothing behind. The blocker holds the pool for good.
setsid bash "$REPO/scripts/budget.sh" general 400 --cpu 1 -- sleep 60 > /dev/null 2>&1 &
blocker=$!; pids+=($blocker)
sleep 0.5
# gate_stop needs GATE_PID of the same shell: send land.sh's own stop (TERM) to the shell running the gate.
cat > "$SCRATCH/stop.sh" <<EOS
. "$REPO/scripts/land/core/gate.sh"
GATE_OUT="$SCRATCH/gate.out"; GATE_DEADLINE_S=5
trap 'gate_stop; exit 143' TERM
echo \$\$ > "$SCRATCH/lander.pid"
run_gate unit /dev/null "bash $SCRATCH/unit-changed.sh"
EOS
setsid bash "$SCRATCH/stop.sh" > "$SCRATCH/r3.out" 2>&1 &
pids+=($!)
sleep 1
lander="$(cat "$SCRATCH/lander.pid")"
kill -TERM "$lander"
sleep 1
# nothing of the gate is left: the gate lock and the cpu lock are free (only the blocker holds its tokens)
gate_free=0; flock -n "$SCRATCH/locks/general/gate" -c true && gate_free=1
[ "$gate_free" = 1 ] && ok "the stopped waiting gate gave up the queue" || fail "the pool gate is still held after gate_stop"
leftover=0
for pid in /proc/[0-9]*; do
  [ "$(cat "$pid/environ" 2> /dev/null | tr '\0' '\n' | grep -c "^BUDGET_DIR=$SCRATCH/locks$")" = 1 ] || continue
  p="${pid#/proc/}"
  [ "$p" = "$blocker" ] && continue
  # children of the blocker (sleep 60) carry the same env: skip every process in the blocker's session
  [ "$(ps -o sid= -p "$p" 2> /dev/null | tr -d ' ')" = "$blocker" ] && continue
  case "$(tr '\0' ' ' < "$pid/cmdline" 2> /dev/null)" in *"$SCRATCH"*) leftover=$((leftover + 1)); echo "left: $p $(tr '\0' ' ' < "$pid/cmdline")" ;; esac
done
[ "$leftover" = 0 ] && ok "no process of the stopped gate is left" || fail "$leftover process(es) left after gate_stop"

[ "$fails" = 0 ] || { echo "$fails failure(s)"; exit 1; }
echo "all passed"
