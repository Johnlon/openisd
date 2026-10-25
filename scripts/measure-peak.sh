#!/usr/bin/env bash
# bash scripts/measure-peak.sh <label> <command> [args...]
# Runs the command in its own transient scope under heavy.slice and prints the scope's memory.peak
# (the highest memory the command and everything it started used at once) when it ends, as one line:
#   peak <label> <GB> exit <code> seconds <n>
# Used to measure the figures in scripts/budget.conf (docs/design/SUITE_MEMORY.md).
set -uo pipefail
[ $# -ge 2 ] || { echo "usage: measure-peak.sh <label> <command> [args...]" >&2; exit 2; }
label="$1"; shift
if [ -z "${MEASURE_PEAK_IN_SCOPE:-}" ]; then
  exec systemd-run --user --scope --quiet --collect --slice=heavy.slice \
    --property=MemoryAccounting=yes --setenv=MEASURE_PEAK_IN_SCOPE=1 -- bash "$0" "$label" "$@"
fi
cg="/sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup)"
start=$SECONDS
"$@"
code=$?
peak=$(cat "$cg/memory.peak" 2> /dev/null || echo 0)
awk -v l="$label" -v p="$peak" -v c="$code" -v s=$((SECONDS - start)) 'BEGIN { printf "peak %s %.2f GB exit %d seconds %d\n", l, p / 1073741824, c, s }'
exit "$code"
