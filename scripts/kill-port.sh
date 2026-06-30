#!/usr/bin/env bash
# Kill all processes on the project's reserved port range (4000-4015).
# No arguments needed — always scans the full range.
# Pass explicit ports to override: scripts/kill-port.sh 4000 4001
set -euo pipefail

# Project-reserved port range. AI must never start servers outside this range.
PORT_MIN=4000
PORT_MAX=4005

if [ $# -gt 0 ]; then
  ports=("$@")
else
  ports=()
  for p in $(seq "$PORT_MIN" "$PORT_MAX"); do ports+=("$p"); done
fi

for port in "${ports[@]}"; do
  pids=$(netstat -ano | awk "/:${port}[[:space:]].*LISTENING/{print \$5}" | sort -u)
  if [ -z "$pids" ]; then
    continue
  fi
  for pid in $pids; do
    if cmd /c "taskkill /PID $pid /F" > /dev/null 2>&1; then
      echo "port $port: killed PID $pid"
    else
      echo "port $port: could not kill PID $pid (may already be gone)"
    fi
  done
done
echo "done"
