#!/usr/bin/env bash
# scripts/lib/ts-log.sh — per-line timestamping logger and run duration timer.
#
# Rule (processes.md rule 8, John 16 Oct 2026):
#   "every test output must have start and end time and every test suit must have a logger install
#   (or pipe) with per line timestamp".
#
# Usage:
#   source scripts/lib/ts-log.sh
#   run_start <name>
#   run_end <name> <status>
#
#   command | bash scripts/lib/ts-log.sh
#   bash scripts/lib/ts-log.sh command [args...]
#
# Formats:
#   <ts> <run id> <line>
#   <ts> <run id> START <name>
#   <ts> <run id> END <name> status=<n> duration_s=<n> [clock_step_s=<n>]
#
# duration_s is read from the monotonic clock (/proc/uptime, which never jumps), not from date.
# The UTC wall time is only the line's label. When wall and monotonic durations differ by more than
# 60 s the wall clock stepped (WSL freeze or sleep) and the END line adds clock_step_s=<wall - mono>,
# signed seconds. The CLI start file holds "<mono_ms> <wall_ms>"; an old one-number file is wall only.
set -uo pipefail

ts_now() {
  local d
  d=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
  if [ "${#d}" -gt 24 ]; then
    printf '%sZ' "${d:0:23}"
  else
    printf '%s' "$d"
  fi
}

ts_run_id() {
  printf '%s' "${OPENISD_RUN_ID:-$$}"
}

_ts_start_dir() {
  local id; id="$(ts_run_id)"
  echo "${OPENISD_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/openisd}/ts-${id}"  # the runtime root (scripts/paths.sh)
}

declare -A _TS_STARTS 2>/dev/null || true
_TS_PERSIST=0

_ts_now_ms() {
  local s
  s=$(date +%s%N 2>/dev/null || true)
  if [ "${#s}" -ge 13 ]; then
    printf '%s' "${s:0:13}"
  else
    printf '%s000' "$(date +%s)"
  fi
}

# Milliseconds from the monotonic clock, or nothing when /proc/uptime is unreadable.
_ts_mono_ms() {
  local up
  read -r up _ < /proc/uptime 2>/dev/null || return 0
  [[ "$up" =~ ^([0-9]+)\.([0-9]{2})$ ]] || return 0
  printf '%s' "$(( ${BASH_REMATCH[1]} * 1000 + 10#${BASH_REMATCH[2]} * 10 ))"
}

run_start() {
  local name="${1:?usage: run_start <name>}"
  local ts run_id now_ms mono_ms dir safe_name
  ts="$(ts_now)"
  run_id="$(ts_run_id)"
  now_ms="$(_ts_now_ms)"
  mono_ms="$(_ts_mono_ms)"
  _TS_STARTS["$name"]="${mono_ms:-0} $now_ms"
  # Sourced callers keep the start in memory. Only the CLI form (another process calls run_end)
  # needs a file; run_end removes it, and the directory goes with the last file.
  if [ "$_TS_PERSIST" = 1 ]; then
    dir="$(_ts_start_dir)"
    mkdir -p "$dir" 2>/dev/null || true
    safe_name="$(printf '%s' "$name" | tr -c 'a-zA-Z0-9_.-' '_')"
    printf '%s\n' "${mono_ms:-0} $now_ms" > "$dir/$safe_name" 2>/dev/null || true
  fi
  printf '%s %s START %s\n' "$ts" "$run_id" "$name"
}

run_end() {
  local name="${1:?usage: run_end <name> <status>}"
  local status="${2:?usage: run_end <name> <status>}"
  local ts run_id now_ms mono_ms start start_mono start_ms duration_s step dir safe_name extra=""
  ts="$(ts_now)"
  run_id="$(ts_run_id)"
  now_ms="$(_ts_now_ms)"
  mono_ms="$(_ts_mono_ms)"
  start="${_TS_STARTS["$name"]:-}"
  dir="$(_ts_start_dir)"
  safe_name="$(printf '%s' "$name" | tr -c 'a-zA-Z0-9_.-' '_')"
  if [ -z "$start" ] && [ -f "$dir/$safe_name" ]; then
    start="$(cat "$dir/$safe_name" 2>/dev/null || true)"
  fi
  if [[ "$start" == *" "* ]]; then
    start_mono="${start%% *}"; start_ms="${start##* }"
  else
    start_mono=0; start_ms="$start"   # old one-number file: wall only
  fi
  rm -f "$dir/$safe_name" 2>/dev/null || true
  rmdir "$dir" 2>/dev/null || true
  if [ -n "$start_ms" ] && [ "$start_ms" -gt 0 ] 2>/dev/null; then
    duration_s=$(( (now_ms - start_ms) / 1000 ))
    if [ "$start_mono" -gt 0 ] 2>/dev/null && [ -n "$mono_ms" ]; then
      duration_s=$(( (mono_ms - start_mono) / 1000 ))
      step=$(( ((now_ms - start_ms) - (mono_ms - start_mono)) / 1000 ))
      if [ "$step" -gt 60 ] || [ "$step" -lt -60 ]; then extra=" clock_step_s=$step"; fi
    fi
    [ "$duration_s" -ge 0 ] || duration_s=0
  else
    duration_s=0
  fi
  printf '%s %s END %s status=%s duration_s=%s%s\n' "$ts" "$run_id" "$name" "$status" "$duration_s" "$extra"
}

ts_prefix_stream() {
  local run_id; run_id="$(ts_run_id)"
  if command -v python3 >/dev/null 2>&1; then
    python3 -u -c '
import sys, datetime
run_id = sys.argv[1] if len(sys.argv) > 1 else "-"
for line in sys.stdin:
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    if not line.endswith("\n"):
        line += "\n"
    sys.stdout.write(f"{now} {run_id} {line}")
    sys.stdout.flush()
' "$run_id"
  else
    while IFS= read -r line || [ -n "$line" ]; do
      printf '%s %s %s\n' "$(ts_now)" "$run_id" "$line"
    done
  fi
}

ts_log() {
  set -o pipefail
  "$@" 2>&1 | ts_prefix_stream
  return "${PIPESTATUS[0]}"
}

# If executed directly (not sourced)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-}" in
    run_start)
      _TS_PERSIST=1
      shift
      run_start "$@"
      ;;
    run_end)
      shift
      run_end "$@"
      ;;
    "")
      ts_prefix_stream
      exit $?
      ;;
    *)
      # Command form: the command leads its own process group (set -m). TERM, INT and HUP sent to
      # this wrapper go to that whole group (kill -- -PGID); a group that has not gone in 1 s is
      # killed. The exit code is the command's own, read from `wait`, not the formatter's.
      tmp="$(mktemp -d "${TMPDIR:-/tmp}/ts-log.XXXXXX")" || exit 125
      mkfifo "$tmp/fifo" || exit 125
      ts_prefix_stream < "$tmp/fifo" &
      fmt=$!
      set -m
      "$@" > "$tmp/fifo" 2>&1 &
      cmd=$!
      set +m
      # The 1 s grace timer is a child of this wrapper that the wrapper waits on and reaps, so no
      # timer process outlives the wrapper (processes.md rule 2).
      esc=
      stop_group() {
        kill -TERM -- "-$cmd" 2>/dev/null
        if [ -z "$esc" ]; then sleep 1 & esc=$!; fi
      }
      trap stop_group TERM INT HUP
      rc=0
      while :; do
        if [ -z "$esc" ]; then
          wait "$cmd"; rc=$?
        else
          gone=""
          wait -n -p gone "$cmd" "$esc"; st=$?
          if [ "$gone" = "$cmd" ]; then
            rc=$st
          elif [ "$gone" = "$esc" ]; then
            kill -KILL -- "-$cmd" 2>/dev/null
            wait "$cmd"; rc=$?
          fi
        fi
        kill -0 "$cmd" 2>/dev/null || break
      done
      if [ -n "$esc" ]; then kill "$esc" 2>/dev/null; wait "$esc" 2>/dev/null; fi
      trap - TERM INT HUP
      kill -KILL -- "-$cmd" 2>/dev/null
      wait "$fmt" 2>/dev/null
      rm -rf "$tmp"
      exit "$rc"
      ;;
  esac
fi
