#!/usr/bin/env bash
# Test ports are owned by flock (John, 2026-10-16): two live runs never get the same port, a dead run's port is
# free at once, and a full pool is an error, not a shared port. Real processes, scratch reservation dir.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/port-pool.XXXXXX")"
export OPENISD_RESERVATION_DIR="$SCRATCH/res"
fails=0; holders=()
trap 'for p in "${holders[@]}"; do kill "$p" 2>/dev/null; done; rm -rf "$SCRATCH"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
# a run: reserves, prints its port, then holds until killed
hold() { ( cd "$REPO" && . scripts/test-concurrency.sh && reserve_test_slot 2> /dev/null && echo "$OPENISD_TEST_PORT" > "$1" && exec sleep 120 ) & holders+=($!); }
wait_file() { timeout 20 bash -c "until [ -s '$1' ]; do sleep 0.1; done"; }

hold "$SCRATCH/a"; wait_file "$SCRATCH/a"; hold "$SCRATCH/b"; wait_file "$SCRATCH/b"
a=$(cat "$SCRATCH/a"); b=$(cat "$SCRATCH/b")
[ "$a" != "$b" ] && ok "two live runs get different ports ($a, $b)" || fail "same port $a"

kill "${holders[0]}"; wait "${holders[0]}" 2> /dev/null
hold "$SCRATCH/c"; wait_file "$SCRATCH/c"
[ "$(cat "$SCRATCH/c")" = "$a" ] && ok "a dead run's port is reused at once" || fail "port after death: $(cat "$SCRATCH/c") want $a"

out=$(cd "$REPO" && OPENISD_PORT_POOL_SIZE=2 bash -c '. scripts/test-concurrency.sh; OPENISD_PORT_POOL_SIZE=2; reserve_test_slot' 2>&1); rc=$?
[ "$rc" != 0 ] && echo "$out" | grep -q "owned by live runs" && ok "a full pool is an error, never a shared port" || fail "full pool rc=$rc: $out"

[ $fails = 0 ] && { echo "port-pool: all passed"; exit 0; }
echo "port-pool: $fails failed"; exit 1
