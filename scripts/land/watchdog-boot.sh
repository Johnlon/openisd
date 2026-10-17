#!/usr/bin/env bash
# The watchdog's start, as systemd runs it. watchdog-install.sh copies this file out of the repo
# (to ~/.local/libexec/openisd/watchdog-boot.sh): the unit never runs a file in the main checkout, which can
# lag main for hours (17 Oct 2026: 22 commits behind, held by an uncommitted file, so T291's and T297's
# watchdog and housekeeping never ran). It runs origin/main's watchdog.sh, which then runs from a snapshot
# of origin/main's scripts (T291).
#   WATCHDOG_REPO  the repo whose origin/main is read (default the main checkout; only git is used)
set -uo pipefail
REPO="${WATCHDOG_REPO:-/home/john/work/winisd/openisd}"
timeout 60 git -C "$REPO" fetch -q origin main 2> /dev/null || echo "watchdog-boot: cannot fetch origin/main; using the local origin/main" >&2
src="$(git -C "$REPO" show origin/main:scripts/land/watchdog.sh)" || { echo "watchdog-boot: cannot read origin/main's scripts/land/watchdog.sh" >&2; exit 2; }
WATCHDOG_REPO="$REPO" exec bash -c "$src" watchdog "$@"
