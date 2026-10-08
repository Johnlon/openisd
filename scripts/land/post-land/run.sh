#!/usr/bin/env bash
# The full run on a landed commit: bash scripts/land/post-land/run.sh <sha>
#
# Started detached by land.sh after a push. It
#   1. takes POST_LAND_LOCK (flock): post-land runs go one at a time, and the lock is released when
#      this process ends, however it ends;
#   2. checks <sha> out as a clean copy under POST_LAND_DIR, outside every clone;
#   3. runs FULL_SUITE_CMD in the copy once. There is no rerun: a flake is a red;
#   4. removes the copy;
#   5. green: fast-forwards branch `release` on origin to <sha> (only if <sha> descends from it);
#      red: leaves `release` alone, pushes tasks/fixes/F<n>.yml (status: open, sha, the failing
#      output's last lines) to main, exit 1. The next landing is refused while that task is open.
# Config in land.conf: FULL_SUITE_CMD, POST_LAND_LOCK, POST_LAND_DIR.
# NO_RELEASE_PUSH=1 in the environment: a green run is reported but `release` is not moved (a red run
# still opens its fixes task).
set -uo pipefail

SHA_ARG="${1:?usage: run.sh <sha>}"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
[ -f land.conf ] || { echo "post-land: no land.conf in $ROOT" >&2; exit 2; }
# shellcheck source=/dev/null
. ./land.conf
SHA="$(git rev-parse --verify "$SHA_ARG^{commit}")" || exit 2

mkdir -p "$POST_LAND_DIR"
COPY="$POST_LAND_DIR/$$-${SHA:0:10}"
OUT="$(mktemp "${TMPDIR:-/tmp}/post-land-out.XXXXXX")"
BODY=""
FIX=""

# The suite runs as one background job in its own process group; stopping this run stops it all.
stop_suite() {
  [ -n "$BODY" ] || return 0
  local body="$BODY"
  BODY=""
  kill -TERM -- "-$body" 2>/dev/null || true
  wait "$body" 2>/dev/null || true
  kill -KILL -- "-$body" 2>/dev/null || true
}
cleanup() {
  local status=$?
  stop_suite
  git -C "$ROOT" worktree remove --force "$COPY" 2>/dev/null || rm -rf "$COPY"
  [ -z "$FIX" ] || { git -C "$ROOT" worktree remove --force "$FIX" 2>/dev/null; rm -rf "$FIX"; }
  git -C "$ROOT" worktree prune
  rm -f "$OUT"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

exec 9> "$POST_LAND_LOCK"
flock -n 9 || { echo "post-land: waiting for another post-land run"; flock 9; }

git worktree add -q --detach "$COPY" "$SHA" || { echo "post-land: cannot check out $SHA" >&2; exit 2; }
echo "post-land: running the full suite on ${SHA:0:10}"
set -m
( cd "$COPY" && export POST_LAND_SRC="$ROOT" && exec bash -c "$FULL_SUITE_CMD" ) > "$OUT" 2>&1 &
BODY=$!
set +m
wait "$BODY"
rc=$?
BODY=""

git fetch -q origin || { echo "post-land: fetch failed" >&2; exit 2; }

if [ "$rc" = 0 ]; then
  if git merge-base --is-ancestor "$SHA" origin/release 2>/dev/null; then
    echo "post-land: green; ${SHA:0:10} is already in release"
  elif [ "${NO_RELEASE_PUSH:-}" = 1 ]; then
    echo "post-land: green; NO_RELEASE_PUSH=1, release left alone"
  elif ! git rev-parse --verify -q origin/release > /dev/null \
       || git merge-base --is-ancestor origin/release "$SHA"; then
    git push -q origin "$SHA:refs/heads/release" && echo "post-land: green; release is now ${SHA:0:10}"
  else
    echo "post-land: green; ${SHA:0:10} does not descend from release, release left alone"
  fi
  exit 0
fi

# Red: open a fixes task on top of the tested commit. The push can lose a race with a landing, so recompute and retry.
FIX="$(mktemp -d "${TMPDIR:-/tmp}/post-land-fix.XXXXXX")"
for attempt in 1 2 3; do
  git fetch -q origin main
  # The fixes commit goes on top of the tested commit. When origin/main already holds it, that is
  # origin/main. When origin/main is behind it (main is ahead of origin), it is the tested commit
  # itself, and the push is a fast-forward carrying the tested history with it. When origin/main
  # has moved on without it, nothing is pushed.
  if git merge-base --is-ancestor "$SHA" origin/main; then base=origin/main
  elif git merge-base --is-ancestor origin/main "$SHA"; then base="$SHA"
  else
    echo "post-land: RED at ${SHA:0:10} but origin/main has diverged from it (cannot fast-forward); nothing pushed" >&2
    exit 1
  fi
  git -C "$ROOT" worktree remove --force "$FIX" 2>/dev/null; rm -rf "$FIX"
  git worktree add -q --detach "$FIX" "$base" || exit 2
  mkdir -p "$FIX/tasks/fixes"
  last="$(ls "$FIX/tasks/fixes" 2>/dev/null | sed -n 's/^F\([0-9][0-9]*\)\.yml$/\1/p' | sort -n | tail -n 1)"
  n=$(( ${last:-0} + 1 ))
  {
    printf 'id: F%s\nowner: post-land\nstatus: open\nsha: %s\n' "$n" "$SHA"
    printf 'goal: main is red at %s; make the full suite pass again\n' "${SHA:0:10}"
    printf 'output: |\n'
    tail -n 40 "$OUT" | sed 's/^/  /'
  } > "$FIX/tasks/fixes/F$n.yml"
  git -C "$FIX" add "tasks/fixes/F$n.yml"
  git -C "$FIX" commit -q -m "F$n: the full suite is red at ${SHA:0:10}" || exit 2
  if git -C "$FIX" push -q origin HEAD:main; then
    echo "post-land: RED at ${SHA:0:10}; opened tasks/fixes/F$n.yml on main" >&2
    exit 1
  fi
done
echo "post-land: RED at ${SHA:0:10} but could not push the fixes task" >&2
exit 1
