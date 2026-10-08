#!/usr/bin/env bash
# The one progress line every loop in this repo prints (John, 2026-10-08: no loop without a
# completion count and an ETA from elapsed loop time and loop remaining).
#
#   source scripts/lib/progress.sh
#   progress_line <label> <done> <total> <elapsed_s>
#       -> "suite 37/120 (31%) elapsed 2m10s ETA 4m52s"      ETA = elapsed / done * remaining
#   progress_waiting_line <label> <ahead> <holder> <waited_s>
#       -> "suite waiting for slot: 2 ahead, holder <holder>, 45 s"
#   progress_end_line <label> <exit_code> <elapsed_s>
#       -> "suite finished: ok after 2m10s" / "suite finished: FAILED (exit 7) after 2m10s"
#   progress_heartbeat_start <interval_s> <file> <command…>   run <command…> every <interval_s> in
#       the background, appending its output to <file>; progress_heartbeat_stop ends it.

progress_duration() { # seconds -> 2m10s | 1h01m40s
  local s=$1
  if [ "$s" -ge 3600 ]; then printf '%dh%02dm%02ds' $((s / 3600)) $((s % 3600 / 60)) $((s % 60))
  else printf '%dm%02ds' $((s / 60)) $((s % 60)); fi
}

progress_line() {
  local label=$1 done=$2 total=$3 elapsed=$4 eta pct
  if [ "$total" -le 0 ]; then
    printf '%s %s/? elapsed %s ETA unknown\n' "$label" "$done" "$(progress_duration "$elapsed")"
    return 0
  fi
  pct=$(( (done * 100 + total / 2) / total ))
  if [ "$done" -le 0 ]; then eta=unknown
  else eta=$(progress_duration $(( (elapsed * (total - done) + done / 2) / done ))); fi
  printf '%s %s/%s (%s%%) elapsed %s ETA %s\n' "$label" "$done" "$total" "$pct" "$(progress_duration "$elapsed")" "$eta"
}

progress_waiting_line() {
  printf '%s waiting for slot: %s ahead, holder %s, %s s\n' "$1" "$2" "$3" "$4"
}

progress_end_line() {
  if [ "$2" = 0 ]; then printf '%s finished: ok after %s\n' "$1" "$(progress_duration "$3")"
  else printf '%s finished: FAILED (exit %s) after %s\n' "$1" "$2" "$(progress_duration "$3")"; fi
}

PROGRESS_HEARTBEAT_PID=""

progress_heartbeat_start() {
  local interval=$1 file=$2
  shift 2
  ( while :; do sleep "$interval"; "$@" >> "$file" 2>&1; done ) &
  PROGRESS_HEARTBEAT_PID=$!
}

progress_heartbeat_stop() {
  [ -n "$PROGRESS_HEARTBEAT_PID" ] || return 0
  pkill -P "$PROGRESS_HEARTBEAT_PID" 2> /dev/null # its sleep, by parent pid
  kill "$PROGRESS_HEARTBEAT_PID" 2> /dev/null
  wait "$PROGRESS_HEARTBEAT_PID" 2> /dev/null
  PROGRESS_HEARTBEAT_PID=""
}
