#!/usr/bin/env bash
# The full run on a landed commit: bash scripts/land/post-land/run.sh <sha>
#
# Started detached by land.sh after a push. It
#   1. takes POST_LAND_LOCK (flock): post-land runs go one at a time, and the lock is released when
#      this process ends, however it ends;
#   2. checks <sha> out as a clean copy under POST_LAND_DIR, outside every clone;
#   3. runs FULL_SUITE_CMD in the copy once. There is no rerun: a flake is a red;
#   4. removes the copy;
#   5. green: records <sha> as the last green in ${POST_LAND_RECORD}.green (written atomically) and
#      prints "post-land: green at <sha>"; red: pushes tasks/fixes/F<n>.yml (status: open, sha, owner =
#      author of the first commit since the last green, the failing spec lines, the output's last lines)
#      to main, exit 1. The next landing is refused while that task is open. A red while an F is already
#      open is appended to that F (one F per fault), never a new F.
# Runs coalesce: a run registers in ${POST_LAND_LOCK}.pending before it waits for the lock. When it gets its
# turn and a NEWER run is already waiting (its record is flock'ed by a live process), it ends "superseded
# by <sha>" with exit 0 without running the suite; the newest run tests the latest sha. A run that finds an
# OLDER commit's suite running WAITS for it: a running suite is never killed (John, 2026-10-16). When its turn
# comes it waits until origin/main has had POST_LAND_QUIET_S (60 s) without a new commit; if main moved on it ends
# "superseded by <tip>" (the run that landed the tip tests it), else it tests its own commit. A run whose sha is an ancestor of the last tested sha
# (${POST_LAND_RECORD}.tested) ends "superseded by <sha> (already tested)", exit 0. A red lists every commit since the last green in its F, with the tested sha, the last green and the range.
# A TERM with no newer run behind it (no ${POST_LAND_LOCK}.supersede, no live record in .pending) is a red
# that says "post-land: killed by signal at <sha>": the sha is recorded as tested and the F
# is opened as for any red. The watchdog starts a run when main holds an untested commit and none is alive.
# A run past POST_LAND_DEADLINE_S (default 5400) has its whole process group killed and is a red whose
# output says "post-land: TIMED OUT after <n>s at <sha>". While a run is in flight
# ${POST_LAND_LOCK}.running holds "<pid> <start epoch> <sha>".
# Config in land.conf: FULL_SUITE_CMD, POST_LAND_LOCK, POST_LAND_DIR, POST_LAND_DEADLINE_S.
# A release is the GitHub Pages deploy on every push to main; post-land is the local full run.
set -uo pipefail

SHA_ARG="${1:?usage: run.sh <sha>}"
# ROOT is the main checkout (the owner of .git), never the lander's worktree: land.sh starts this run
# from a task worktree, and the watchdog removes merged worktrees while a run is still going (T060,
# 12 Oct: the run lost its cwd and reported a bogus red). Everything below works from ROOT.
ROOT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" || exit 2
cd "$ROOT" || exit 2
# The scripts and settings are origin/main's own, never the main checkout's files: that checkout can lag
# main (17 Oct: 12 commits behind, held by another session's uncommitted files, so post-land ran the
# laptop suite after T266 had moved the gate to GitHub Actions). This run re-starts itself from a
# snapshot of origin/main's scripts/ and land.conf (TOOLS); ROOT is used only for git.
if [ -z "${POST_LAND_TOOLS:-}" ]; then
  git fetch -q origin main 2> /dev/null || echo "post-land: cannot fetch origin/main; using the local origin/main" >&2
  tools="$(mktemp -d "${TMPDIR:-/tmp}/post-land-tools.XXXXXX")" || exit 2
  git archive origin/main scripts land.conf | tar -x -C "$tools" || { rm -rf "$tools"; echo "post-land: cannot read origin/main's scripts" >&2; exit 2; }
  exec env POST_LAND_TOOLS="$tools" bash "$tools/scripts/land/post-land/run.sh" "$@"
fi
TOOLS="$POST_LAND_TOOLS"
[ -f "$TOOLS/land.conf" ] || { echo "post-land: no land.conf on origin/main" >&2; exit 2; }
# paths.sh sets POST_LAND_LOCK (and the runtime dir); land.conf does not, and this script is started
# detached, so nothing is inherited. 12 Oct: every post-land run died here with POST_LAND_LOCK unbound.
# shellcheck source=/dev/null
. "$TOOLS/scripts/paths.sh"
# shellcheck source=/dev/null
. "$TOOLS/land.conf"
. "$TOOLS/scripts/lib/ts-log.sh"
TS_WRAP=(bash "$TOOLS/scripts/lib/ts-log.sh")
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"
DEADLINE_S="${POST_LAND_DEADLINE_S:-5400}"
RUNNING="${POST_LAND_LOCK}.running"
SHA="$(git rev-parse --verify "$SHA_ARG^{commit}")" || exit 2
run_start "post-land-${SHA:0:10}"

mkdir -p "$POST_LAND_DIR"
COPY="$POST_LAND_DIR/$$-${SHA:0:10}"
OUT="$(mktemp "${TMPDIR:-/tmp}/post-land-out.XXXXXX")"
BODY=""
FIX=""

# The suite runs as one background job in its own process group; stopping this run stops it all. A
# browser run leaves that group (test-browser.sh's setsid), so it is stopped by its record, whose owner
# is this run (scripts/browser-runs.sh).
# shellcheck source=../../browser-runs.sh
. "$TOOLS/scripts/browser-runs.sh"
export OPENISD_BROWSER_OWNER="$$ $(admit_starttime $$)"
stop_suite() {
  [ -n "$BODY" ] || return 0
  local body="$BODY"
  BODY=""
  kill -TERM -- "-$body" 2>/dev/null || true
  wait "$body" 2>/dev/null || true
  kill -KILL -- "-$body" 2>/dev/null || true
  browser_runs_stop_owned_by "$$"
}
# Red: open a fixes task on top of the tested commit (or append to the open one), then exit 1.
# Reads OUT, SHA, FIX and the last green; called when the suite ended non-zero and when a signal
# killed the run with no newer run behind it.
record_red() {
  # The push can lose a race with a landing, so recompute and retry.
  FIX="$(mktemp -d "${TMPDIR:-/tmp}/post-land-fix.XXXXXX")"
  # The whole output is kept: the F carries only the failing lines and the last 40, and the suite's
  # temporary output file is removed when the run ends.
  KEEP="${POST_LAND_KEEP_DIR:-$ROOT/build/test-logs}/post-land-red-${SHA:0:10}.log"
  mkdir -p "$(dirname "$KEEP")" && cp "$OUT" "$KEEP" || KEEP="(not kept: cannot write $KEEP)"
  local pushed=""
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
    green="$(cat "${POST_LAND_RECORD}.green" 2>/dev/null)"
    if [ -n "$green" ] && git merge-base --is-ancestor "$green" "$SHA" 2>/dev/null; then range="$green..$SHA"; else range="-n 20 $SHA"; fi
    # The failing spec names, in full: an F that keeps only the log tail lost them (F7-F9 cost a
    # 38 min full run to find them again). vitest prints " FAIL  <file>", Playwright "✘ … <file>".
    # vitest echoes a test's console output as "stderr | <file> > <name>": not a failure (F11 listed six).
    # Colour codes (as ESC bytes, and as GitHub's failed-job log prints them, "^[[41m", F53) and the per-test "TEST START/TEST END" markers (T254's logger; Playwright's list
    # reporter can run one onto the end of a ✘ line) are removed first: they named every spec (F52).
    failing="$(sed -E 's/^[0-9T:.-]+Z [^ ]+ //; s/\x1b\[[0-9;]*m//g; s/\^\[\[[0-9;]*m//g; s/TEST (START|END) .*$//' "$OUT" | grep -Ev '^[[:space:]]*(stderr|stdout) \|' | grep -E '(^|[[:space:]])(FAIL|✘|×)[[:space:]]|[^ ]+\.(test|spec)\.[tj]sx? *(›|>|failed)' | sed 's/^/  /' | head -n 200)"
    # Screens whose picture differs from its baseline: named, with a before/after page (scripts/visual/).
    visual=""
    [ ! -f "$TOOLS/scripts/visual/failures-page.sh" ] || visual="$(bash "$TOOLS/scripts/visual/failures-page.sh" "$COPY" "$SHA" 2> /dev/null || true)"
    # One F per fault, not one per pushed commit: a red while an F is open is appended to that F.
    open="$(grep -l '^status: open' "$FIX"/tasks/fixes/F*.yml 2>/dev/null | head -n 1)"
    if [ -n "$open" ]; then
      n="$(basename "$open" .yml)"; n="${n#F}"
      {
        printf 'also_red:\n  - sha: %s\n    tested: %s\n    last_green: %s\n    range: %s\n    full_output: %s\n    failing: |\n' "$SHA" "$SHA" "${green:-none}" "$range" "$KEEP"
        printf '%s\n' "$failing" | sed 's/^/    /'
        [ -z "$visual" ] || { printf '    visual: |\n'; printf '%s\n' "$visual" | sed 's/^/      /'; }
      } >> "$open"
      subject="(auto) F$n: still red at ${SHA:0:10}"
    else
      last="$(ls "$FIX/tasks/fixes" 2>/dev/null | sed -n 's/^F\([0-9][0-9]*\)\.yml$/\1/p' | sort -n | tail -n 1)"
      n=$(( ${last:-0} + 1 ))
      # The owner is the author of the first commit since the last green: an F with no owner sat for 11 h.
      owner="$(git log --reverse --format=%an $range | head -n 1)"
      {
        printf 'id: F%s\nowner: %s\nstatus: open\nsha: %s\n' "$n" "${owner:-post-land}" "$SHA"
        printf 'tested: %s\nlast_green: %s\nrange: %s\nfull_output: %s\n' "$SHA" "${green:-none}" "$range" "$KEEP"
        printf 'goal: main is red at %s; make the full suite pass again\n' "${SHA:0:10}"
        printf 'commits: |\n'
        git log --abbrev=10 --format='  %h %s' $range
        printf 'failing: |\n%s\n' "$failing"
        [ -z "$visual" ] || { printf 'visual: |\n'; printf '%s\n' "$visual" | sed 's/^/  /'; }
        printf 'output: |\n'
        tail -n 40 "$OUT" | sed 's/^/  /'
      } > "$FIX/tasks/fixes/F$n.yml"
      subject="(auto) F$n: the full suite is red at ${SHA:0:10}"
    fi
    git -C "$FIX" add "tasks/fixes/F$n.yml"
    git -C "$FIX" commit -q -m "$subject" || exit 2
    # A landing can push between the fetch and this push; the next attempt starts again from the fetch.
    if pushed="$(git -C "$FIX" push -q origin HEAD:main 2>&1)"; then
      echo "post-land: RED at ${SHA:0:10}; opened tasks/fixes/F$n.yml on main (full output: $KEEP)" >&2
      exit 1
    fi
    echo "post-land: push of the fixes task lost a race with another push (attempt $attempt of 3); retrying" >&2
  done
  printf '%s\n' "$pushed" >&2
  echo "post-land: RED at ${SHA:0:10} but could not push the fixes task (full output: $KEEP)" >&2
  exit 1
}
# Green: close every open F whose red commits are all in the tested commit's history (17 Oct: an F
# closed only by hand kept every landing blocked for hours after main was green). An F with no sha (an
# infra F) is left alone. The close is pushed like a red's F, with the same race retry; a failed push
# does not turn the green red.
close_fixed() {
  local attempt base f n s shas fixed closed pushed=""
  FIX="$(mktemp -d "${TMPDIR:-/tmp}/post-land-fix.XXXXXX")"
  for attempt in 1 2 3; do
    git fetch -q origin main
    if git merge-base --is-ancestor "$SHA" origin/main; then base=origin/main
    elif git merge-base --is-ancestor origin/main "$SHA"; then base="$SHA"
    else echo "post-land: green at ${SHA:0:10} but origin/main has diverged from it; no F closed"; return 0
    fi
    git -C "$ROOT" worktree remove --force "$FIX" 2>/dev/null; rm -rf "$FIX"
    git worktree add -q --detach "$FIX" "$base" || return 0
    closed=""
    for f in "$FIX"/tasks/fixes/F*.yml; do
      [ -f "$f" ] && grep -qx 'status: open' "$f" || continue
      shas="$(sed -n -E 's/^(  - )?sha: *([0-9a-f]{7,40}) *$/\2/p' "$f")"
      [ -n "$shas" ] || continue
      fixed=1
      for s in $shas; do git merge-base --is-ancestor "$s" "$SHA" 2>/dev/null || { fixed=0; break; }; done
      [ "$fixed" = 1 ] || continue
      n="$(basename "$f" .yml)"
      sed -i 's/^status: open$/status: done/' "$f"
      printf 'closed_note: |\n  Closed by post-land: the full suite is green at %s, which holds every red commit listed here.\n' "$SHA" >> "$f"
      git -C "$FIX" add "tasks/fixes/$n.yml"
      closed="$closed $n"
    done
    [ -n "$closed" ] || return 0
    git -C "$FIX" commit -q -m "(auto) ${closed# }: closed, the full suite is green at ${SHA:0:10}" || return 0
    if pushed="$(git -C "$FIX" push -q origin HEAD:main 2>&1)"; then
      echo "post-land: closed${closed} on main (green at ${SHA:0:10})"
      return 0
    fi
    echo "post-land: push of the F close lost a race with another push (attempt $attempt of 3); retrying"
  done
  printf '%s\n' "$pushed"
  echo "post-land: green at ${SHA:0:10} but could not push the close of${closed}"
}
HOLDER="${POST_LAND_LOCK}.holder"
# A TERM that reaches the suite is never another run's doing (nothing kills a running suite any more, John
# 2026-10-16): it is the kernel's OOM kill of the browser scope (16 Oct), a person, or the machine. It is a
# red, reported as what it was.
# True while the suite is still waiting for the browser lock (scripts/suite-lock.sh records it): a run
# ended then has tested nothing.
suite_waiting_for_lock() {
  local pid start
  read -r pid start < "${SUITE_RUN_LOCK}.waiting" 2>/dev/null || return 1
  [ -n "${pid:-}" ] && [ "$(starttime "$pid")" = "${start:-}" ]
}
killed() {
  local waiting=1
  suite_waiting_for_lock && waiting=0
  stop_suite
  if [ "$waiting" = 0 ]; then
    rm -f "${SUITE_RUN_LOCK}.waiting"
    echo "post-land: killed while waiting for the browser lock at ${SHA:0:10}; nothing was tested, no result"
    exit 0
  fi
  echo "post-land: killed by signal at ${SHA:0:10}" | tee -a "$OUT"
  rm -f "$RUNNING"
  printf '%s\n' "$SHA" > "${POST_LAND_RECORD}.tested.$$" && mv -f "${POST_LAND_RECORD}.tested.$$" "${POST_LAND_RECORD}.tested"
  record_red
}
cleanup() {
  local status=$?
  run_end "post-land-${SHA:0:10}" "$status" 2>/dev/null || true
  stop_suite
  [ "$(cut -d' ' -f1 "$HOLDER" 2>/dev/null)" = "$$" ] && rm -f "$HOLDER"
  [ "$(cut -d' ' -f1 "$RUNNING" 2>/dev/null)" = "$$" ] && rm -f "$RUNNING"
  git -C "$ROOT" worktree remove --force "$COPY" 2>/dev/null || rm -rf "$COPY"
  [ -z "$FIX" ] || { git -C "$ROOT" worktree remove --force "$FIX" 2>/dev/null; rm -rf "$FIX"; }
  git -C "$ROOT" worktree prune
  rm -f "$OUT" "${MINE:-}"
  rm -rf "$TOOLS"
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
# A run already testing an older commit is never killed (John, 2026-10-16: 112 of 237 suite runs since 8 Oct
# were killed part-way by a newer run, and the commit they were testing got no result). This run waits for
# the lock behind it; when its turn comes the newest commit is the one tested.
starttime() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }
exec 9> "$POST_LAND_LOCK"
flock -n 9 || { echo "post-land: waiting for another post-land run"; flock 9; }
trap killed TERM

# Quiet period (John, 2026-10-16): the suite starts only once origin/main has had no new commit for
# POST_LAND_QUIET_S (default 60 s), so a burst of landings is tested once, on its last commit. The checks below
# then run on what the wait saw: a newer run that registered meanwhile makes this one superseded.
QUIET_S="${POST_LAND_QUIET_S:-60}"
tip=""
while :; do
  git fetch -q origin main 2>/dev/null || break
  tip="$(git rev-parse origin/main)"
  age=$(( $(date +%s) - $(git log -1 --format=%ct "$tip") ))
  [ "$age" -ge "$QUIET_S" ] && break
  echo "post-land: main is $age s old at ${tip:0:10}; waiting $((QUIET_S - age)) s of quiet before testing"
  sleep $((QUIET_S - age))
done
# A later commit has already been tested (${POST_LAND_RECORD}.tested): this run's result is stale.
tested="$(cat "${POST_LAND_RECORD}.tested" 2>/dev/null)"
if [ -n "$tested" ] && [ "$tested" != "$SHA" ] && git merge-base --is-ancestor "$SHA" "$tested" 2>/dev/null; then
  echo "post-land: superseded by ${tested:0:10} (already tested)"; exit 0
fi
# A newer run that is still waiting (live owner) will test a later sha: this one is superseded.
for rec in "$PENDING"/*; do
  [ -e "$rec" ] && [ "$rec" != "$MINE" ] || continue
  # "Newer" means a descendant commit, not a later arrival: two runs started together arrive in any order.
  rsha="$(basename "$rec")"; rsha="${rsha#*-}"
  [ "$rsha" != "$SHA" ] && git merge-base --is-ancestor "$SHA" "$rsha" 2>/dev/null || continue
  if ! ( flock -n 7 ) 7< "$rec" 2> /dev/null; then
    echo "post-land: superseded by $rsha"; exit 0
  fi
done

git worktree add -q --detach "$COPY" "$SHA" || { echo "post-land: cannot check out $SHA" >&2; exit 2; }
printf '%s %s %s\n' "$$" "$(starttime $$)" "$SHA" > "$HOLDER"
echo "post-land: running the full suite on ${SHA:0:10}"
# Where the next red can be read: whether either slice was throttled (high) or hit its ceiling (max)
# inside this run's window. The counters are cumulative since boot; the difference is the window.
# shellcheck source=../../slice-events.sh
. "$TOOLS/scripts/slice-events.sh"
high_before=$(slice_event_count heavy.slice high)
echo "post-land: start $(slice_events_line heavy.slice)"
printf '%s %s %s\n' "$$" "$(date +%s)" "$SHA" > "$RUNNING"
set -m
# The suite command is the tested commit's own: the main checkout's land.conf can lag main (17 Oct: it
# sat 12 commits behind, held by another session's uncommitted files, and post-land ran the laptop
# suite after T266 had switched the gate to GitHub Actions).
suite_cmd="$(cd "$COPY" && [ -f land.conf ] && . ./land.conf && printf '%s' "${FULL_SUITE_CMD:-}")"
FULL_SUITE_CMD="${suite_cmd:-$FULL_SUITE_CMD}"
echo "post-land: suite command (from ${SHA:0:10}): $FULL_SUITE_CMD"
# ts-log.sh timestamps every line and exits with the suite's own status; it leads the group.
( cd "$COPY" && export POST_LAND_SRC="$ROOT" && exec "${TS_WRAP[@]}" bash -c "$FULL_SUITE_CMD" ) > "$OUT" 2>&1 &
BODY=$!
set +m
# Poll rather than wait: past the deadline the suite's whole process group (its pgid is its pid under
# set -m) is killed by group, never by name.
started=$SECONDS; timed_out=0
while kill -0 "$BODY" 2>/dev/null; do
  if [ $((SECONDS - started)) -ge "$DEADLINE_S" ]; then
    timed_out=1
    kill -TERM -- "-$BODY" 2>/dev/null || true
    sleep 1
    kill -KILL -- "-$BODY" 2>/dev/null || true
    break
  fi
  sleep 1
done
wait "$BODY" 2>/dev/null
rc=$?
BODY=""
if [ "$timed_out" = 1 ]; then
  rc=124
  echo "post-land: TIMED OUT after $((SECONDS - started))s at $SHA" | tee -a "$OUT"
fi
rm -f "$RUNNING"
echo "post-land: end $(slice_events_line heavy.slice)"
if [ "$(slice_event_count heavy.slice high)" != "$high_before" ]; then
  echo "post-land: suite throttled: sizing bug (heavy.slice went over MemoryHigh during this run; re-measure scripts/budget.conf)"
fi
trap 'exit 143' TERM
printf '%s\n' "$SHA" > "${POST_LAND_RECORD}.tested.$$" && mv -f "${POST_LAND_RECORD}.tested.$$" "${POST_LAND_RECORD}.tested"

if [ "$rc" = 0 ]; then
  printf '%s\n' "$SHA" > "${POST_LAND_RECORD}.green.$$" && mv -f "${POST_LAND_RECORD}.green.$$" "${POST_LAND_RECORD}.green"
  echo "post-land: green at ${SHA:0:10}"
  close_fixed
  exit 0
fi

record_red
