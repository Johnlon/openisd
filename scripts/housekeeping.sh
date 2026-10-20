#!/usr/bin/env bash
# Frees admission slots whose owner is dead, stops browser runs whose owner is gone, and removes
# post-land clean copies whose owner is dead
# (a reboot on 12 Oct 2026 left six). Usage: bash scripts/housekeeping.sh (env ADMIT_DIR,
# HOUSEKEEPING_LOG, HOUSEKEEPING_POST_LAND_DIR, HOUSEKEEPING_REPO, HOUSEKEEPING_TAG). Format of the records:
# scripts/admit/record.sh; a copy is $POST_LAND_DIR/<owner pid>-<sha> (scripts/land/post-land/run.sh).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=admit/record.sh
. "$ROOT/scripts/admit/record.sh"
. "$ROOT/scripts/lib/ts-log.sh"
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"
run_start "housekeeping"
trap 'run_end "housekeeping" $?' EXIT   # every exit path, early ones and die included
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

# --- tagged processes whose browser owner is gone, with or without a record ------------------------
# A browser run's processes carry OPENISD_BROWSER_OWNER="<pid> <start>" (test-browser.sh, post-land
# run.sh). When the record is gone too, the loop above cannot see them: on 17 Oct vite previews on
# 4102-4104 lived 5 h after their post-land run and its clean copy were gone, reparented to init.
# Judged by the tag in /proc/<pid>/environ, never by command text. A process whose group leader carries
# the same tag is stopped with its group; otherwise only the process itself. Never this scan's own group.
stat_field() { # stat_field <pid> <n>: the nth field after the command name (1 state, 2 ppid, 3 pgrp)
  local s f; s=$(cat "/proc/$1/stat" 2> /dev/null) || return 1
  read -ra f <<< "${s##*) }"; echo "${f[$2 - 1]}"
}
# Without admit_starttime every owner would look dead and every tagged process would be stopped.
declare -F admit_starttime > /dev/null && [ -n "$(admit_starttime $$)" ] || die "admit_starttime is missing or broken; no tag scan"
TAG="${HOUSEKEEPING_TAG:-OPENISD_BROWSER_OWNER}"   # a test sets its own name, so the scan sees only its processes
# tag_of <pid>: sets TAG_VAL to the tag's value, "" when none. In-shell: no fork per process (a pile-up scan hit the timeout).
tag_of() {
  local kv; TAG_VAL=""
  { while IFS= read -r -d '' kv; do
      case "$kv" in "$TAG="*) TAG_VAL=${kv#"$TAG="}; break ;; esac
    done < "/proc/$1/environ"; } 2> /dev/null
  return 0
}
own_group=$(stat_field $$ 3)
declare -A targets=() cmds=()   # "<pid or -group>" -> "<pid> <start> owner <owner pid>"; its command line
for env in /proc/[0-9]*/environ; do
  p=${env#/proc/}; p=${p%/environ}
  [ "$p" != $$ ] || continue
  tag_of "$p"; owner=$TAG_VAL; [ -n "$owner" ] || continue
  read -r opid ostart <<< "$owner"
  [ -n "${opid:-}" ] || continue
  now=$(admit_starttime "$opid")
  if [ -n "$now" ] && ! zombie "$opid" && { [ -z "${ostart:-}" ] || [ "$now" = "$ostart" ]; }; then continue; fi
  g=$(stat_field "$p" 3) || continue
  [ "$g" != "$own_group" ] || continue
  tag_of "$g"
  if [ "$TAG_VAL" = "$owner" ]; then key="-$g"; else key="$p"; fi
  targets[$key]="$p $(admit_starttime "$p") owner $opid"
  cmds[$key]=$(tr '\0' ' ' < "/proc/$p/cmdline" 2> /dev/null | cut -c1-80)
done
for key in "${!targets[@]}"; do
  read -r p pstart _ opid <<< "${targets[$key]}"
  [ "$(admit_starttime "$p")" = "$pstart" ] || continue   # gone, or the pid was reused, since the scan
  kill -TERM -- "$key" 2> /dev/null || true
  timeout 5 tail --pid="$p" -f /dev/null 2> /dev/null || true
  [ "$(admit_starttime "$p")" != "$pstart" ] || kill -KILL -- "$key" 2> /dev/null || true
  what="process $p"; [ "${key#-}" = "$key" ] || what="process group ${key#-}"
  say "housekeeping: stopped $what tagged with dead browser owner pid $opid (${cmds[$key]})"
done

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
exit 0
