#!/usr/bin/env bash
# scripts/quiet-test.sh: heavy commands take the one admission slot, targeted ones run at once,
# and a long run prints a heartbeat line and an end line on stderr. Scratch ADMIT_DIR, fake npm.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
QT="$REPO/scripts/quiet-test.sh"
SCRATCH=$(mktemp -d)
PIDS=()
cleanup() { local p; for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2> /dev/null; done; rm -rf "$SCRATCH"; }
trap cleanup EXIT
export ADMIT_DIR="$SCRATCH/admit" QUIET_LOG_DIR="$SCRATCH/logs"
unset ADMIT_TOKEN
export QUIET_POLL_S=1
mkdir -p "$SCRATCH/bin"
# fake npm: sleeps FAKE_SLEEP s, then exits FAKE_EXIT
printf '#!/usr/bin/env bash\nsleep "${FAKE_SLEEP:-1}"\nexit "${FAKE_EXIT:-0}"\n' > "$SCRATCH/bin/npm"
chmod +x "$SCRATCH/bin/npm"
export PATH="$SCRATCH/bin:$PATH"

fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
eq()   { [ "$2" = "$3" ] && ok "$1" || fail "$1: got '$2', want '$3'"; }
nrec() { ls "$ADMIT_DIR"/q/*.rec 2> /dev/null | wc -l; }
# wait (bounded) until at least $1 records exist
await_recs() { local i; for i in $(seq 1 50); do [ "$(nrec)" -ge "$1" ] && return 0; sleep 0.1; done; return 1; }

grep -q 'admit.sh' "$QT" && ok "script mentions admit.sh" || fail "script does not mention admit.sh"

# (a) heavy takes the slot while it runs, and frees it after
FAKE_SLEEP=6 bash "$QT" npm run lint > "$SCRATCH/h1.out" 2> "$SCRATCH/h1.err" &
H1=$!; PIDS+=("$H1")
await_recs 1 && ok "heavy run has a record in the queue" || fail "no admission record while heavy runs"
# (b) second heavy waits behind it; targeted runs at once
FAKE_SLEEP=1 bash "$QT" npm run typecheck > "$SCRATCH/h2.out" 2> "$SCRATCH/h2.err" &
H2=$!; PIDS+=("$H2")
await_recs 2 && ok "second heavy queues behind the first" || fail "second heavy has no record"
bash "$QT" bash -c 'echo hi' > "$SCRATCH/t.out" 2> "$SCRATCH/t.err"; tcode=$?
kill -0 "$H1" 2> /dev/null && [ "$(nrec)" -ge 2 ] && ok "targeted command runs at once while the slot is held" || fail "targeted command was held up"
eq "targeted exit code" "$tcode" 0
grep -q '^hi$' "$SCRATCH/t.out" && ok "targeted output shown" || fail "targeted output missing"
wait "$H1"; c1=$?; T1=$SECONDS
wait "$H2"; c2=$?; T2=$SECONDS
eq "heavy exit code 0" "$c1" 0
eq "second heavy exit code 0" "$c2" 0
[ "$T2" -ge "$T1" ] && ok "second heavy finished after the first" || fail "second heavy overtook the first"
eq "slot freed after the runs" "$(nrec)" 0

# (c) failing exit codes pass through, heavy and targeted
FAKE_EXIT=4 FAKE_SLEEP=0 bash "$QT" npm run lint > /dev/null 2>&1; eq "heavy exit code 4" "$?" 4
bash "$QT" bash -c 'exit 3' > "$SCRATCH/f.out" 2> "$SCRATCH/f.err"; eq "targeted exit code 3" "$?" 3

# (d) ADMIT_TOKEN set: no second admit
ADMIT_TOKEN=x FAKE_SLEEP=2 bash "$QT" npm run lint > /dev/null 2>&1 &
H3=$!; PIDS+=("$H3")
sleep 0.7
eq "no admission record when ADMIT_TOKEN is set" "$(nrec)" 0
wait "$H3"

# working form: a run that keeps writing
QUIET_HEARTBEAT_S=2 bash "$QT" bash -c 'for i in 1 2 3 4; do echo x$i; sleep 1; done' > /dev/null 2> "$SCRATCH/w.err"
grep -q '^quiet-test: working, elapsed 0m0[0-9]s, idle 0 s, log [0-9]* KB$' "$SCRATCH/w.err" && ok "working line" || fail "no working line: $(cat "$SCRATCH/w.err")"
# heartbeat: sleep 4, poll 1 s, beat 2 s
QUIET_HEARTBEAT_S=2 bash "$QT" sleep 4 > "$SCRATCH/b.out" 2> "$SCRATCH/b.err"
# a bare sleep is idle (no log growth, no CPU), so its beat is the IDLE form
[ "$(grep -cE '^quiet-test: (working, elapsed |IDLE for [0-9]+ s \(stalls at 180 s\))' "$SCRATCH/b.err")" -ge 1 ] && ok "a heartbeat line on stderr" || fail "no working line: $(cat "$SCRATCH/b.err")"
eq "exactly one finished line" "$(grep -c 'quiet-test finished: ok after ' "$SCRATCH/b.err")" 1
grep -q 'working\|finished' "$SCRATCH/b.out" && fail "heartbeat leaked to stdout" || ok "stdout carries no heartbeat"
eq "stdout is the log line and exit line" "$(wc -l < "$SCRATCH/b.out")" 1
QUIET_HEARTBEAT_S=2 bash "$QT" bash -c 'sleep 3; exit 3' > /dev/null 2> "$SCRATCH/e.err"
grep -q 'quiet-test finished: FAILED (exit 3) after ' "$SCRATCH/e.err" && ok "failed end line" || fail "no FAILED end line: $(cat "$SCRATCH/e.err")"

[ $fails = 0 ] && { echo "quiet-test: all passed"; exit 0; }
echo "quiet-test: $fails failed"; exit 1
