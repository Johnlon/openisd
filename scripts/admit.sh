#!/usr/bin/env bash
# Machine-wide admission: one slot, FIFO. Format and owner-liveness rules: scripts/admit/record.sh.
#   bash scripts/admit.sh <label> -- <command...>
# Waits its turn, runs the command with ADMIT_TOKEN and OPENISD_RUN_ID exported, exits with the
# command's status, and frees the slot on any exit.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/admit/record.sh"
source "$HERE/lib/progress.sh"

die() { echo "admit: $*" >&2; exit 1; }

if [ $# -lt 3 ] || [ "$2" != "--" ]; then
  echo "usage: admit.sh <label> -- <command...>" >&2
  exit 2
fi
label=$1
shift 2

dir=$(admit_dir)
rec=""
child=""
# The running job's pid, start time and label, kept beside the queue directory (not in it) so a
# queue that is wiped or reset while a job runs cannot let a second run in: a run starts only when
# this names no other live process, checked by pid and start time. Under ADMIT_DIR (tests) it is a
# sibling file; otherwise it lives in the state directory.
if [ -n "${ADMIT_DIR:-}" ]; then
  holder="$ADMIT_DIR.holder"
else
  holder="${XDG_STATE_HOME:-$HOME/.local/state}/openisd/admit-holder-$(admit_repo_name)"
fi
holds=0

# Runs on every exit: stop the job if a signal arrived mid-run, then free the slot.
# The record is removed while fd 9 is still open, so the slot never looks held-but-unlisted.
cleanup() {
  [ -z "$child" ] || kill "$child" 2> /dev/null
  [ "$holds" = 0 ] || [ "$(admit_field "$holder" pid)" != "$$" ] || rm -f "$holder"
  [ -z "$rec" ] || rm -f "$rec"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

take_ticket() { # sets rec; leaves fd 9 open and locked on it. fd 8 (next.lock) is closed again.
  local n
  mkdir -p "$dir/q" || die "cannot create $dir/q"
  exec 8> "$dir/next.lock" || die "cannot open $dir/next.lock"
  flock -x 8 || die "cannot lock $dir/next.lock"
  n=$(cat "$dir/next" 2> /dev/null || true)
  n=$((10#${n:-0} + 1))
  printf '%s\n' "$n" > "$dir/next" || die "cannot write $dir/next"
  rec=$(printf '%s/q/%08d.rec' "$dir" "$n")
  exec 9> "$rec" || die "cannot create $rec"
  flock -x 9 || die "cannot lock $rec"
  printf 'pid=%s\nstart=%s\nlabel=%s\nrun=%s\nqueued=%s\n' \
    "$$" "$(admit_starttime $$)" "$label" "${OPENISD_RUN_ID:-$$-$n}" "$(date +%s)" >&9 \
    || die "cannot write $rec"
  exec 8>&-
}

# Sets ahead (live records numbered below mine) and first_live (the lowest of them).
scan_ahead() {
  local f
  ahead=0
  first_live=""
  for f in "$dir"/q/*.rec; do
    [ "$f" \< "$rec" ] || break # zero-padded names sort as numbers
    admit_owner_dead "$f" && continue
    ahead=$((ahead + 1))
    [ -n "$first_live" ] || first_live=$f
  done
}

# True when the holder file names a live process other than this one (same pid and start time).
holder_alive() {
  local pid start
  pid=$(admit_field "$holder" pid)
  start=$(admit_field "$holder" start)
  [ -n "$pid" ] && [ "$pid" != "$$" ] && [ -n "$start" ] && [ "$(admit_starttime "$pid")" = "$start" ]
}

# Takes the holder file unless a live process has it. The check and the write share one lock.
claim_holder() {
  mkdir -p "$(dirname "$holder")" || die "cannot create $(dirname "$holder")"
  exec 7> "$holder.lock" || die "cannot open $holder.lock"
  flock -x 7 || die "cannot lock $holder.lock"
  if holder_alive; then
    exec 7>&-
    return 1
  fi
  printf 'pid=%s\nstart=%s\nlabel=%s\n' "$$" "$(admit_starttime $$)" "$label" > "$holder" || die "cannot write $holder"
  holds=1
  exec 7>&-
}

wait_for_turn() {
  local began=$SECONDS ahead first_live
  while :; do
    scan_ahead
    if [ "$ahead" -gt 0 ]; then
      progress_waiting_line "$label" "$ahead" "$(admit_field "$first_live" label)" $((SECONDS - began)) >&2
      # The kernel wakes us the moment the holder dies; 30 s caps the wait so we re-scan and report.
      # A vanished record makes flock fail at once; the next scan then ignores it.
      flock -w 30 "$first_live" true 2> /dev/null || true
    elif claim_holder; then
      return 0
    else
      progress_waiting_line "$label" 1 "$(admit_field "$holder" label)" $((SECONDS - began)) >&2
      # A holder with no ticket (its queue was wiped): wait for its pid to end, re-checking every 30 s.
      timeout 30 tail --pid="$(admit_field "$holder" pid)" -f /dev/null 2> /dev/null || true
    fi
  done
}

take_ticket
wait_for_turn

export ADMIT_TOKEN="$rec"
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"
echo "$label starting (run $OPENISD_RUN_ID)" >&2
began=$SECONDS
# Background + wait so a signal reaches our trap at once; <&0 keeps stdin; 9>&- hides the lock.
"$@" 9>&- <&0 &
child=$!
wait "$child"
status=$?
child=""
progress_end_line "$label" "$status" $((SECONDS - began)) >&2
exit "$status"
