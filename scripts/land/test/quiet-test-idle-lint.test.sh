#!/usr/bin/env bash
# quiet-test never idle-kills lint or typecheck (deterministic tools, no timeout), still idle-kills
# other silent commands, and counts a busy grandchild as progress (the /proc CPU sampling). T488.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
QT="$REPO/scripts/quiet-test.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/qt-idle.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }
eq() { [ "$2" = "$3" ] && ok "$1" || fail "$1: got '$2', want '$3'"; }
export QUIET_LOG_DIR="$SCRATCH/logs" QUIET_POLL_S=1 OPENISD_IDLE_LIMIT_S=3 BUDGET_DIR="$SCRATCH/budget" ADMIT_DIR="$SCRATCH/admit"
unset ADMIT_TOKEN
mkdir -p "$SCRATCH/bin"
printf '#!/usr/bin/env bash\nsleep "${FAKE_SLEEP:-1}"\nexit "${FAKE_EXIT:-0}"\n' > "$SCRATCH/bin/npm"
chmod +x "$SCRATCH/bin/npm"
export PATH="$SCRATCH/bin:$PATH"

FAKE_SLEEP=7 bash "$QT" npm run lint > /dev/null 2>&1; eq "silent idle lint is not killed" "$?" 0
FAKE_SLEEP=7 bash "$QT" npm run typecheck > /dev/null 2>&1; eq "silent idle typecheck is not killed" "$?" 0
FAKE_SLEEP=7 bash "$QT" bash -c 'sleep 7' > /dev/null 2>&1; eq "a silent idle other command is still stopped" "$?" 124
bash "$QT" bash -c 'timeout 7 bash -c "while :; do :; done" & wait' > /dev/null 2>&1
eq "a silent busy grandchild counts as progress" "$?" 0
[ "$fails" = 0 ] && { echo "quiet-test-idle-lint: all passed"; exit 0; }
exit 1
