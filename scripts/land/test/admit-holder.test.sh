#!/usr/bin/env bash
# A wiped queue cannot let a second run in while the first still holds the slot: admission checks the
# holder by pid and start time, not only the ticket files. T042 (post-land runs 98452289, de5a277b
# and dffbd0b8 ran at once after /tmp/openisd-admit was reset).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/admit-holder.XXXXXX")"
export ADMIT_DIR="$SCRATCH/admit"
fails=0
trap 'rm -rf "$SCRATCH"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
A="$REPO/scripts/admit.sh"
LOG="$SCRATCH/seq"

mark() { echo "$1 $(date +%s.%N)" >> "$LOG"; }
export -f mark; export LOG

# 1. the queue directory is wiped while A runs; B must still wait for A
bash "$A" first -- bash -c 'mark first-start; sleep 4; mark first-end' > "$SCRATCH/o1" 2>&1 & p1=$!
sleep 1
rm -rf "$ADMIT_DIR"
timeout 60 bash "$A" second -- bash -c 'mark second-start' > "$SCRATCH/o2" 2>&1 & p2=$!
wait "$p1" "$p2"
first_end=$(awk '$1=="first-end"{print $2}' "$LOG")
second_start=$(awk '$1=="second-start"{print $2}' "$LOG")
if [ -n "$first_end" ] && [ -n "$second_start" ] && awk -v a="$first_end" -v b="$second_start" 'BEGIN{exit !(b >= a)}'; then
  ok "second run waited for the first after the queue was wiped"
else
  fail "second run started at $second_start, before the first ended at $first_end"
fi
grep -q first "$SCRATCH/o2" && ok "the waiter names the holder" || fail "the waiter did not name the holder"

# 2. a holder record of a dead owner does not block
: > "$LOG"
bash "$A" doomed -- sleep 50 & dpid=$!
sleep 1
kill -KILL "$dpid" 2> /dev/null; wait "$dpid" 2> /dev/null
timeout 30 bash "$A" after -- bash -c 'mark after-start'
grep -q after-start "$LOG" && ok "a dead holder does not block" || fail "a dead holder blocked the next run"

# 3. a reused pid (same pid, other start time) in the holder record does not block
: > "$LOG"
holder="$ADMIT_DIR.holder"
printf 'pid=%s\nstart=1\nlabel=stale\n' "$$" > "$holder"
timeout 30 bash "$A" reused -- bash -c 'mark reused-start'
grep -q reused-start "$LOG" && ok "a reused pid does not block" || fail "a stale holder record blocked the next run"
exit "$fails"
