#!/usr/bin/env bash
# scripts/land/test/ts-log-clock-step.test.sh — ts-log.sh durations come from the monotonic clock
# (T483, bugs/BUG_20261019_land-lint-gate-took-two-hours.md).
# Verifies:
#   1. a wall clock that jumps +7200 s between run_start and run_end gives duration_s of 0-1
#      and clock_step_s of about 7200 (sourced form)
#   2. the same through the CLI form (start persisted in the start file)
#   3. no jump: no clock_step_s field
#   4. an old one-number start file still gives a duration (wall fallback)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TS_LOG="$REPO/scripts/lib/ts-log.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ts-log-clock-step.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# Fake date: adds the seconds held in $SCRATCH/offset to the wall time, as if the clock had stepped.
mkdir -p "$SCRATCH/bin"
REAL_DATE="$(command -v date)"
cat > "$SCRATCH/bin/date" <<SHIM
#!/usr/bin/env bash
off=\$(cat "$SCRATCH/offset" 2>/dev/null || echo 0)
if [ "\$off" = 0 ]; then exec "$REAL_DATE" "\$@"; fi
exec "$REAL_DATE" -d "+\${off} seconds" "\$@"
SHIM
chmod +x "$SCRATCH/bin/date"
export PATH="$SCRATCH/bin:$PATH"
export OPENISD_RUNTIME_DIR="$SCRATCH/run" OPENISD_STATE_DIR="$SCRATCH/state"
export OPENISD_RUN_ID="STEP-RUN"

field() { sed -n "s/.* $1=\(-\?[0-9]*\).*/\1/p" <<<"$2"; }

# 1. sourced
echo 0 > "$SCRATCH/offset"
out=$(bash -c '. "$1"; run_start j >/dev/null; echo 7200 > "$2/offset"; sleep 0.3; run_end j 0' _ "$TS_LOG" "$SCRATCH")
d=$(field duration_s "$out"); c=$(field clock_step_s "$out")
{ [ -n "$d" ] && [ "$d" -le 1 ]; } && ok "sourced: duration_s=$d despite +7200 s step" || fail "sourced duration: '$out'"
{ [ -n "$c" ] && [ "$c" -ge 7198 ] && [ "$c" -le 7202 ]; } && ok "sourced: clock_step_s=$c" || fail "sourced clock_step_s: '$out'"

# 2. CLI
echo 0 > "$SCRATCH/offset"
bash "$TS_LOG" run_start cj >/dev/null
echo 7200 > "$SCRATCH/offset"; sleep 0.3
out=$(bash "$TS_LOG" run_end cj 0)
d=$(field duration_s "$out"); c=$(field clock_step_s "$out")
{ [ -n "$d" ] && [ "$d" -le 1 ]; } && ok "CLI: duration_s=$d despite +7200 s step" || fail "CLI duration: '$out'"
{ [ -n "$c" ] && [ "$c" -ge 7198 ] && [ "$c" -le 7202 ]; } && ok "CLI: clock_step_s=$c" || fail "CLI clock_step_s: '$out'"

# 3. no jump
echo 0 > "$SCRATCH/offset"
out=$(bash -c '. "$1"; run_start n >/dev/null; sleep 0.3; run_end n 0' _ "$TS_LOG")
case "$out" in *clock_step_s*) fail "no-jump line has clock_step_s: '$out'" ;; *duration_s=0) ok "no jump: no clock_step_s" ;; *) fail "no-jump line: '$out'" ;; esac

# 4. old one-number start file
mkdir -p "$SCRATCH/run/ts-STEP-RUN"
echo "$(( $("$REAL_DATE" +%s) * 1000 - 3000 ))" > "$SCRATCH/run/ts-STEP-RUN/old"
out=$(bash "$TS_LOG" run_end old 0)
d=$(field duration_s "$out")
{ [ -n "$d" ] && [ "$d" -ge 2 ] && [ "$d" -le 4 ]; } && ok "old start file: wall fallback duration_s=$d" || fail "old start file: '$out'"

[ $fails = 0 ] && { echo "ts-log-clock-step: all passed"; exit 0; }
echo "ts-log-clock-step: $fails failed"; exit 1
