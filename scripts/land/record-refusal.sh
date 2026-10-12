#!/usr/bin/env bash
# Append one refusal to the durable record the watchdog reads: bash scripts/land/record-refusal.sh <gate> [task]
# Line: "<epoch> <gate> <task>" in $OPENISD_RUNTIME_DIR/land-refusals.log (env WATCHDOG_REFUSALS overrides).
# land.sh's refuse() should call this; wiring it in is its own landing (land.sh is live).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../paths.sh
. "$HERE/../paths.sh"
GATE="${1:?usage: record-refusal.sh <gate> [task]}"
FILE="${WATCHDOG_REFUSALS:-$OPENISD_RUNTIME_DIR/land-refusals.log}"
printf '%s %s %s\n' "$(date +%s)" "$GATE" "${2:--}" >> "$FILE"
