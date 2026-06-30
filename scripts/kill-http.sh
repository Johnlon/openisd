#!/usr/bin/env bash
# Kill all processes on the project's reserved port range (4000-4005).
# Escalation chain per port:
#   1. Find Windows PID via netstat, map to POSIX PID via ps -W, bash kill -9
#   2. taskkill /PID /F /T  (Windows tree-kill)
#   3. taskkill /IM node.exe /F /T  (image-name nuke all node)
# Loops until netstat confirms port is free or 10 attempts exhausted.
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

_winpids_on_port() {
  netstat -ano 2>/dev/null \
    | awk "/:$1[[:space:]].*LISTENING/{print \$5}" \
    | sort -u
}

# netstat -ano col 5 = PID (native Windows PID, shown by -o flag).
# ps -W columns: PID  PPID  PGID  WINPID  TTY  UID  STIME  COMMAND
#   WINPID (col 4) = same native Windows PID as netstat — used to match the two.
#   PID    (col 1) = MSYS2 internal PID — what bash kill targets.
# Only attempt bash kill when PPID (col 2) != 0: processes with PPID=0 are
# native Windows orphans with no MSYS2 handle — bash kill cannot signal them.
_posix_pid_for_winpid() {
  ps -W 2>/dev/null | awk -v wpid="$1" '$4 == wpid && $2 != 0 {print $1; exit}'
}

_kill_port() {
  local port="$1" attempt="$2"
  local winpids
  winpids=$(_winpids_on_port "$port")
  [ -z "$winpids" ] && return 0

  for winpid in $winpids; do
    local posix_pid
    posix_pid=$(_posix_pid_for_winpid "$winpid")

    # Step 1: bash kill -9 via POSIX PID (most reliable in Git Bash)
    if [ -n "$posix_pid" ] && [ "$attempt" -le 3 ]; then
      kill -9 "$posix_pid" 2>/dev/null \
        && echo "  [attempt $attempt] kill -9 POSIX PID $posix_pid (WinPID $winpid)" \
        || echo "  [attempt $attempt] kill -9 failed for POSIX PID $posix_pid"
    fi

    # Step 2: taskkill tree-kill by Windows PID
    # MSYS_NO_PATHCONV=1 prevents Git Bash converting /F /PID /T as POSIX paths
    if [ "$attempt" -le 4 ]; then
      MSYS_NO_PATHCONV=1 taskkill /PID "$winpid" /F /T > /dev/null 2>&1 \
        && echo "  [attempt $attempt] taskkill /F /PID $winpid" \
        || true
    fi
  done

  # Step 3+: nuke all node.exe by image name
  if [ "$attempt" -ge 5 ]; then
    echo "  [attempt $attempt] escalating — taskkill /IM node.exe /F"
    MSYS_NO_PATHCONV=1 taskkill /IM node.exe /F > /dev/null 2>&1 || true
    # Also try kill -9 on all POSIX node PIDs
    ps -W 2>/dev/null | awk '/node/{if ($1 < 1000000) print $1}' \
      | xargs -r kill -9 2>/dev/null || true
  fi
}

_diagnose_port() {
  local port="$1"
  local winpids posix_pid
  winpids=$(_winpids_on_port "$port")
  echo "  DIAGNOSTIC — port $port still occupied:"
  for winpid in $winpids; do
    posix_pid=$(_posix_pid_for_winpid "$winpid")
    echo "    WinPID=$winpid  POSIX PID=${posix_pid:-<none>}"
    ps -W 2>/dev/null | awk -v wpid="$winpid" '$4 == wpid {print "    ps -W: "$0}'
  done
}

for port in "${ports[@]}"; do
  winpids=$(_winpids_on_port "$port")
  [ -z "$winpids" ] && continue

  echo "port $port: found WinPID(s) $winpids — killing..."
  for attempt in $(seq 1 10); do
    winpids=$(_winpids_on_port "$port")
    [ -z "$winpids" ] && echo "port $port: free after $((attempt - 1)) attempt(s)" && break

    _kill_port "$port" "$attempt"
    sleep 2

    if [ "$attempt" = "10" ]; then
      _diagnose_port "$port"
      echo "port $port: WARNING — still occupied, proceeding anyway"
    fi
  done
done

echo "done"
