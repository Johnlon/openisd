#!/usr/bin/env bash
# Acceptance test for scripts/land/watchdog.sh. Scratch runtime dir, scratch repo with a bare origin,
# fake tmux on PATH that logs its arguments. Time is driven with WATCHDOG_NOW where a check needs
# minutes to pass. Every process started here is killed by session, group and pid on every exit but KILL.
set -uo pipefail
REPO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
W="$REPO_SRC/scripts/land/watchdog.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/watchdog-test.XXXXXX")"
PIDS=(); fails=0
# Each started process is a session leader (setsid) or a plain child: kill its session, its group and
# itself. The session also holds the job-control groups a `set -m` child makes, which a group kill misses.
cleanup() {
  for p in "${PIDS[@]}"; do pkill -KILL -s "$p" 2> /dev/null; kill -KILL -- "-$p" 2> /dev/null; kill -KILL "$p" 2> /dev/null; done
  rm -rf "$SCRATCH"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"
export ADMIT_DIR="$SCRATCH/admit"
export WATCHDOG_STATE="$SCRATCH/rt/watchdog" WATCHDOG_LOG="$SCRATCH/logs/watchdog.log" HOUSEKEEPING_LOG="$SCRATCH/logs/housekeeping.log"
export WORKSPACE="$SCRATCH/ws"; mkdir -p "$WORKSPACE/zoo/state/jobs"
export WATCHDOG_HOLDER="$SCRATCH/rt/post.holder" WATCHDOG_POST_LAND_LOG="$SCRATCH/post-land.log"
export WATCHDOG_REFUSALS="$SCRATCH/rt/land-refusals.log"
export WATCHDOG_HUNG_S=100 WATCHDOG_GRACE_S=2 WATCHDOG_LEADER=lots
export WATCHDOG_REPO="$SCRATCH/repo"
# The tree under test, not a snapshot of the scratch repo's origin/main (case 8 tests the snapshot).
export WATCHDOG_TOOLS="$REPO_SRC"
export POST_LAND_LOCK="$SCRATCH/rt/post.lock" WATCHDOG_RUN_SH="$SCRATCH/fake-run.sh" FAKE_RUN_LOG="$SCRATCH/run.log"
printf '#!/usr/bin/env bash\necho "$*" >> "$FAKE_RUN_LOG"\n' > "$SCRATCH/fake-run.sh"
ASK="$WORKSPACE/zoo/ASK.md"; : > "$ASK"
# Alerts are files the gate hook shows to agents (T333); tmux is never used, so the fake below must stay unused.
export WATCHDOG_ALERTS="$SCRATCH/rt/agent-alerts" SYNC_LOG="$SCRATCH/logs/sync-main-folder.log" TIDY_LOG="$SCRATCH/logs/tidy.log"
al() { cat "$WATCHDOG_ALERTS/$1.alert" 2> /dev/null; }

# fake tmux: list-windows prints $FAKE_WINDOWS, everything is logged
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/tmux" << 'T'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_TMUX_LOG"
[ "$1" = list-windows ] && { cat "$FAKE_WINDOWS" 2> /dev/null; exit 0; }
exit 0
T
chmod +x "$SCRATCH/bin/tmux"
# fake systemd-run: logs its arguments, then runs the command after `--` (the real one starts it in the
# user manager, outside the caller's cgroup)
cat > "$SCRATCH/bin/systemd-run" <<'EOF2'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_SYSTEMD_LOG"
while [ "$1" != "--" ]; do shift; done; shift
exec "$@"
EOF2
chmod +x "$SCRATCH/bin/systemd-run"
export FAKE_SYSTEMD_LOG="$SCRATCH/systemd-run.log"
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
dead "$HP" && wait "$HP" 2> /dev/null  # reap only a dead pid: a missed kill fails, never hangs
dead "$HP" && ok "hung run killed" || fail "hung run still alive"
[ ! -e "$WATCHDOG_HOLDER" ] && ok "holder removed" || fail "holder kept"
grep -q 'hung: no log growth' "$WATCHDOG_LOG" && ok "kill logged" || fail "kill not logged"
grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+Z watchdog: ' "$WATCHDOG_LOG" && ok "UTC timestamps" || fail "log format"
grep -q '^for lots: post-land run for deadbeef01' "$WATCHDOG_ALERTS"/hung-deadbeef01.alert 2> /dev/null && ok "leader told (agent alert)" || fail "leader not told: $(ls "$WATCHDOG_ALERTS" 2>&1)"

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
# Fs as origin/main has them; an F's age is the time of the last commit that touched it.
mk_f() { printf 'id: %s\nowner: %s\nstatus: open\ngoal: x\n' "$1" "$2" > "$WATCHDOG_REPO/tasks/fixes/$1.yml"
  ( cd "$WATCHDOG_REPO" && git add "tasks/fixes/$1.yml" && GIT_COMMITTER_DATE="$3" git commit -qm "$1" && git push -q origin main ); }
mk_f F1 bob "$(date -d '2 hours ago' +%s) +0000"; mk_f F3 "" "$(date -d '2 hours ago' +%s) +0000"; mk_f F2 bob "$(date +%s) +0000"
# An F only in the main checkout (not on origin/main) is not an open F
printf 'id: F9\nowner: bob\nstatus: open\ngoal: x\n' > "$WATCHDOG_REPO/tasks/fixes/F9.yml"; touch -d '2 hours ago' "$WATCHDOG_REPO/tasks/fixes/F9.yml"
out=$(tick)
al F-F1 | grep -q '^for bob: F1: open' && ok "old F alerts its owner" || fail "no alert for F1: $(ls "$WATCHDOG_ALERTS" 2>&1)"
[ -z "$(al F-F2)" ] && ok "fresh F gets no alert" || fail "fresh F2 alerted"
[ -z "$(al F-F9)" ] && ok "Fs are read from origin/main, not the main checkout" || fail "an F only in the main checkout alerted"
rm -f "$WATCHDOG_REPO/tasks/fixes/F9.yml"
al F-F3 | grep -q '^for lots: F3' && ok "ownerless F goes to the leader" || fail "F3 not alerted to the leader"
touch -d '1 hour ago' "$WATCHDOG_ALERTS/F-F1.alert"; n=$(grep -c 'alert F-F1 ' "$WATCHDOG_LOG"); tick > /dev/null
[ "$(stat -c %Y "$WATCHDOG_ALERTS/F-F1.alert")" -gt "$(date -d '10 min ago' +%s)" ] && [ "$(grep -c 'alert F-F1 ' "$WATCHDOG_LOG")" = "$n" ] \
  && ok "an open F's alert is re-written every tick, and logged only when its text changes" || fail "F1 alert not refreshed, or logged again"

# 5. unacknowledged zoo-run result
printf '2026-10-11 11:34:14 | j1: result for carol NOT DELIVERED (no send path); text in /x; after relaying run: zoo-run.sh ack j1\n' >> "$ASK"
printf '2026-10-11 11:35:14 | j2: result for dave NOT DELIVERED (no send path); text in /y; after relaying run: zoo-run.sh ack j2\n' >> "$ASK"
printf 'job=j2\ndelivered=yes\n' > "$WORKSPACE/zoo/state/jobs/j2.env"
tick > /dev/null
al result-j1 | grep -q '^for carol: zoo result j1 is unread' && ok "unacked result alerts its owner" || fail "no alert for j1"
[ -z "$(al result-j2)" ] && ok "acked result is quiet" || fail "acked result alerted"

# 6. gate refused twice in an hour -> one infra F
now=$(date +%s)
printf '%s lint T1\n%s lint T2\n%s unit T3\n' "$((now - 600))" "$((now - 60))" "$now" > "$WATCHDOG_REFUSALS"
tick > /dev/null; tick > /dev/null
infra=$(grep -l 'label: infra' "$WATCHDOG_STATE"/infra/*.yml 2> /dev/null)
[ -z "$(cd "$WATCHDOG_REPO" && git status --porcelain tasks/fixes)" ] && ok "infra F not written into the main checkout" || fail "infra F in the main checkout"
[ "$(echo "$infra" | grep -c .)" = 1 ] && ok "one infra F written" || fail "infra Fs: $infra"
grep -q '^gate: lint' $infra 2> /dev/null && grep -q '^status: open' $infra && grep -q '^owner: lots' $infra && ok "infra F names gate, open, owner leader" || fail "infra F content"
[ "$(basename "$infra")" = F4.yml ] && ok "next F number" || fail "F number: $infra"

# 7. worktrees beside the repo (tidy-branches.sh; its own e2e covers the cases): landed clean removed with its
#    branch; dirty and unlanded kept
W7="$WORKSPACE/repo"
( cd "$WATCHDOG_REPO" && git worktree add -q "$W7-t1" -b t1 && git worktree add -q "$W7-t2" -b t2 \
  && git worktree add -q "$W7-t3" -b t3 ) || fail "worktree setup"
echo x > "$W7-t2/untracked.txt"
( cd "$W7-t3" && git config user.email t@t && git config user.name t && echo y > y && git add y && git commit -qm ahead )
tick > /dev/null
[ ! -d "$W7-t1" ] && ok "landed clean worktree removed" || fail "clean worktree kept: $(tail -3 "$SCRATCH/logs/tidy.log" 2>&1)"
git -C "$WATCHDOG_REPO" rev-parse --verify -q refs/heads/t1 > /dev/null && fail "branch t1 kept" || ok "its branch deleted"
[ -d "$W7-t2" ] && ok "dirty worktree kept" || fail "dirty worktree removed"
[ -d "$W7-t3" ] && ok "unlanded worktree kept" || fail "unlanded worktree removed"
grep -q "removed worktree $W7-t1" "$SCRATCH/logs/tidy.log" && ok "removal logged" || fail "removal not logged"

# 8. overlapping ticks: a held lock makes the second exit quietly
( exec 7> "$WATCHDOG_STATE/watchdog.lock"; flock -x 7; exec sleep 300 ) & PIDS+=("$!"); sleep 0.3
out=$(tick); grep -q 'another tick is running' <<< "$out" && ok "overlap refused" || fail "overlap: $out"
kill -KILL "${PIDS[-1]}" 2> /dev/null; wait "${PIDS[-1]}" 2> /dev/null

# 8b. a run waiting for the browser lock is not hung; after three thresholds it is
export SUITE_RUN_LOCK="$SCRATCH/rt/suite-run.lock"
echo "line" > "$WATCHDOG_POST_LAND_LOG"
setsid sleep 300 & HP=$!; PIDS+=("$HP"); sleep 0.3
hold "$HP"
setsid sleep 300 & WP=$!; PIDS+=("$WP"); sleep 0.3
printf '%s %s\n' "$WP" "$(starttime "$WP")" > "$SUITE_RUN_LOCK.waiting"
touch -d @1000 "$SUITE_RUN_LOCK.waiting"
WATCHDOG_NOW=1000 tick > /dev/null
WATCHDOG_NOW=1250 tick > /dev/null
dead "$HP" && fail "a run waiting for the browser lock was killed" || ok "a run waiting for the browser lock is left alone"
grep -q 'waiting for browser runs to end' "$WATCHDOG_LOG" && ok "the wait is logged" || fail "wait not logged"
WATCHDOG_NOW=1500 tick > /dev/null
dead "$HP" && wait "$HP" 2> /dev/null  # the tick kills before it returns; reap only a dead pid, so a missed kill fails, never hangs
dead "$HP" && ok "a wait past three thresholds is a hang" || fail "an endless wait was never killed"
kill -KILL -- "-$WP" 2> /dev/null; rm -f "$SUITE_RUN_LOCK.waiting" "$WATCHDOG_HOLDER"

# 9. main has an untested commit and no run is alive: a run is started (once old enough)
main_sha=$(git -C "$WATCHDOG_REPO" rev-parse origin/main)
rm -f "$FAKE_RUN_LOG" "$WATCHDOG_HOLDER" "$POST_LAND_LOCK.tested"
tick > /dev/null; sleep 0.5
[ ! -e "$FAKE_RUN_LOG" ] && ok "a young untested main is left to land.sh's own run" || fail "started a run on a young commit"
WATCHDOG_STALL_S=0 tick > /dev/null; sleep 0.5
[ "$(cat "$FAKE_RUN_LOG" 2> /dev/null)" = "$main_sha" ] && ok "an old untested main with no run alive starts one on origin/main" || fail "run not started: $(cat "$FAKE_RUN_LOG" 2> /dev/null)"
grep -q "main ${main_sha:0:10} is untested.*starting one" "$WATCHDOG_LOG" && ok "start logged" || fail "start not logged"
grep -q -- "--user .*--collect .*-- bash .* $main_sha" "$FAKE_SYSTEMD_LOG" 2> /dev/null && ok "the run starts as a transient user service, outside the tick's cgroup" || fail "run not started through systemd-run: $(cat "$FAKE_SYSTEMD_LOG" 2> /dev/null)"
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

# 8. no WATCHDOG_TOOLS: the tick runs origin/main's scripts from a snapshot, not the main checkout's
#    (here the main checkout's copies are broken and uncommitted), and removes the snapshot
SNAP_REPO="$SCRATCH/snap"; git init -q --bare "$SCRATCH/snap-origin.git"
git clone -q "$SCRATCH/snap-origin.git" "$SNAP_REPO" 2> /dev/null
( cd "$SNAP_REPO" && git config user.email t@t && git config user.name t && git symbolic-ref HEAD refs/heads/main \
  && cp -r "$REPO_SRC/scripts" "$REPO_SRC/land.conf" "$REPO_SRC/.gitattributes" . && mkdir -p tasks/fixes && printf 'id: F0\nstatus: closed\n' > tasks/fixes/F0.yml \
  && git add . && git commit -qm base && git push -q origin main ) || fail "snapshot repo setup"
echo 'exit 7' > "$SNAP_REPO/scripts/land/watchdog.sh.broken"; echo 'echo BROKEN; exit 7' > "$SNAP_REPO/scripts/admit/record.sh"
before=$(ls -d "${TMPDIR:-/tmp}"/watchdog-tools.* 2> /dev/null | wc -l)
( unset WATCHDOG_TOOLS; WATCHDOG_REPO="$SNAP_REPO" WATCHDOG_STALL_S=999999 timeout 60 bash "$SNAP_REPO/scripts/land/watchdog.sh" > "$SCRATCH/snap.out" 2>&1 ); r=$?
after=$(ls -d "${TMPDIR:-/tmp}"/watchdog-tools.* 2> /dev/null | wc -l)
[ $r = 0 ] && ! grep -q BROKEN "$SCRATCH/snap.out" && grep -q 'tick done' "$WATCHDOG_LOG" && ok "a broken main checkout: the tick runs origin/main's scripts" || fail "snapshot tick (r=$r): $(tail -3 "$SCRATCH/snap.out")"
[ "$after" = "$before" ] && ok "the snapshot is removed after the tick" || fail "snapshot left behind ($before -> $after)"

# 9. the main folder held (a stray edit not on main) is an agent alert for the leader, every tick until fixed
git -C "$WATCHDOG_REPO" rev-parse origin/main > "$POST_LAND_LOCK.green"
echo stray > "$WATCHDOG_REPO/stray-not-on-main.txt"
tick > /dev/null
al main-folder | grep -q '^for lots: the main folder cannot update to main: .*of its own' && ok "a held main folder alerts the leader" \
  || fail "no main-folder alert: $(al main-folder) $(grep 'main folder' "$WATCHDOG_LOG" | tail -2)"
[ -z "$(git -C "$WATCHDOG_REPO" status --porcelain)" ] && git -C "$WATCHDOG_REPO" show HEAD:stray-not-on-main.txt > /dev/null 2>&1 \
  && ok "the stray edit is committed there, nothing lost" || fail "stray edit not committed"

[ ! -s "$FAKE_TMUX_LOG" ] && ok "tmux is never used" || fail "tmux was called: $(head -3 "$FAKE_TMUX_LOG")"
! grep -q 'watchdog' "$ASK" && ok "nothing is written to ASK.md" || fail "ASK.md written: $(grep watchdog "$ASK" | head -2)"

[ $fails = 0 ] && echo "ALL OK" || echo "$fails FAILED"
exit $((fails > 0))
