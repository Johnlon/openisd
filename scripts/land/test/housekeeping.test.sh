#!/usr/bin/env bash
# Acceptance test for scripts/housekeeping.sh. Builds slot records by hand (no admit.sh needed).
# Every process started here is killed by pid in the EXIT trap; none is found by command text.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
H="$REPO/scripts/housekeeping.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/housekeeping-test.XXXXXX")"
export ADMIT_DIR="$SCRATCH/admit"
export HOUSEKEEPING_LOG="$SCRATCH/logs/housekeeping.log"
# Never the real browser-run records: a scan here must not stop anyone's run.
export OPENISD_RESERVATION_DIR="$SCRATCH/reservations" OPENISD_RESERVATION_LOCK="$SCRATCH/reservations.lock"
# Never real processes either: the tag scan reads only this test's own tag name.
export HOUSEKEEPING_TAG="HK_TEST_OWNER_$$"
PIDS=()
fails=0
GROUPS_MADE=()
cleanup() { for p in "${PIDS[@]}"; do kill -KILL "$p" 2> /dev/null; done
  for g in "${GROUPS_MADE[@]}"; do kill -KILL -- "-$g" 2> /dev/null; done; rm -rf "$SCRATCH"; }
trap cleanup EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
mkdir -p "$ADMIT_DIR/q"

holder() { # holder <rec-file>: background process holding the record's exclusive lock; pid in HPID
  ( exec 9>> "$1"; flock -x 9; exec sleep 300 ) &
  HPID=$!; PIDS+=("$HPID")
  sleep 0.5
}
starttime() { local s; s=$(cat "/proc/$1/stat"); s=${s##*) }; set -- $s; echo "${20}"; }

# 1. dead owner (lock holder SIGKILLed), live owner, and live lock with a gone pid
dead="$ADMIT_DIR/q/00000001.rec"; live="$ADMIT_DIR/q/00000002.rec"; odd="$ADMIT_DIR/q/00000003.rec"
printf 'pid=999999\nstart=1\nlabel=doomed\nrun=r1\nqueued=1\n' > "$dead"
holder "$dead"; kill -KILL "$HPID"; wait "$HPID" 2> /dev/null
holder "$live"
printf 'pid=%s\nstart=%s\nlabel=alive\nrun=r2\nqueued=1\n' "$HPID" "$(starttime "$HPID")" > "$live"
printf 'pid=999998\nstart=1\nlabel=oddball\nrun=r3\nqueued=1\n' > "$odd"
holder "$odd"

out=$(timeout 30 bash "$H" 2>&1); r=$?
[ $r = 0 ] && ok "exit 0" || fail "exit $r: $out"
grep -qi doomed <<< "$out" && ok "line names doomed" || fail "no doomed line: $out"
grep -q 'freed slot 00000001 of "doomed" (owner pid 999999 is dead)' <<< "$out" && ok "exact line" || fail "line format: $out"
[ ! -e "$dead" ] && ok "dead record removed" || fail "dead record still there"
[ -e "$live" ] && ok "live record kept" || fail "live record removed"
[ -e "$odd" ] && ok "held record with gone pid kept" || fail "held record removed"
grep -q '1 slot(s) freed, 2 live' <<< "$out" && ok "summary line" || fail "summary: $out"
grep -q 'freed slot 00000001 of "doomed"' "$HOUSEKEEPING_LOG" && ok "log has the line" || fail "log missing line"
grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*housekeeping: 1 slot' "$HOUSEKEEPING_LOG" && ok "log has timestamp + summary" || fail "log summary"

# 2. zombie owner whose lock is free counts as dead
z="$ADMIT_DIR/q/00000004.rec"
printf 'pid=999997\nstart=1\nlabel=gone\nrun=r4\nqueued=1\n' > "$z"
timeout 30 bash "$H" > /dev/null 2>&1
[ ! -e "$z" ] && ok "free-lock record removed" || fail "free-lock record kept"

# 3. missing ADMIT_DIR is nothing to do
ADMIT_DIR="$SCRATCH/nope" timeout 30 bash "$H" > /dev/null 2>&1; r=$?
[ $r = 0 ] && ok "missing ADMIT_DIR exits 0" || fail "missing dir exit $r"

# 4. unreadable q dir fails loudly (skipped as root: permissions do not bind)
if [ "$(id -u)" != 0 ]; then
  chmod 000 "$ADMIT_DIR/q"
  err=$(timeout 30 bash "$H" 2>&1 > /dev/null); r=$?
  chmod 755 "$ADMIT_DIR/q"
  [ $r != 0 ] && [ -n "$err" ] && ok "unreadable dir fails with cause" || fail "unreadable dir r=$r err=$err"
fi

# 5. a concurrent scan is refused politely
( exec 8> "$ADMIT_DIR/housekeeping.lock"; flock -x 8; exec sleep 300 ) & PIDS+=("$!")
sleep 0.5
out=$(timeout 30 bash "$H" 2>&1); r=$?
[ $r = 0 ] && grep -q 'another scan is running' <<< "$out" && ok "busy lock handled" || fail "busy lock r=$r: $out"

# 6. post-land copies: a copy whose owner pid is dead goes, a live owner's copy stays
export HOUSEKEEPING_POST_LAND_DIR="$SCRATCH/postland" HOUSEKEEPING_REPO="$SCRATCH/repo"
git init -q "$HOUSEKEEPING_REPO" && git -C "$HOUSEKEEPING_REPO" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
mkdir -p "$HOUSEKEEPING_POST_LAND_DIR"
git -C "$HOUSEKEEPING_REPO" worktree add -q --detach "$HOUSEKEEPING_POST_LAND_DIR/999996-deadbeef01" HEAD
sleep 300 & LIVE=$!; PIDS+=("$LIVE")
git -C "$HOUSEKEEPING_REPO" worktree add -q --detach "$HOUSEKEEPING_POST_LAND_DIR/$LIVE-cafebabe02" HEAD
mkdir -p "$HOUSEKEEPING_POST_LAND_DIR/winisd_drivers"
ADMIT_DIR="$SCRATCH/nope" out=$(timeout 30 bash "$H" 2>&1); r=$?
[ $r = 0 ] && ok "copies scan exits 0" || fail "copies scan exit $r: $out"
[ ! -e "$HOUSEKEEPING_POST_LAND_DIR/999996-deadbeef01" ] && ok "dead owner's copy removed" || fail "dead copy kept"
[ -d "$HOUSEKEEPING_POST_LAND_DIR/$LIVE-cafebabe02" ] && ok "live owner's copy kept" || fail "live copy removed"
[ -d "$HOUSEKEEPING_POST_LAND_DIR/winisd_drivers" ] && ok "non-copy dir untouched" || fail "winisd_drivers removed"
grep -q 'removed post-land copy .*999996-deadbeef01 (owner pid 999996 is dead)' "$HOUSEKEEPING_LOG" && ok "removal logged" || fail "removal not logged"
git -C "$HOUSEKEEPING_REPO" worktree list | grep -q deadbeef01 && fail "worktree record kept" || ok "worktree record pruned"

# 7. browser runs (scripts/browser-runs.sh): a run is its own process group holding the browser lock
#    shared; it is stopped when its recorded owner is dead or its owner pid was reused, never otherwise.
mkdir -p "$OPENISD_RESERVATION_DIR"
LOCK="$SCRATCH/suite-run.lock"; : > "$LOCK"
browser_run() { # browser_run <owner "pid start">: a run in its own group holding LOCK shared; pid in RPID
  setsid bash -c 'exec 9> "$1"; flock -s 9; exec sleep 300' _ "$LOCK" &
  RPID=$!; PIDS+=("$RPID")
  sleep 0.5
  printf 'WORKERS=1\nPORT=41%02d\nGROUP_START=%s\nOWNER=%s\n' "$((RPID % 90))" "$(starttime "$RPID")" "$1" \
    > "$OPENISD_RESERVATION_DIR/$RPID"
}
sleep 300 & OWNER_DEAD=$!; PIDS+=("$OWNER_DEAD")
browser_run "$OWNER_DEAD $(starttime "$OWNER_DEAD")"; ORPHAN=$RPID
sleep 300 & OWNER_LIVE=$!; PIDS+=("$OWNER_LIVE")
browser_run "$OWNER_LIVE $(starttime "$OWNER_LIVE")"; KEPT=$RPID
browser_run "$OWNER_LIVE 1"; REUSED=$RPID
browser_run ""; UNTAGGED=$RPID
kill -KILL "$OWNER_DEAD"; wait "$OWNER_DEAD" 2> /dev/null
[ "$(ps -o pgid= -p "$ORPHAN" | tr -d ' ')" = "$ORPHAN" ] && ok "a browser run leads its own group" || fail "test run is not a group leader"
ADMIT_DIR="$SCRATCH/nope" out=$(timeout 60 bash "$H" 2>&1); r=$?
[ $r = 0 ] && ok "browser scan exits 0" || fail "browser scan exit $r: $out"
wait "$ORPHAN" 2> /dev/null; wait "$REUSED" 2> /dev/null
[ ! -e "/proc/$ORPHAN" ] && ok "dead owner's run stopped" || fail "orphan run still alive"
[ ! -e "$OPENISD_RESERVATION_DIR/$ORPHAN" ] && ok "dead owner's record removed" || fail "orphan record kept"
grep -q "stopped browser run $ORPHAN on port .* (owner pid $OWNER_DEAD is dead)" "$HOUSEKEEPING_LOG" && ok "stop logged" || fail "stop not logged: $out"
[ ! -e "/proc/$REUSED" ] && ok "reused owner's run stopped" || fail "reused-owner run alive"
grep -q "stopped browser run $REUSED .*(owner pid $OWNER_LIVE was reused by another process)" "$HOUSEKEEPING_LOG" && ok "reuse logged" || fail "reuse not logged"
[ -e "/proc/$KEPT" ] && [ -e "$OPENISD_RESERVATION_DIR/$KEPT" ] && ok "live owner's run kept" || fail "live owner's run touched"
[ -e "/proc/$UNTAGGED" ] && [ -e "$OPENISD_RESERVATION_DIR/$UNTAGGED" ] && ok "run with no owner kept" || fail "untagged run touched"

# 8. post-land's stop: every run owned by a pid is stopped, others are not; then the lock is free
. "$REPO/scripts/browser-runs.sh"
browser_runs_stop_owned_by "$OWNER_LIVE" > /dev/null
wait "$KEPT" 2> /dev/null
[ ! -e "/proc/$KEPT" ] && [ ! -e "$OPENISD_RESERVATION_DIR/$KEPT" ] && ok "owner's runs stopped on request" || fail "owned run kept"
[ -e "/proc/$UNTAGGED" ] && ok "another owner's run kept" || fail "unowned run stopped"
kill -KILL "$UNTAGGED"; wait "$UNTAGGED" 2> /dev/null
timeout 5 flock -x "$LOCK" true && ok "browser lock free for the suite" || fail "browser lock still held"

# 9. a record whose group leader pid now belongs to another process: removed, that process untouched
sleep 300 & STRANGER=$!; PIDS+=("$STRANGER")
printf 'WORKERS=1\nPORT=4188\nGROUP_START=1\nOWNER=999995 1\n' > "$OPENISD_RESERVATION_DIR/$STRANGER"
ADMIT_DIR="$SCRATCH/nope" timeout 60 bash "$H" > /dev/null 2>&1
[ -e "/proc/$STRANGER" ] && ok "reused group pid not signalled" || fail "stranger killed"
[ ! -e "$OPENISD_RESERVATION_DIR/$STRANGER" ] && ok "its stale record removed" || fail "stale record kept"

# 10. the slot record carries the owner and the group's start (scripts/test-concurrency.sh)
rec=$(cd "$REPO" && OPENISD_BROWSER_OWNER="4242 77" bash -c '. scripts/test-concurrency.sh; reserve_test_slot 2> /dev/null; cat "$OPENISD_RESERVATION_DIR/$$"; release_test_slot')
grep -qx 'OWNER=4242 77' <<< "$rec" && ok "slot records its owner" || fail "no OWNER line: $rec"
grep -qE '^GROUP_START=[0-9]+$' <<< "$rec" && ok "slot records its group start" || fail "no GROUP_START: $rec"

# 9. rule 7 end to end: a run's tagged processes outlive their owner, record and clean copy (17 Oct:
#    vite previews on 4102-4104, reparented to init, cwd a deleted .postland copy). One tick stops them;
#    a live owner's process, and an untagged group leader, are left alone.
copy="$SCRATCH/postland-copy"; mkdir -p "$copy"
bash -c 'sleep 300 & wait' & OWNER=$!; PIDS+=("$OWNER"); sleep 0.3
tag="$OWNER $(starttime "$OWNER")"
# the "vite" group: a tagged leader and a tagged child, in their own group, cwd the copy (pids via files)
( cd "$copy" && exec env "$HOUSEKEEPING_TAG=$tag" setsid bash -c 'echo $$ > "$0/vg"; sleep 300 & echo $! > "$0/vkid"; wait' "$SCRATCH" ) &
# a tagged process whose group leader is untagged
( exec setsid bash -c 'echo $$ > "$0/lead"; env "$1=$2" sleep 300 & echo $! > "$0/lkid"; sleep 300' "$SCRATCH" "$HOUSEKEEPING_TAG" "$tag" ) &
sleep 0.5
VG=$(cat "$SCRATCH/vg"); VKID=$(cat "$SCRATCH/vkid"); LEAD=$(cat "$SCRATCH/lead"); LKID=$(cat "$SCRATCH/lkid")
PIDS+=("$VG" "$VKID" "$LEAD" "$LKID"); GROUPS_MADE+=("$VG" "$LEAD")
# a live owner's tagged process
env "$HOUSEKEEPING_TAG=$$ $(starttime $$)" sleep 300 & LIVE=$!; PIDS+=("$LIVE")
kill -KILL "$OWNER"; wait "$OWNER" 2> /dev/null; rm -rf "$copy"; sleep 0.3
[ -n "$VG" ] && [ -n "$VKID" ] && [ -n "$LEAD" ] && [ -n "$LKID" ] && ok "e2e setup: tagged group, tagged child under an untagged leader" || fail "e2e setup: VG=$VG VKID=$VKID LEAD=$LEAD LKID=$LKID"
out=$(timeout 30 bash "$H" 2>&1); sleep 0.3
alive() { [ -e "/proc/$1" ] && [ "$(cut -d' ' -f3 "/proc/$1/stat" 2> /dev/null)" != Z ]; }
! alive "$VG" && ! alive "$VKID" && ok "dead owner: the tagged group is stopped" || fail "tagged group lives: $out"
grep -q "stopped process group $VG tagged with dead browser owner pid $OWNER" <<< "$out" && ok "the stop is logged with the owner" || fail "no log line: $out"
! alive "$LKID" && alive "$LEAD" && ok "a tagged process under an untagged leader: only it is stopped" || fail "untagged leader case: LEAD $(alive "$LEAD" && echo up) LKID $(alive "$LKID" && echo up)"
alive "$LIVE" && ok "a live owner's tagged process is left alone" || fail "live owner's process stopped"

[ $fails = 0 ] && echo "ALL OK" || echo "$fails FAILED"
exit $((fails > 0))
