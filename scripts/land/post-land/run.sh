#!/usr/bin/env bash
# The full run on a landed commit: bash scripts/land/post-land/run.sh <sha>
#
# Started detached by land.sh after a push. It
#   1. takes POST_LAND_LOCK (flock): post-land runs go one at a time, and the lock is released when
#      this process ends, however it ends;
#   2. checks <sha> out as a clean copy under POST_LAND_DIR, outside every clone;
#   3. runs FULL_SUITE_CMD in the copy once. There is no rerun: a flake is a red;
#   4. removes the copy;
#   5. green: records <sha> as the last green in ${POST_LAND_LOCK}.green (written atomically) and
#      prints "post-land: green at <sha>"; red: pushes tasks/fixes/F<n>.yml (status: open, sha, owner =
#      author of the first commit since the last green, the failing spec lines, the output's last lines)
#      to main, exit 1. The next landing is refused while that task is open. A red while an F is already
#      open is appended to that F (one F per fault), never a new F.
# Runs coalesce: a run registers in ${POST_LAND_LOCK}.pending before it waits for the lock. When it gets its
# turn and a NEWER run is already waiting (its record is flock'ed by a live process), it ends "superseded
# by <sha>" with exit 0 without running the suite; the newest run tests the latest sha. A run that finds an
# OLDER commit's suite running (${POST_LAND_LOCK}.holder: pid, start time, sha) kills it by pid; the killed
# run ends "superseded by <sha>; killed", exit 0. A run whose sha is an ancestor of the last tested sha
# (${POST_LAND_LOCK}.tested) ends "superseded by <sha> (already tested)", exit 0. A red lists every commit since the last green in its F.
# Config in land.conf: FULL_SUITE_CMD, POST_LAND_LOCK, POST_LAND_DIR.
# A release is the GitHub Pages deploy on every push to main; post-land is the local full run.
set -uo pipefail

SHA_ARG="${1:?usage: run.sh <sha>}"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
[ -f land.conf ] || { echo "post-land: no land.conf in $ROOT" >&2; exit 2; }
# shellcheck source=/dev/null
# paths.sh sets POST_LAND_LOCK (and the runtime dir); land.conf does not, and this script is started
# detached, so nothing is inherited. 12 Oct: every post-land run died here with POST_LAND_LOCK unbound.
# shellcheck source=/dev/null
. "$ROOT/scripts/paths.sh"
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
HOLDER="${POST_LAND_LOCK}.holder"
SUPERSEDE="${POST_LAND_LOCK}.supersede"
# A newer run killed this one (SDLC S2): the suite stops, nothing is recorded, exit 0 like any superseded run.
superseded() {
  local newer; newer="$(cat "$SUPERSEDE" 2>/dev/null)"
  stop_suite
  echo "post-land: superseded by ${newer:-a newer run}; killed"
  exit 0
}
cleanup() {
  local status=$?
  stop_suite
  [ "$(cut -d' ' -f1 "$HOLDER" 2>/dev/null)" = "$$" ] && rm -f "$HOLDER"
  git -C "$ROOT" worktree remove --force "$COPY" 2>/dev/null || rm -rf "$COPY"
  [ -z "$FIX" ] || { git -C "$ROOT" worktree remove --force "$FIX" 2>/dev/null; rm -rf "$FIX"; }
  git -C "$ROOT" worktree prune
  rm -f "$OUT" "${MINE:-}"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

PENDING="${POST_LAND_LOCK}.pending"
mkdir -p "$PENDING"
MINE="$PENDING/$(date +%s%N)-$SHA"
exec 8> "$MINE"
flock -n 8
# A run already testing an OLDER commit is wasted work: this run kills it (by its recorded pid and
# start time, never by name) and takes its turn. Four full runs once ran side by side for hours,
# each on a commit the next had already replaced (11 Oct 2026, SDLC R3/S2).
starttime() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }
hpid=""; hstart=""; hsha=""
[ -f "$HOLDER" ] && { read -r hpid hstart hsha < "$HOLDER" || true; }
if [ -n "$hpid" ] && [ "$hpid" != "$$" ] && [ "$(starttime "$hpid")" = "${hstart:-}" ] \
   && [ "$hsha" != "$SHA" ] && git merge-base --is-ancestor "$hsha" "$SHA" 2>/dev/null; then
  printf '%s\n' "${SHA:0:10}" > "$SUPERSEDE"
  kill -TERM "$hpid" 2>/dev/null || true
  echo "post-land: killed the run on ${hsha:0:10} (pid $hpid), superseded by ${SHA:0:10}"
fi
exec 9> "$POST_LAND_LOCK"
flock -n 9 || { echo "post-land: waiting for another post-land run"; flock 9; }
trap superseded TERM

# A later commit has already been tested (${POST_LAND_LOCK}.tested): this run's result is stale.
tested="$(cat "${POST_LAND_LOCK}.tested" 2>/dev/null)"
if [ -n "$tested" ] && [ "$tested" != "$SHA" ] && git merge-base --is-ancestor "$SHA" "$tested" 2>/dev/null; then
  echo "post-land: superseded by ${tested:0:10} (already tested)"; exit 0
fi
# A newer run that is still waiting (live owner) will test a later sha: this one is superseded.
for rec in "$PENDING"/*; do
  [ -e "$rec" ] && [ "$rec" != "$MINE" ] || continue
  [[ "$(basename "$rec")" > "$(basename "$MINE")" ]] || continue
  if ! ( flock -n 7 ) 7< "$rec" 2> /dev/null; then
    newer="$(basename "$rec")"; echo "post-land: superseded by ${newer#*-}"; exit 0
  fi
done

git worktree add -q --detach "$COPY" "$SHA" || { echo "post-land: cannot check out $SHA" >&2; exit 2; }
printf '%s %s %s\n' "$$" "$(starttime $$)" "$SHA" > "$HOLDER"
rm -f "$SUPERSEDE"
echo "post-land: running the full suite on ${SHA:0:10}"
set -m
( cd "$COPY" && export POST_LAND_SRC="$ROOT" && exec bash -c "$FULL_SUITE_CMD" ) > "$OUT" 2>&1 &
BODY=$!
set +m
wait "$BODY"
rc=$?
BODY=""
trap 'exit 143' TERM
printf '%s\n' "$SHA" > "${POST_LAND_LOCK}.tested.$$" && mv -f "${POST_LAND_LOCK}.tested.$$" "${POST_LAND_LOCK}.tested"

if [ "$rc" = 0 ]; then
  printf '%s\n' "$SHA" > "${POST_LAND_LOCK}.green.$$" && mv -f "${POST_LAND_LOCK}.green.$$" "${POST_LAND_LOCK}.green"
  echo "post-land: green at ${SHA:0:10}"
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
  green="$(cat "${POST_LAND_LOCK}.green" 2>/dev/null)"
  if [ -n "$green" ] && git merge-base --is-ancestor "$green" "$SHA" 2>/dev/null; then range="$green..$SHA"; else range="-n 20 $SHA"; fi
  # The failing spec names, in full: an F that keeps only the log tail lost them (F7-F9 cost a
  # 38 min full run to find them again). vitest prints " FAIL  <file>", Playwright "✘ … <file>".
  failing="$(grep -E '(^|[[:space:]])(FAIL|✘|×)[[:space:]]|[^ ]+\.(test|spec)\.[tj]sx? *(›|>|failed)' "$OUT" | sed 's/^/  /' | head -n 200)"
  # One F per fault, not one per pushed commit: a red while an F is open is appended to that F.
  open="$(grep -l '^status: open' "$FIX"/tasks/fixes/F*.yml 2>/dev/null | head -n 1)"
  if [ -n "$open" ]; then
    n="$(basename "$open" .yml)"; n="${n#F}"
    {
      printf 'also_red:\n  - sha: %s\n    failing: |\n' "$SHA"
      printf '%s\n' "$failing" | sed 's/^/    /'
    } >> "$open"
    subject="F$n: still red at ${SHA:0:10}"
  else
    last="$(ls "$FIX/tasks/fixes" 2>/dev/null | sed -n 's/^F\([0-9][0-9]*\)\.yml$/\1/p' | sort -n | tail -n 1)"
    n=$(( ${last:-0} + 1 ))
    # The owner is the author of the first commit since the last green: an F with no owner sat for 11 h.
    owner="$(git log --reverse --format=%an $range | head -n 1)"
    {
      printf 'id: F%s\nowner: %s\nstatus: open\nsha: %s\n' "$n" "${owner:-post-land}" "$SHA"
      printf 'goal: main is red at %s; make the full suite pass again\n' "${SHA:0:10}"
      printf 'commits: |\n'
      git log --abbrev=10 --format='  %h %s' $range
      printf 'failing: |\n%s\n' "$failing"
      printf 'output: |\n'
      tail -n 40 "$OUT" | sed 's/^/  /'
    } > "$FIX/tasks/fixes/F$n.yml"
    subject="F$n: the full suite is red at ${SHA:0:10}"
  fi
  git -C "$FIX" add "tasks/fixes/F$n.yml"
  git -C "$FIX" commit -q -m "$subject" || exit 2
  if git -C "$FIX" push -q origin HEAD:main; then
    echo "post-land: RED at ${SHA:0:10}; opened tasks/fixes/F$n.yml on main" >&2
    exit 1
  fi
done
echo "post-land: RED at ${SHA:0:10} but could not push the fixes task" >&2
exit 1
