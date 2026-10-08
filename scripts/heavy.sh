#!/usr/bin/env bash
# Run a build/test command so it cannot take the machine down.
#
#   scripts/heavy.sh [--slow] <command> [args...]
#
#   Every run is placed in ONE shared cgroup, heavy.slice, which carries the whole memory and CPU
#   ceiling (it lives in ~/.config/systemd/user/heavy.slice; change it there and
#   `systemctl --user daemon-reload`). Memory is what kills this box: the kernel reclaims and
#   kills INSIDE the slice instead of taking an ssh or agent session with it.
#
#   Targeted run (no flag; single files or directories): runs in the slice at once. It takes no
#   slot and never waits behind a heavy job (John, 2026-10-08: "small tests must make progress").
#
#   --slow (full suite, full lint, browser batch, rebuild, corpus run): goes through
#   scripts/admit.sh, the machine's one FIFO admission slot. It prints who it waits behind and a
#   heartbeat every 30 s while waiting, and a start and an end line.
#
# Env: HEAVY_ADMIT (path to admit.sh; default beside this script, or the openisd checkout's when
# this file is a copy elsewhere, e.g. ~/.claude/bin).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SLICE=heavy.slice

usage() { echo "usage: heavy.sh [--slow] <command> [args...]" >&2; exit 2; }
[ $# -gt 0 ] || usage

slow=0
if [ "$1" = "--slow" ]; then slow=1; shift; [ $# -gt 0 ] || usage; fi


if [ "$slow" = 0 ]; then
  exec systemd-run --user --scope --quiet --collect --slice="$SLICE" -- "$@"
fi

ADMIT="${HEAVY_ADMIT:-$HERE/admit.sh}"
[ -n "${HEAVY_ADMIT:-}" ] || [ -r "$ADMIT" ] || ADMIT=/home/john/work/winisd/openisd/scripts/admit.sh
# No admission, no heavy run: starting it unadmitted is what kills the machine.
[ -r "$ADMIT" ] || { echo "heavy: --slow needs the admission script at ${HEAVY_ADMIT:-$HERE/admit.sh} — not starting" >&2; exit 2; }
exec bash "$ADMIT" "heavy.sh $*" -- systemd-run --user --scope --quiet --collect --slice="$SLICE" -- "$@"
