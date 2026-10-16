#!/usr/bin/env bash
# Acceptance test for scripts/land/watchdog.sh. Scratch runtime dir, scratch repo with a bare origin,
# fake tmux on PATH that logs its arguments. Time is driven with WATCHDOG_NOW where a check needs
# minutes to pass. Every process started here is killed by pid in the EXIT trap.
set -uo pipefail
REPO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
W="$REPO_SRC/scripts/land/watchdog.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/watchdog-test.XXXXXX")"
PIDS=(); fails=0
cleanup() { for p in "${PIDS[@]}"; do kill -KILL -- "-$p" 2> /dev/null; kill -KILL "$p" 2> /dev/null; done; rm -rf "$SCRATCH"; }
trap cleanup EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"
export ADMIT_DIR="$SCRATCH/admit"
export WATCHDOG_STATE="$SCRATCH/rt/watchdog" WATCHDOG_LOG="$SCRATCH/logs/watchdog.log"
export WORKSPACE="$SCRATCH/ws"; mkdir -p "$WORKSPACE/zoo/state/jobs"
export WATCHDOG_HOLDER="$SCRATCH/rt/post.holder" WATCHDOG_POST_LAND_LOG="$SCRATCH/post-land.log"
export WATCHDOG_REFUSALS="$SCRATCH/rt/land-refusals.log"
export WATCHDOG_HUNG_S=100 WATCHDOG_GRACE_S=2 WATCHDOG_WT_MIN_AGE_S=0 WATCHDOG_LEADER=lots
export WATCHDOG_REPO="$SCRATCH/repo"
export POST_LAND_LOCK="$SCRATCH/rt/post.lock" WATCHDOG_RUN_SH="$SCRATCH/fake-run.sh" FAKE_RUN_LOG="$SCRATCH/run.log"
printf '#!/usr/bin/env bash\necho "$*" >> "$FAKE_RUN_LOG"\n' > "$SCRATCH/fake-run.sh"
ASK="$WORKSPACE/zoo/ASK.md"; : > "$ASK"

# fake tmux: list-windows prints $FAKE_WINDOWS, everything is logged
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/tmux" << 'T'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_TMUX_LOG"
[ "$1" = list-windows ] && { cat "$FAKE_WINDOWS" 2> /dev/null; exit 0; }
exit 0
T
chmod +x "$SCRATCH/bin/tmux"
export PATH="$SCRATCH/bin:$PATH" FAKE_TMUX_LOG="$SCRATCH/tmux.log" FAKE_WINDOWS="$SCRATCH/windows"
: > "$FAKE_TMUX_LOG"; echo bob > "$FAKE_WINDOWS"

starttime() { local s; s=$(cat "/proc/$1/stat"); s=${s##*) }; set -- $s; echo "${20}"; }
dead() { local s; s=$(cat "/proc/$1/stat" 2> /dev/null) || return 0; s=${s##*) }; [ "${s%% *}" = Z ]; }
tick() { timeout 60 bash "$W" 2>&1; }
hold() { printf '%s %s %s\n' "$1" "$(starttime "$1")" deadbeef0123 > "$WATCHDOG_HOLDER"; }

# 1. hung run: static log, idle process -> left alone before the threshold, killed after
echo "line" > "$WATCHDOG_POST_LAND_LOG"
setsid sleep 300 & HP=$!; PIDS+=("$HP"); sleep 0.3
hold "$HP"
WATCHDOG_NOW=1000 tick > /dev/null
WATCHDOG_NOW=1050 tick > /dev/null
dead "$HP" && fail "killed before the threshold" || ok "not killed at 50 s of 100 s"
WATCHDOG_NOW=1200 tick > /dev/null
wait "$HP" 2> /dev/null
dead "$HP" && ok "hung run killed" || fail "hung run still alive"
[ ! -e "$WATCHDOG_HOLDER" ] && ok "holder removed" || fail "holder kept"
grep -q 'hung: no log growth' "$WATCHDOG_LOG" && ok "kill logged" || fail "kill not logged"
grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+Z watchdog: ' "$WATCHDOG_LOG" && ok "UTC timestamps" || fail "log format"
grep -q 'send-keys -t agents:lots' "$FAKE_TMUX_LOG" || grep -q 'post-land run for deadbeef01' "$ASK" && ok "leader told" || fail "leader not told"

# 2. live run with a growing log is left alone, even past the threshold
setsid sleep 300 & HP=$!; PIDS+=("$HP"); sleep 0.3
hold "$HP"
WATCHDOG_NOW=2000 tick > /dev/null
echo more >> "$WATCHDOG_POST_LAND_LOG"
WATCHDOG_NOW=2200 tick > /dev/null
dead "$HP" && fail "growing log run was killed" || ok "growing log run left alone"
kill -KILL -- "-$HP"; wait "$HP" 2> /dev/null; rm -f "$WATCHDOG_HOLDER"

# 3. busy run (CPU grows) with a static log is left alone
setsid bash -c 'while :; do :; done' & HP=$!; PIDS+=("$HP"); sleep 0.3
hold "$HP"
WATCHDOG_NOW=3000 tick > /dev/null
sleep 2
WATCHDOG_NOW=3200 tick > /dev/null
dead "$HP" && fail "CPU-bound run was killed" || ok "CPU-bound run left alone"

# 3b. live run whose busy child is in ANOTHER process group (run.sh uses set -m): left alone
setsid bash -c 'set -m; bash -c "while :; do :; done" & wait' & HP=$!; PIDS+=("$HP"); sleep 0.5
KID=$(ps -o pid= --ppid "$HP" | tr -d ' ')
hold "$HP"
WATCHDOG_NOW=3500 tick > /dev/null
sleep 2
WATCHDOG_NOW=3700 tick > /dev/null
dead "$HP" && fail "run with a busy child group was killed" || ok "busy child in its own group counts as alive"
kill -KILL -- "-$HP" 2> /dev/null; [ -n "$KID" ] && kill -KILL -- "-$KID" 2> /dev/null; wait "$HP" 2> /dev/null; rm -f "$WATCHDOG_HOLDER"

# 4. scratch repo with a bare origin, open Fs
git init -q --bare "$SCRATCH/origin.git"
git clone -q "$SCRATCH/origin.git" "$WATCHDOG_REPO" 2> /dev/null
( cd "$WATCHDOG_REPO" && git config user.email t@t && git config user.name t && git symbolic-ref HEAD refs/heads/main \
  && mkdir -p tasks/fixes && printf 'id: F0\nstatus: closed\n' > tasks/fixes/F0.yml && git add . \
  && git commit -qm base && git push -q origin main ) || fail "scratch repo setup"
mk_f() { printf 'id: %s\nowner: %s\nstatus: open\ngoal: x\n' "$1" "$2" > "$WATCHDOG_REPO/tasks/fixes/$1.yml"; }
mk_f F1 bob; mk_f F2 bob; mk_f F3 ""
touch -d '2 hours ago' "$WATCHDOG_REPO/tasks/fixes/F1.yml" "$WATCHDOG_REPO/tasks/fixes/F3.yml"
out=$(tick)
grep -q 'send-keys -t agents:bob WATCHDOG: F1: open' "$FAKE_TMUX_LOG" && ok "old F alerts its owner's window" || fail "no alert for F1: $(cat "$FAKE_TMUX_LOG")"
grep -q 'F2' "$FAKE_TMUX_LOG" "$ASK" && fail "fresh F2 alerted" || ok "fresh F gets no alert"
grep -q 'no window lots: WATCHDOG: F3' "$ASK" && ok "ownerless F goes to the leader, no window -> ASK.md" || fail "F3 not in ASK.md"
n=$(grep -c 'F1: open' "$FAKE_TMUX_LOG"); tick > /dev/null
[ "$(grep -c 'F1: open' "$FAKE_TMUX_LOG")" = "$n" ] && ok "no repeat inside the re-alert window" || fail "F1 alerted twice"

# 5. unacknowledged zoo-run result
printf '2026-10-11 11:34:14 | j1: result for carol NOT DELIVERED (no send path); text in /x; after relaying run: zoo-run.sh ack j1\n' >> "$ASK"
printf '2026-10-11 11:35:14 | j2: result for dave NOT DELIVERED (no send path); text in /y; after relaying run: zoo-run.sh ack j2\n' >> "$ASK"
printf 'job=j2\ndelivered=yes\n' > "$WORKSPACE/zoo/state/jobs/j2.env"
tick > /dev/null
grep -q 'no window carol: WATCHDOG: zoo result j1 is unread' "$ASK" && ok "unacked result alerts its owner" || fail "no alert for j1"
grep -q 'dave' <(grep watchdog "$ASK") && fail "acked result alerted" || ok "acked result is quiet"

# 6. gate refused twice in an hour -> one infra F
now=$(date +%s)
printf '%s lint T1\n%s lint T2\n%s unit T3\n' "$((now - 600))" "$((now - 60))" "$now" > "$WATCHDOG_REFUSALS"
tick > /dev/null; tick > /dev/null
infra=$(grep -l 'label: infra' "$WATCHDOG_REPO"/tasks/fixes/*.yml 2> /dev/null)
[ "$(echo "$infra" | grep -c .)" = 1 ] && ok "one infra F written" || fail "infra Fs: $infra"
grep -q '^gate: lint' $infra 2> /dev/null && grep -q '^status: open' $infra && grep -q '^owner: lots' $infra && ok "infra F names gate, open, owner leader" || fail "infra F content"
[ "$(basename "$infra")" = F4.yml ] && ok "next F number" || fail "F number: $infra"

# 7. worktrees: merged clean removed; dirty and unmerged kept
( cd "$WATCHDOG_REPO" && git worktree add -q "$SCRATCH/wt-clean" -b clean && git worktree add -q "$SCRATCH/wt-dirty" -b dirty \
  && git worktree add -q "$SCRATCH/wt-ahead" -b ahead ) || fail "worktree setup"
echo x > "$SCRATCH/wt-dirty/untracked.txt"
( cd "$SCRATCH/wt-ahead" && git config user.email t@t && git config user.name t && echo y > y && git add y && git commit -qm ahead )
tick > /dev/null
[ ! -d "$SCRATCH/wt-clean" ] && ok "merged clean worktree removed" || fail "clean worktree kept"
git -C "$WATCHDOG_REPO" rev-parse --verify -q refs/heads/clean > /dev/null && fail "branch clean kept" || ok "its branch deleted"
[ -d "$SCRATCH/wt-dirty" ] && ok "dirty worktree kept" || fail "dirty worktree removed"
[ -d "$SCRATCH/wt-ahead" ] && ok "unmerged worktree kept" || fail "unmerged worktree removed"
grep -q 'removed merged clean worktree' "$WATCHDOG_LOG" && ok "removal logged" || fail "removal not logged"

# 8. overlapping ticks: a held lock makes the second exit quietly
( exec 7> "$WATCHDOG_STATE/watchdog.lock"; flock -x 7; exec sleep 300 ) & PIDS+=("$!"); sleep 0.3
out=$(tick); grep -q 'another tick is running' <<< "$out" && ok "overlap refused" || fail "overlap: $out"
kill -KILL "${PIDS[-1]}" 2> /dev/null; wait "${PIDS[-1]}" 2> /dev/null

# 9. main has an untested commit and no run is alive: a run is started (once old enough)
main_sha=$(git -C "$WATCHDOG_REPO" rev-parse origin/main)
rm -f "$FAKE_RUN_LOG" "$WATCHDOG_HOLDER" "$POST_LAND_LOCK.tested"
tick > /dev/null; sleep 0.5
[ ! -e "$FAKE_RUN_LOG" ] && ok "a young untested main is left to land.sh's own run" || fail "started a run on a young commit"
WATCHDOG_STALL_S=0 tick > /dev/null; sleep 0.5
[ "$(cat "$FAKE_RUN_LOG" 2> /dev/null)" = "$main_sha" ] && ok "an old untested main with no run alive starts one on origin/main" || fail "run not started: $(cat "$FAKE_RUN_LOG" 2> /dev/null)"
grep -q "main ${main_sha:0:10} is untested.*starting one" "$WATCHDOG_LOG" && ok "start logged" || fail "start not logged"
rm -f "$FAKE_RUN_LOG"
setsid sleep 300 & HP=$!; PIDS+=("$HP"); sleep 0.3
hold "$HP"
WATCHDOG_STALL_S=0 WATCHDOG_HUNG_S=100000 tick > /dev/null; sleep 0.5
[ ! -e "$FAKE_RUN_LOG" ] && ok "a live holder means no second run" || fail "started over a live run"
kill -KILL -- "-$HP" 2> /dev/null; wait "$HP" 2> /dev/null; rm -f "$WATCHDOG_HOLDER"
( exec 9> "$POST_LAND_LOCK"; flock -x 9; exec sleep 300 ) & PIDS+=("$!"); sleep 0.3
WATCHDOG_STALL_S=0 tick > /dev/null; sleep 0.5
[ ! -e "$FAKE_RUN_LOG" ] && ok "a held post-land lock means no second run" || fail "started over a held lock"
kill -KILL "$!" 2> /dev/null
printf '%s\n' "$main_sha" > "$POST_LAND_LOCK.tested"
WATCHDOG_STALL_S=0 tick > /dev/null; sleep 0.5
[ ! -e "$FAKE_RUN_LOG" ] && ok "a tested main starts nothing" || fail "started a run on a tested main"

[ $fails = 0 ] && echo "ALL OK" || echo "$fails FAILED"
exit $((fails > 0))
