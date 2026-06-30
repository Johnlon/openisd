#!/usr/bin/env bash
# Kill all processes on the project's reserved port range (4000-4005) and wait
# until netstat confirms every port is free. Escalates from PID kill → tree kill
# → image-name kill. Loops until clean or 60s timeout.
# Pass explicit ports to override: scripts/kill-http.sh 4000 4001
set -euo pipefail
[ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1

PORT_MIN=4000
PORT_MAX=4005

if [ $# -gt 0 ]; then
  ports=("$@")
else
  ports=()
  for p in $(seq "$PORT_MIN" "$PORT_MAX"); do ports+=("$p"); done
fi

_pids_on_port() {
  netstat -ano 2>/dev/null \
    | awk "/:$1[[:space:]].*LISTENING/{print \$5}" \
    | sort -u
}

_kill_port() {
  local port="$1"
  local attempt="$2"
  local pids
  pids=$(_pids_on_port "$port")
  [ -z "$pids" ] && return 0

  for pid in $pids; do
    if [ "$attempt" -le 2 ]; then
      cmd /c "taskkill /PID $pid /F /T" > /dev/null 2>&1 && echo "port $port: killed tree PID $pid" || true
    fi
  done

  # After 2 failed attempts escalate to killing all node.exe
  if [ "$attempt" -ge 3 ]; then
    echo "port $port: escalating — killing all node.exe"
    cmd /c "taskkill /IM node.exe /F /T" > /dev/null 2>&1 || true
  fi
}

for port in "${ports[@]}"; do
  for attempt in $(seq 1 10); do
    pids=$(_pids_on_port "$port")
    if [ -z "$pids" ]; then
      [ "$attempt" -gt 1 ] && echo "port $port: free"
      break
    fi
    _kill_port "$port" "$attempt"
    sleep 2
    if [ "$attempt" = "10" ]; then
      echo "port $port: WARNING — still occupied after 20s, proceeding"
    fi
  done
done

echo "done"
