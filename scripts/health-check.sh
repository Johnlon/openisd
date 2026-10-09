#!/usr/bin/env bash
if [ -z "$PROCEED" ]
then
	echo AGENT : DO NOT RUN HEALTH CHECK UNLESS ALL THE UNIT TESTS IN THIS PLAN ALREADY WORK
	exit 1
fi
# Run all project health checks on a commit (default HEAD): lint, type check, unit tests,
# browser tests, preview. Exit code 0 = all passed. Non-zero = something failed.
# Add new checks to the health-check case in scripts/slow-run/slow-run.sh — the single list.
#
#   PROCEED=1 bash scripts/health-check.sh            HEAD
#   PROCEED=1 bash scripts/health-check.sh <sha>      another commit
#
# This is a slow run (John, 2026-10-07): it waits in the machine-wide queue behind any other slow
# run (a second health check queues, it is not refused), and it tests the COMMIT in a temporary
# git worktree outside the repo — uncommitted edits in the shared tree are not tested. Commit
# first. A few failing spec files are rerun once; passing on the rerun logs them as FLAKY.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || [ "$(uname -s)" = Linux ]; } || { echo "ERROR: must run in Git Bash on Windows, WSL or Linux, not PowerShell/cmd" >&2; exit 1; }

exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/slow-run/slow-run.sh" health-check "$@"
