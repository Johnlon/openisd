#!/usr/bin/env bash
# scripts/metrics.sh — reads test logs and git into metrics.json and index.html
#
# Rule (processes.md rule 8):
#   "Metrics come from these logs plus git, read by one script. There is no second event store."
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

python3 "$HERE/lib/metrics.py" --repo-root "$ROOT" "$@"
