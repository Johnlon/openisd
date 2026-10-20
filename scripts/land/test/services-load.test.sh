#!/usr/bin/env bash
# T486: the service scripts cannot overload the box (load audit 20 Oct 2026). Scratch dirs and a free high port;
# never ports 4000/4100/4200, the preview unit or real processes. Every process started here is killed by pid or
# group in the EXIT trap; none is found by command text.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$(mktemp -d "${TMPDIR:-/tmp}/services-load.XXXXXX")"
PIDS=(); GRPS=(); fails=0
cleanup() { for p in "${PIDS[@]}"; do kill -KILL "$p" 2> /dev/null; done
  for g in "${GRPS[@]}"; do kill -KILL -- "-$g" 2> /dev/null; done; rm -rf "$S"; }
trap cleanup EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
alive() { [ -e "/proc/$1" ] && [ "$(cut -d' ' -f3 "/proc/$(printf %s "$1")/stat" 2> /dev/null | tr -d '\n')" != Z ] && ! grep -q '^State:.Z' "/proc/$1/status" 2> /dev/null; }
free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])'; }
waitfile() { local i; for i in $(seq 1 50); do [ -s "$1" ] && return 0; sleep 0.2; done; return 1; }
unset MSYSTEM
mkdir -p "$S/www" "$S/state" "$S/fakebin"; mkdir -p "$S/www/@vite"; : > "$S/www/@vite/client"

# 1. kill-http kills the listener, not a client connected to it
P=$(free_port)
python3 -m http.server "$P" --bind 127.0.0.1 --directory "$S/www" > /dev/null 2>&1 & LP=$!; PIDS+=("$LP")
sleep 0.7
python3 -c 'import socket,sys,time; s=socket.create_connection(("127.0.0.1",int(sys.argv[1]))); time.sleep(300)' "$P" & CP=$!; PIDS+=("$CP")
sleep 0.5
bash "$REPO/scripts/kill-http.sh" "$P" > /dev/null 2>&1
sleep 0.3
! alive "$LP" && alive "$CP" && ok "row 1/17: kill-http kills the listener only, a connected client lives" || fail "row 1: listener alive=$(alive "$LP" && echo y) client alive=$(alive "$CP" && echo y)"
kill -KILL "$CP" 2> /dev/null
# 1b. a leftover client socket with no listener (T489 run, 20 Oct: "still occupied after 10 attempts") is not "occupied"
P=$(free_port)
python3 -m http.server "$P" --bind 127.0.0.1 --directory "$S/www" > /dev/null 2>&1 & LP=$!; PIDS+=("$LP")
sleep 0.7
python3 -c 'import socket,sys,time; s=socket.create_connection(("127.0.0.1",int(sys.argv[1]))); time.sleep(300)' "$P" & CP=$!; PIDS+=("$CP")
sleep 0.5
kill -KILL "$LP"; wait "$LP" 2> /dev/null; sleep 0.3
timeout 30 bash "${KILL_HTTP:-$REPO/scripts/kill-http.sh}" "$P" > "$S/kh.out" 2>&1; r=$?
[ $r = 0 ] && alive "$CP" && ok "row 1b: kill-http with only a client socket on the port exits 0, the client lives" || fail "row 1b: exit $r, client alive=$(alive "$CP" && echo y): $(tail -1 "$S/kh.out")"
kill -KILL "$CP" 2> /dev/null
n=$(grep -c "lsof -ti" "$REPO/scripts/kill-http.sh"); m=$(grep "lsof -ti" "$REPO/scripts/kill-http.sh" | grep -c "sTCP:LISTEN")
[ "$n" -gt 0 ] && [ "$n" = "$m" ] && ok "row 17: every lsof call in kill-http.sh is LISTEN-only" || fail "row 17: $m of $n lsof calls are LISTEN-only"

# 2. port 4000 is refused with a pointer; fake lsof/npm/curl so a broken script cannot touch the real preview
for t in lsof npm curl; do printf '#!/usr/bin/env bash\nexit 0\n' > "$S/fakebin/$t"; chmod +x "$S/fakebin/$t"; done
for sc in start-http kill-http stop-http; do
  out=$(PATH="$S/fakebin:$PATH" HTTP_STATE_DIR="$S/state" timeout 20 bash "$REPO/scripts/$sc.sh" 4000 2>&1); r=$?
  [ $r != 0 ] && grep -q 'scripts/preview-4000.sh' <<< "$out" && ok "row 2: $sc refuses 4000 and names preview-4000.sh" || fail "row 2: $sc (exit $r): $out"
done

# 3. start-http and dev-4200 run no suites at start
! grep -qE 'npm run (lint|typecheck|test:unit)' "$REPO/scripts/start-http.sh" "$REPO/scripts/dev-4200.sh" \
  && ok "row 3: start-http and dev-4200 run no lint, typecheck or unit suite" || fail "row 3: a suite is still run at start"

# 5/6. the server is group-owned: stop kills it and its child; a killed start-http takes the server with it
P=$(free_port)
export HTTP_STATE_DIR="$S/state"
START_HTTP_CMD="sleep 300 & echo \$! > '$S/kid'; exec python3 -m http.server $P --bind 127.0.0.1 --directory '$S/www'" \
  timeout 60 bash "$REPO/scripts/start-http.sh" "$P" > "$S/start.out" 2>&1; r=$?
waitfile "$S/kid"; KID=$(cat "$S/kid" 2> /dev/null); SPID=$(cat "$S/state/.server-$P.pid" 2> /dev/null)
[ $r = 0 ] && [ -n "$SPID" ] && alive "$SPID" && alive "${KID:-0}" && ok "row 5: start-http leaves a ready server, pid file = its group" || fail "row 5 start (exit $r): $(tail -3 "$S/start.out")"
GRPS+=("${SPID:-0}"); PIDS+=("${KID:-0}")
timeout 30 bash "$REPO/scripts/stop-http.sh" "$P" > /dev/null 2>&1; sleep 0.5
! alive "${SPID:-0}" && ! alive "${KID:-0}" && ok "row 5: stop-http kills the server and its child" || fail "row 5: server alive=$(alive "$SPID" && echo y) child alive=$(alive "$KID" && echo y)"
rm -f "$S/kid" "$S/lead"
P=$(free_port)
START_HTTP_CMD="sleep 300 & echo \$! > '$S/kid'; echo \$\$ > '$S/lead'; exec sleep 300" \
  bash "$REPO/scripts/start-http.sh" "$P" > "$S/start2.out" 2>&1 & SP=$!; PIDS+=("$SP")
waitfile "$S/kid"; waitfile "$S/lead"; KID=$(cat "$S/kid"); LEAD=$(cat "$S/lead"); PIDS+=("$KID" "$LEAD"); GRPS+=("$LEAD")
kill -TERM "$SP"; wait "$SP" 2> /dev/null; sleep 0.5
! alive "$LEAD" && ! alive "$KID" && ok "row 6: a killed start-http takes its not-yet-ready server down" || fail "row 6: server alive=$(alive "$LEAD" && echo y) child alive=$(alive "$KID" && echo y)"
unset HTTP_STATE_DIR

# 4. run-ui-telemetry: playwright under heavy.slice, in its own group, killed by the EXIT trap
R="$S/repo"; mkdir -p "$R/scripts" "$S/tbin"
cp "$REPO/scripts/run-ui-telemetry.sh" "$R/scripts/"; printf '#!/usr/bin/env bash\nexit 0\n' > "$R/scripts/kill-http.sh"; : > "$R/scripts/telemetry-sampler.mjs"
git -C "$R" init -q 2> /dev/null; git -C "$R" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init 2> /dev/null
printf '#!/usr/bin/env bash\nexec sleep 300\n' > "$S/tbin/node"
printf '#!/usr/bin/env bash\necho $$ > "%s/npx.pid"\nsleep 300 &\necho $! > "%s/npxkid"\nwait\n' "$S" "$S" > "$S/tbin/npx"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >> "%s/sd.log"\nwhile [ "$1" != "--" ]; do shift; done; shift\nexec "$@"\n' "$S" > "$S/tbin/systemd-run"
chmod +x "$S/tbin/"*
PATH="$S/tbin:$PATH" setsid bash "$R/scripts/run-ui-telemetry.sh" > "$S/tel.out" 2>&1 & TP=$!; PIDS+=("$TP"); GRPS+=("$TP")
waitfile "$S/npxkid"; sleep 0.3; NP=$(cat "$S/npx.pid" 2> /dev/null); NK=$(cat "$S/npxkid" 2> /dev/null); PIDS+=("${NP:-0}" "${NK:-0}")
grep -q -- '--slice=heavy.slice' "$S/sd.log" 2> /dev/null && grep -q -- '--scope' "$S/sd.log" && ok "row 4: playwright starts under systemd-run --scope --slice=heavy.slice" || fail "row 4: systemd-run log: $(cat "$S/sd.log" 2> /dev/null)"
kill -TERM "$TP"; wait "$TP" 2> /dev/null; sleep 0.5
! alive "${NP:-0}" && ! alive "${NK:-0}" && ok "row 4: killing the script kills playwright and its children" || fail "row 4: playwright alive=$(alive "$NP" && echo y) child alive=$(alive "$NK" && echo y)"

# 8-9, 12-14, 16: unit files and watchdog text
grep -q 'TimeoutStartSec=300' "$REPO/scripts/land/watchdog.service" && ok "row 9: watchdog.service has TimeoutStartSec=300" || fail "row 9"
u="$REPO/scripts/systemd/openisd-preview.service"
grep -qx 'MemoryMax=2G' "$u" && grep -qx 'RestartSec=10' "$u" && grep -qx 'StartLimitIntervalSec=300' "$u" && grep -qx 'StartLimitBurst=10' "$u" \
  && ok "row 12: preview unit has MemoryMax and a start limit" || fail "row 12"
grep -q -- '--slice=heavy.slice' "$REPO/scripts/measure-peak.sh" && ! grep -q 'measure.slice' "$REPO/scripts/measure-peak.sh" && ok "row 13: measure-peak uses heavy.slice" || fail "row 13"
w="$REPO/scripts/land/watchdog.sh"
grep -E 'timeout 900 .*sync-main-folder' "$w" > /dev/null && grep -E 'timeout 900 .*tidy-branches' "$w" > /dev/null && ok "row 14: sync-main-folder and tidy-branches run under timeout 900" || fail "row 14"
grep -q 'timed out after 900' "$w" && ok "row 14: a timeout is logged loudly" || fail "row 14: no timeout log"
# 16: tree_cpu is correct and forks O(1): root with a child and a grandchild
setsid bash -c 'sleep 300 & bash -c "sleep 300 & wait" & wait' & TR=$!; PIDS+=("$TR"); GRPS+=("$TR"); sleep 0.5
fn=$(sed -n '/^tree_cpu()/,/^}/p' "$w")
v=$(bash -c "$fn"$'\n'"tree_cpu $TR" 2>&1); [[ "$v" =~ ^[0-9]+$ ]] && ok "row 16: tree_cpu returns a number for a live tree" || fail "row 16: value '$v'"
fk=$(strace -f -c -e trace=execve bash -c "$fn"$'\n'"tree_cpu $TR" 2>&1 >/dev/null | awk '$NF=="execve"{print $4}')
[ -n "$fk" ] && [ "$fk" -le 6 ] && ok "row 16: tree_cpu execs $fk programs, not one per process" || fail "row 16: execve count '$fk'"
kill -KILL -- "-$TR" 2> /dev/null

# 15: tidy-branches scans /proc cwd once
t="$REPO/scripts/land/tidy-branches.sh"
! grep -q 'readlink' "$t" && grep -c 'find /proc' "$t" | grep -qx 1 && ok "row 15/10: one /proc cwd scan, no readlink per process" || fail "row 15"

[ $fails = 0 ] && { echo "services-load: all passed"; exit 0; }
echo "services-load: $fails failed"; exit 1
