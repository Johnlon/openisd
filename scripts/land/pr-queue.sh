#!/usr/bin/env bash
# Make sure an open pull request is queued for merge (T815, John 15 Nov 2026):
#
#   bash scripts/land/pr-queue.sh <pull-request-number>
#
# ship.sh sets auto-merge and confirms it. GitHub drops the request when the pull request is ejected from the merge queue
# (a pull request ahead of it failed), and the pull request then sits green and unqueued (five times on 14-15 Nov). Run this
# after any such ejection, or to check a pull request: it prints merged, auto-merge or in-merge-queue and exits 0, or
# re-enables auto-merge (squash) and confirms it. Exit 1 when GitHub still holds no request: say so, do not assume.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
n="${1:?usage: pr-queue.sh <pull-request-number>}"
[[ "$n" =~ ^[0-9]+$ ]] || { echo "pr-queue: '$n' is not a pull request number" >&2; exit 2; }
SHIP_REPO=""; [ -f "$ROOT/ship.conf" ] && . "$ROOT/ship.conf"
export ACTIONS_REPO="${SHIP_REPO:?pr-queue: SHIP_REPO is not set in ship.conf}"
if v="$(bash "$HERE/pr.sh" queued "$n")"; then echo "pr-queue: #$n already $v"; exit 0; fi
exec bash "$HERE/pr.sh" queue "$n"
