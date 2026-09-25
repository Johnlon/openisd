#!/usr/bin/env bash
PORT=$1
sleep 15
FAILURES=0
while true; do
  if ! curl -s -f -m 2 -o /dev/null "http://localhost:$PORT"; then
    FAILURES=$((FAILURES + 1))
    if [ "$FAILURES" -ge 3 ]; then
      echo "WATCHDOG: Vite server on port $PORT is unreachable. Aborting..." >&2
      # send SIGTERM to the process group
      kill -TERM -- -$$ 2>/dev/null || true
      exit 1
    fi
  else
    FAILURES=0
  fi
  sleep 5
done
