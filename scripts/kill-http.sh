#!/usr/bin/env bash
# Kill the process LISTENING on the specified port(s); clients connected to it (browsers, curl) are never touched.
# Usage: scripts/kill-http.sh <port> [port ...]
# Escalation chain per port:
#   1. tskill <winpid>  — most reliable: Terminal Services kill, works on orphaned PPID=0 processes
#   2. bash kill -9 via MSYS2 PID from ps -W (only when PPID != 0)
#   3. taskkill /PID /F /T  — Windows tree-kill (MSYS_NO_PATHCONV=1 to stop Git Bash mangling /F /PID)
#   4. taskkill /IM node.exe /F  — image-name nuke all node
# Loops until netstat confirms port is free or 10 attempts exhausted.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || [ "$(uname -s)" = Linux ]; } || { echo "ERROR: must run in Git Bash on Windows, WSL or Linux, not PowerShell/cmd" >&2; exit 1; }

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

# Port 4000 is the openisd-preview systemd unit (Restart=always): killing its server only makes systemd
# restart it. Restart it with scripts/preview-4000.sh instead.
for p in "$@"; do
  [ "$p" != 4000 ] || { echo "ERROR: port 4000 is the openisd-preview unit; use bash scripts/preview-4000.sh" >&2; exit 1; }
done

if [ $# -eq 0 ]; then
  echo "ERROR: kill-http.sh requires at least one port argument" >&2
  exit 1
fi
ports=("$@")

# On WSL/Linux the dev server is a native Linux process; the Windows kill chain
# (tskill/taskkill/ps -W) cannot see it. Use POSIX lsof + kill and exit early.
if [ -z "${MSYSTEM:-}" ]; then
  # A listener tagged with another browser run's owner (OPENISD_BROWSER_OWNER="<pid> <start>") whose owner
  # is alive is that run's live test server: never killed. 17 Oct 2026: a unit test ran this script from a
  # scratch copy, which saw port 4100 as free, and killed a live suite's server mid-run. Untagged
  # listeners, this run's own, and those of dead owners are killed as before.
  live_other_run() { # live_other_run <pid>: prints the owner when the pid serves another live run
    local tag opid ostart now
    tag=$(tr '\0' '\n' < "/proc/$1/environ" 2> /dev/null | sed -n 's/^OPENISD_BROWSER_OWNER=//p')
    [ -n "$tag" ] && [ "$tag" != "${OPENISD_BROWSER_OWNER:-}" ] || return 1
    read -r opid ostart <<< "$tag"
    now=$(awk '{print $22}' "/proc/$opid/stat" 2> /dev/null) || return 1
    [ -n "$now" ] && [ "$now" = "$ostart" ] && echo "$opid"
  }
  for port in "${ports[@]}"; do
    for pid in $(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true); do
      if owner=$(live_other_run "$pid"); then
        echo "port $port: ERROR — PID $pid is the test server of another live run (owner pid $owner); not killed" >&2
        exit 1
      fi
    done
    # Loop until the port is genuinely free, exactly as the Windows branch below does.
    # Killing once and assuming it worked is what let an orphan survive into the next
    # run: `lsof` reporting a PID is not proof the socket is released a moment later.
    for attempt in $(seq 1 10); do
      pids=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)
      [ -z "$pids" ] && break
      echo "port $port: [attempt $attempt] killing PID(s) $pids"
      # SIGTERM once so a server can close its sockets; SIGKILL from then on, because a
      # process that ignored TERM will not honour a second one.
      if [ "$attempt" -eq 1 ]; then
        kill $pids 2>/dev/null || true
      else
        kill -9 $pids 2>/dev/null || true
      fi
      sleep 1
    done
    if [ -n "$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)" ]; then
      echo "port $port: ERROR — still occupied after 10 attempts, aborting" >&2; exit 1
    fi
  done
  echo "done"
  exit 0
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

    # Step 1: tskill — Terminal Services kill; works on orphaned PPID=0 processes
    # that taskkill and bash kill cannot touch. Takes the bare Windows PID with no flags.
    tskill "$winpid" > /dev/null 2>&1 \
      && echo "  [attempt $attempt] tskill $winpid" \
      || true

    # Step 2: bash kill -9 via MSYS2 PID (only when PPID != 0 — real MSYS2 handle)
    if [ -n "$posix_pid" ]; then
      kill -9 "$posix_pid" 2>/dev/null \
        && echo "  [attempt $attempt] kill -9 MSYS2 PID $posix_pid (WinPID $winpid)" \
        || true
    fi

    # Step 3: taskkill tree-kill by Windows PID
    # MSYS_NO_PATHCONV=1 prevents Git Bash converting /F /PID /T as POSIX paths
    if [ "$attempt" -le 4 ]; then
      MSYS_NO_PATHCONV=1 taskkill /PID "$winpid" /F /T > /dev/null 2>&1 \
        && echo "  [attempt $attempt] taskkill /F /PID $winpid" \
        || true
    fi
  done

  # Step 4+: nuke all node.exe by image name
  if [ "$attempt" -ge 5 ]; then
    echo "  [attempt $attempt] escalating — taskkill /IM node.exe /F"
    MSYS_NO_PATHCONV=1 taskkill /IM node.exe /F > /dev/null 2>&1 || true
    ps -W 2>/dev/null | awk '/node/ && $2 != 0 {print $1}' \
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
      echo "port $port: ERROR — still occupied, aborting" >&2; exit 1
    fi
  done
done

echo "done"
