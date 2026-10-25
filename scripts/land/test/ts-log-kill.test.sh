#!/usr/bin/env bash
# The logger wrapper and quiet-test stop a run's whole process group, pass the command's own exit
# code through, and leave no process carrying the run's OPENISD_RUN_ID (processes.md rules 2, 3).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ts-log-kill.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }
eq() { [ "$2" = "$3" ] && ok "$1" || fail "$1: got '$2', want '$3'"; }
# pids whose environment carries the run id (read by pid, never by command text)
carriers() { local p n=0; for p in /proc/[0-9]*; do { tr '\0' '\n' < "$p/environ" 2> /dev/null | grep -qx "OPENISD_RUN_ID=$1"; } 2> /dev/null && n=$((n + 1)); done; echo "$n"; }

eq "command's own exit code passes through" "$(OPENISD_RUN_ID=kt-rc bash "$REPO/scripts/lib/ts-log.sh" bash -c 'exit 42' > /dev/null; echo $?)" 42

OPENISD_RUN_ID=kt-term bash "$REPO/scripts/lib/ts-log.sh" bash -c 'sleep 300 & sleep 300 & wait' > /dev/null 2>&1 & w=$!
sleep 1.5; kill -TERM "$w"; wait "$w"; eq "TERM to the wrapper: exit 143" "$?" 143
sleep 0.5; eq "TERM to the wrapper: no survivor" "$(carriers kt-term)" 0

OPENISD_RUN_ID=kt-ign bash "$REPO/scripts/lib/ts-log.sh" bash -c 'trap "" TERM; sleep 300 & wait' > /dev/null 2>&1 & w=$!
sleep 1.5; kill -TERM "$w"; wait "$w"; sleep 1.5
eq "a child that ignores TERM is killed" "$(carriers kt-ign)" 0

# quiet-test: a stalled run is stopped by session, exit 124, children gone
QUIET_LOG_DIR="$SCRATCH/logs" QUIET_POLL_S=1 OPENISD_IDLE_LIMIT_S=4 OPENISD_RUN_ID=kt-stall \
  bash "$REPO/scripts/quiet-test.sh" bash -c 'sleep 300 & sleep 300 & wait' > "$SCRATCH/stall.out" 2>&1
eq "stalled quiet-test: exit 124" "$?" 124
eq "stalled quiet-test: no survivor" "$(carriers kt-stall)" 0
grep -qE ' kt-stall START quiet-test$' "$SCRATCH"/logs/*.log && grep -qE ' kt-stall END quiet-test status=124 duration_s=' "$SCRATCH"/logs/*.log && ok "START and END are in the log file" || fail "log lacks START/END"

[ "$fails" = 0 ] && { echo "ts-log-kill: all passed"; exit 0; }
echo "ts-log-kill: $fails failed"; exit 1
