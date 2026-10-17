#!/usr/bin/env bash
# scripts/land/test/ts-log.test.sh — unit test for scripts/lib/ts-log.sh
# Verifies:
#   1. lines read on stdin are prefixed with UTC ISO timestamp (.mmmZ) and run ID
#   2. command execution prefixes output lines and preserves exit status
#   3. run_start and run_end write correctly formatted lines with accurate duration
#   4. works both when sourced and when invoked as a CLI
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TS_LOG="$REPO/scripts/lib/ts-log.sh"

fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# Check timestamp regex: YYYY-MM-DDTHH:MM:SS.mmmZ
TS_REGEX='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z'

# 1. Stdin piping with custom OPENISD_RUN_ID
export OPENISD_RUN_ID="RUN-TEST-001"
out=$(printf "alpha\nbeta\n" | bash "$TS_LOG")
line1=$(echo "$out" | sed -n '1p')
line2=$(echo "$out" | sed -n '2p')

if echo "$line1" | grep -qE "${TS_REGEX} RUN-TEST-001 alpha$"; then
  ok "stdin line 1 timestamped with millisecond UTC and run ID"
else
  fail "stdin line 1 got: '$line1'"
fi

if echo "$line2" | grep -qE "${TS_REGEX} RUN-TEST-001 beta$"; then
  ok "stdin line 2 timestamped with millisecond UTC and run ID"
else
  fail "stdin line 2 got: '$line2'"
fi

# 2. Exit status preservation when running commands
rc=0
bash "$TS_LOG" true > /dev/null || rc=$?
[ "$rc" = 0 ] && ok "exit status 0 preserved" || fail "exit status 0 got: $rc"

rc=0
bash "$TS_LOG" false > /dev/null || rc=$?
[ "$rc" = 1 ] && ok "exit status 1 preserved" || fail "exit status 1 got: $rc"

rc=0
bash "$TS_LOG" sh -c 'exit 42' > /dev/null || rc=$?
[ "$rc" = 42 ] && ok "exit status 42 preserved" || fail "exit status 42 got: $rc"

# Command output is also prefixed
cmd_out=$(bash "$TS_LOG" echo "gamma")
if echo "$cmd_out" | grep -qE "${TS_REGEX} RUN-TEST-001 gamma$"; then
  ok "command execution output prefixed"
else
  fail "command execution output got: '$cmd_out'"
fi

# 3. Default run ID when OPENISD_RUN_ID is unset
unset OPENISD_RUN_ID
def_out=$(echo "delta" | bash "$TS_LOG")
if echo "$def_out" | grep -qE "${TS_REGEX} [0-9]+ delta$"; then
  ok "default run ID is numeric pid when OPENISD_RUN_ID is unset"
else
  fail "default run ID output got: '$def_out'"
fi

# 4. run_start and run_end when sourced
export OPENISD_RUN_ID="SOURCED-RUN"
# shellcheck source=../../lib/ts-log.sh
. "$TS_LOG"

run_start "test-job" > "${TMPDIR:-/tmp}/ts-log-test.$$"; start_line=$(cat "${TMPDIR:-/tmp}/ts-log-test.$$"); rm -f "${TMPDIR:-/tmp}/ts-log-test.$$"
if echo "$start_line" | grep -qE "${TS_REGEX} SOURCED-RUN START test-job$"; then
  ok "run_start line format correct"
else
  fail "run_start got: '$start_line'"
fi

sleep 1

end_line=$(run_end "test-job" 0)
if echo "$end_line" | grep -qE "${TS_REGEX} SOURCED-RUN END test-job status=0 duration_s=1$"; then
  ok "run_end line format and duration_s=1 correct after sleep 1"
else
  fail "run_end got: '$end_line'"
fi

# 5. run_start and run_end across subshells / CLI invocations
export OPENISD_RUN_ID="CLI-RUN"
cli_start=$(bash "$TS_LOG" run_start "cli-job")
if echo "$cli_start" | grep -qE "${TS_REGEX} CLI-RUN START cli-job$"; then
  ok "CLI run_start line format correct"
else
  fail "CLI run_start got: '$cli_start'"
fi

cli_end=$(bash "$TS_LOG" run_end "cli-job" 7)
if echo "$cli_end" | grep -qE "${TS_REGEX} CLI-RUN END cli-job status=7 duration_s=[0-9]+$"; then
  ok "CLI run_end line format and non-zero exit status preserved"
else
  fail "CLI run_end got: '$cli_end'"
fi

# 6. ts_log function preserves pipefail exit status
rc=0
set +e
ts_log sh -c 'echo failing; exit 19' > /dev/null 2>&1 || rc=$?
set -e
[ "$rc" = 19 ] && ok "ts_log helper preserved exit 19" || fail "ts_log exit got: $rc"

[ $fails = 0 ] && { echo "ts-log: all passed"; exit 0; }
echo "ts-log: $fails failed"; exit 1
