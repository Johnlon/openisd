#!/usr/bin/env bash
# Stops a browser run when its Vite dev server is gone.
#
#   bash scripts/vite-watchdog.sh <port> <test-pid>
#
# Run in the background by scripts/test-browser.sh. The server counts as gone when
#   - nothing listens on the port for 3 polls in a row, or
#   - it listens but has answered nothing for WATCHDOG_SILENT_POLLS polls (default 12: 60 s).
# A server that is only slow under load, still listening and answering now and then, is left
# alone. hc3, 2026-10-07: three slow answers in a row used to abort a healthy run at test 508.
# When it fires, the listener, the load and the biggest processes are printed first.
#
# Knobs, for the test: WATCHDOG_POLL_S (5), WATCHDOG_START_WAIT_S (180: how long the first answer
# may take before counting starts), WATCHDOG_MAX_POLLS (0: no limit).
set -uo pipefail

port="$1"
test_pid="$2"
poll="${WATCHDOG_POLL_S:-5}"
start_wait="${WATCHDOG_START_WAIT_S:-180}"
silent_limit="${WATCHDOG_SILENT_POLLS:-12}"
max_polls="${WATCHDOG_MAX_POLLS:-0}"
dead_limit=3

answers() { curl -s -f -m 2 -o /dev/null "http://localhost:$port"; }
listening() { ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; }
running() { kill -0 "$test_pid" 2>/dev/null; }

stop_run() {
  echo "" >&2
  echo "🚨 WATCHDOG: $1. Aborting Playwright run early!" >&2
  ss -ltnp "sport = :$port" 2>&1 | sed 's/^/  ss: /' >&2
  echo "  load: $(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)" >&2
  ps -eo pid,etimes,pcpu,pmem,args --sort=-pmem 2>/dev/null | head -8 | cut -c1-140 | sed 's/^/  ps: /' >&2
  kill -TERM "$test_pid" 2>/dev/null || true
}

# Cold Vite start-up under load takes well over 30 s: give it start_wait to answer once before
# counting starts, so a slow start is not mistaken for a dead server.
waited=0
while [ "$(awk -v w="$waited" -v s="$start_wait" 'BEGIN { print (w < s) ? 1 : 0 }')" = 1 ] && ! answers; do
  running || exit 0
  sleep "$poll"
  waited="$(awk -v w="$waited" -v p="$poll" 'BEGIN { print w + p }')"
done

not_listening=0
silent=0
polls=0
while running; do
  if answers; then
    not_listening=0
    silent=0
  elif listening; then
    not_listening=0
    silent=$((silent + 1))
    if [ "$silent" -ge "$silent_limit" ]; then
      stop_run "port $port listens but answered nothing for $silent polls"
      exit 0
    fi
  else
    silent=0
    not_listening=$((not_listening + 1))
    if [ "$not_listening" -ge "$dead_limit" ]; then
      stop_run "nothing listens on port $port ($not_listening polls)"
      exit 0
    fi
  fi
  polls=$((polls + 1))
  [ "$max_polls" -gt 0 ] && [ "$polls" -ge "$max_polls" ] && exit 0
  sleep "$poll"
done
