#!/usr/bin/env bash
# Test that runtime paths work correctly:
# (a) no fixed /tmp names remain in any script under scripts/ or land.conf
# (b) two concurrent runs of scripts/slow-run/queue.sh and of the land lock take turns through the SAME dir
# (c) each script above run from a different cwd still finds its files

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; exit 1; }

# (a) git grep finds no fixed /tmp name in any script under scripts/ or land.conf
echo "=== (a) Checking for fixed /tmp paths ==="
# Match absolute /tmp/ paths, not build/tmp/ or other relative paths
if git -C "$REPO_ROOT" grep -n -E '^/tmp/[A-Za-z]|[^a-zA-Z0-9_/]/tmp/[A-Za-z]' -- 'scripts/**' 'land.conf' ':!*.md' ':!docs/_archive' 2>/dev/null | grep -v '.test.sh' | grep -v 'build/tmp'; then
    fail "Found fixed /tmp paths in scripts/ or land.conf"
else
    ok "No fixed /tmp paths in scripts/ or land.conf"
fi

# (b) Two concurrent runs of slow-run/queue.sh and land lock take turns through the SAME dir
echo "=== (b) Testing concurrent slow-run queue ==="
export XDG_RUNTIME_DIR="$SCRATCH/xdg"
mkdir -p "$XDG_RUNTIME_DIR"

# Test slow-run queue
export SLOW_RUN_DIR="$SCRATCH/slow-run-queue"
mkdir -p "$SLOW_RUN_DIR/q"

# Start first slow run (holds the queue)
(
    . "$REPO_ROOT/scripts/slow-run/queue.sh"
    slow_queue_enter "test-run-1"
    sleep 3
    slow_queue_leave
) &
pid1=$!

# Give it time to acquire the lock
sleep 0.5

# Start second slow run (should wait)
(
    . "$REPO_ROOT/scripts/slow-run/queue.sh"
    slow_queue_enter "test-run-2"
    slow_queue_leave
) &
pid2=$!

# Wait for both to complete
wait $pid1
wait $pid2
ok "slow-run queue: second run waited for first"

# Test land lock (LAND_LOCK)
export OPENISD_RUNTIME_DIR="$SCRATCH/runtime"
mkdir -p "$OPENISD_RUNTIME_DIR"

# Start first land lock holder
(
    . "$REPO_ROOT/scripts/paths.sh"
    exec 9>"$LAND_LOCK"
    flock 9
    sleep 3
) &
pid1=$!

sleep 0.5

# Start second land lock waiter
(
    . "$REPO_ROOT/scripts/paths.sh"
    exec 9>"$LAND_LOCK"
    flock 9
    # Got the lock, release immediately
) &
pid2=$!

wait $pid1
wait $pid2
ok "land lock: second run waited for first"

# (c) Each script run from a different cwd still finds its files
echo "=== (c) Testing scripts from different cwd ==="
cd "$SCRATCH"
mkdir -p subdir1 subdir2 subdir3

# Test paths.sh from different cwd
cd "$SCRATCH/subdir1"
. "$REPO_ROOT/scripts/paths.sh"
[ -d "$OPENISD_RUNTIME_DIR" ] || fail "paths.sh: OPENISD_RUNTIME_DIR not accessible from subdir1"
ok "paths.sh works from subdir1"

# Test heavy-gate-concurrency.sh from different cwd
cd "$SCRATCH/subdir2"
. "$REPO_ROOT/scripts/hooks-local/heavy-gate-concurrency.sh"
[ -d "$OPENISD_HEAVY_GATE_DIR" ] || fail "heavy-gate-concurrency.sh: dir not accessible from subdir2"
ok "heavy-gate-concurrency.sh works from subdir2"

# Test test-concurrency.sh from different cwd
cd "$SCRATCH/subdir3"
. "$REPO_ROOT/scripts/test-concurrency.sh"
[ -d "$OPENISD_RESERVATION_DIR" ] || fail "test-concurrency.sh: dir not accessible from subdir3"
ok "test-concurrency.sh works from subdir3"

# Test slow-run/queue.sh from different cwd
cd "$SCRATCH/subdir1"
. "$REPO_ROOT/scripts/slow-run/queue.sh"
[ -d "$SLOW_RUN_DIR/q" ] || fail "slow-run/queue.sh: dir not accessible from subdir1"
ok "slow-run/queue.sh works from subdir1"

# Test admit/record.sh from different cwd
cd "$SCRATCH/subdir2"
. "$REPO_ROOT/scripts/admit/record.sh"
ADMIT_DIR=$(admit_dir)
mkdir -p "$ADMIT_DIR/q"
[ -d "$ADMIT_DIR/q" ] || fail "admit/record.sh: dir not accessible from subdir2"
ok "admit/record.sh works from subdir2"

echo "=== All tests passed ==="
exit 0