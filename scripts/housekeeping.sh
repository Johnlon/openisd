#!/usr/bin/env bash
# Frees admission slots whose owner is dead, stops browser runs whose owner is gone, and removes
# post-land clean copies whose owner is dead
# (a reboot on 12 Oct 2026 left six). Usage: bash scripts/housekeeping.sh (env ADMIT_DIR,
# HOUSEKEEPING_LOG, HOUSEKEEPING_POST_LAND_DIR, HOUSEKEEPING_REPO). Format of the records:
# scripts/admit/record.sh; a copy is $POST_LAND_DIR/<owner pid>-<sha> (scripts/land/post-land/run.sh).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=admit/record.sh
. "$ROOT/scripts/admit/record.sh"
. "$ROOT/scripts/lib/ts-log.sh"
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"
run_start "housekeeping"
DIR="$(admit_dir)"
LOG="${HOUSEKEEPING_LOG:-$ROOT/build/test-logs/housekeeping.log}"

die() { echo "housekeeping: $*" >&2; exit 2; }  # a failed scan must be loud, never a quiet pass
say() { # print and log one line (the log is the audit trail the processes rule demands)
  echo "$1"
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$LOG" || die "cannot write log $LOG"
}
zombie() { # a zombie still has a /proc entry but its work is over
  local s; s=$(cat "/proc/$1/stat" 2> /dev/null) || return 1
  s=${s##*) }; [ "${s%% *}" = Z ]
}

mkdir -p "$(dirname "$LOG")" || die "cannot create log dir for $LOG"
shopt -s nullglob

# --- post-land clean copies whose owner is dead ------------------------------------------------
# run.sh removes its own copy on exit; a reboot or a KILL leaves it. Name = "<owner pid>-<sha>".
REPO="${HOUSEKEEPING_REPO:-$ROOT}"
POST_LAND_DIR="${HOUSEKEEPING_POST_LAND_DIR:-$( [ -f "$REPO/land.conf" ] && . "$REPO/land.conf" && echo "${POST_LAND_DIR:-}" )}"
if [ -n "$POST_LAND_DIR" ] && [ -d "$POST_LAND_DIR" ]; then
  for copy in "$POST_LAND_DIR"/[0-9]*-*/; do
    copy=${copy%/}; owner=${copy##*/}; owner=${owner%%-*}
    [ -e "/proc/$owner" ] && ! zombie "$owner" && continue
    git -C "$REPO" worktree remove --force "$copy" 2> /dev/null || rm -rf "$copy"
    [ -e "$copy" ] && die "cannot remove dead post-land copy $copy"
    say "housekeeping: removed post-land copy $copy (owner pid $owner is dead)"
  done
  git -C "$REPO" worktree prune 2> /dev/null || true
fi

# --- browser runs whose owner is gone -----------------------------------------------------------
# A browser run is its own process group (test-browser.sh's setsid), so its owner stopping by group
# misses it, and its own pid stays alive. Judge it by its recorded owner: scripts/browser-runs.sh.
# shellcheck source=browser-runs.sh
. "$ROOT/scripts/browser-runs.sh"
if [ -d "$OPENISD_RESERVATION_DIR" ]; then
  [ -r "$OPENISD_RESERVATION_DIR" ] && [ -x "$OPENISD_RESERVATION_DIR" ] || die "cannot read $OPENISD_RESERVATION_DIR"
  for rec in "$OPENISD_RESERVATION_DIR"/*; do
    [ -f "$rec" ] || continue
    why=$(browser_run_owner_gone "$rec") || continue
    port=$(browser_run_field "$rec" PORT)
    browser_run_stop "$rec"
    say "housekeeping: stopped browser run $(basename "$rec") on port ${port:-?} ($why)"
  done
fi

# --- admission slots whose owner is dead --------------------------------------------------------
[ -e "$DIR" ] || exit 0                       # no admit dir = nothing was ever admitted
[ -d "$DIR" ] && [ -r "$DIR" ] && [ -x "$DIR" ] || die "cannot read $DIR"

# One scan at a time: two scans racing would double-log the same slot.
exec 8> "$DIR/housekeeping.lock" || die "cannot open $DIR/housekeeping.lock"
flock -n 8 || { echo "housekeeping: another scan is running"; exit 0; }

[ -d "$DIR/q" ] || exit 0
[ -r "$DIR/q" ] && [ -x "$DIR/q" ] || die "cannot read $DIR/q"
freed=0 live=0
for rec in "$DIR"/q/*.rec; do
  num=$(basename "$rec" .rec)
  pid=$(admit_field "$rec" pid); start=$(admit_field "$rec" start); label=$(admit_field "$rec" label)
  why="owner pid $pid is dead"
  if [ -n "$pid" ] && [ -e "/proc/$pid" ] && ! zombie "$pid"; then
    now=$(admit_starttime "$pid")
    [ "$now" = "$start" ] || why="owner pid $pid was reused by another process"
  fi
  # Take the lock and delete under it, so a live owner (lock held) is never removed.
  if flock -n "$rec" rm -f -- "$rec" 2> /dev/null; then
    say "housekeeping: freed slot $num of \"$label\" ($why)"
    freed=$((freed + 1))
  else
    [ "$why" = "owner pid $pid is dead" ] && [ ! -e "/proc/$pid" ] \
      && say "housekeeping: slot $num of \"$label\" holds its lock but pid $pid is gone; left alone"
    live=$((live + 1))
  fi
done
say "housekeeping: $freed slot(s) freed, $live live"
run_end "housekeeping" 0
