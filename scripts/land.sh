#!/usr/bin/env bash
# The only path to main: land one task's branch.
#
#   bash scripts/land.sh <task-id>      run from the worker's own clone of the repo
#   bash scripts/land.sh --self-check   every locked sha256 in tasks/*.yml matches its file
#
#   exit 0  landed: origin/main is this branch rebased onto origin/main, pushed
#   exit 1  refused by a gate; main untouched; the message names the gate
#   exit 2  cannot start (no task file, no land.conf, no fetch)
#   exit 3  blocked: the rebase conflicts; it is aborted, tasks/<id>.yml says status: blocked and why,
#           and the worktree is committed and clean
#
# Steps, in order, all under one flock (LAND_LOCK) so landings run one at a time:
#   1. commit everything in the worktree (nothing is ever discarded)
#   2. fetch, rebase onto origin/main
#   2b. the branch is squashed into one commit "<id>: <goal>" (body: release note), status done and
#      `landed` of earlier done tasks written into it; commits of other tasks refuse (mixed)
#   3. the task's contract is intact: locked files match their hash, done_test and locked entries
#      are what origin/main has
#   4. no open tasks/fixes/*.yml, unless this task is labelled `fixes`
#   5. lint (the changed files as arguments), typecheck, unit (the changed files as arguments; every
#      unit test the change reaches, within UNIT_DEADLINE_S), done_test (never a browser spec),
#      attribution (each new commit's message on stdin), each within GATE_DEADLINE_S
#   6. push to origin main, then start the post-land full run on the pushed commit, detached
#      (scripts/land/post-land/run.sh; only when land.conf sets FULL_SUITE_CMD). The suite itself runs on
#      GitHub Actions; post-land waits for it (scripts/land/post-land/actions.sh)
#
# land.conf (next to this file, else at the repo root) sets LINT_CMD, optionally LINT_REQUIRES (paths
# that must exist before lint runs), TYPECHECK_CMD, ATTRIBUTION_CMD, GATE_DEADLINE_S, LAND_LOCK.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT" || exit 2
# This file is vendored byte for byte into winisd_tools (tools/land/land.sh), so it finds its parts
# by where it sits: the core next to it (tools/land/core) or under land/ (scripts/land/core), and
# land.conf next to it (tools/land/land.conf) or at the repo root.
if [ -d "$HERE/core" ]; then CORE="$HERE/core"; else CORE="$HERE/land/core"; fi
if [ -f "$HERE/land.conf" ]; then CONF="$HERE/land.conf"; else CONF="$ROOT/land.conf"; fi
[ -f "$CONF" ] || { echo "land: no land.conf next to land.sh or in $ROOT" >&2; exit 2; }

# shellcheck source=/dev/null
. "$HERE/paths.sh"
# shellcheck source=/dev/null
. "$CONF"
# shellcheck source=./land/core/task.sh
. "$CORE/task.sh"
# shellcheck source=./land/core/gate.sh
. "$CORE/gate.sh"

# --self-check: every locked sha256 in tasks/*.yml matches its file (T000's done_test); nothing lands.
if [ "${1:-}" = "--self-check" ]; then
  task_self_check tasks
  exit $?
fi

ID="${1:?usage: land.sh <task-id> | land.sh --self-check}"
TASK="tasks/$ID.yml"
[ -f "$TASK" ] || { echo "land: no task file $TASK" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/land.XXXXXX")"
GATE_OUT="$WORK/gate.out"
cleanup() {
  local status=$?
  gate_stop
  rm -rf "$WORK"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# 1. commit everything
if [ -n "$(git status --porcelain)" ]; then
  # The subject says what landed: the task's goal (the id alone when the task file has none).
  goal="$(task_field "$TASK" goal)"
  git add -A && git commit -q -m "$ID${goal:+: $goal}" || { echo "land: commit failed" >&2; exit 2; }
fi

# One landing at a time. The lock is released when this process ends, however it ends.
exec 9> "$LAND_LOCK"
flock -n 9 || { echo "land: waiting for another landing"; flock 9; }

# 2. rebase onto origin/main
git fetch -q origin main || { echo "land: fetch failed" >&2; exit 2; }
# A branch already on top of origin/main needs no rebase: replaying its history (merges included)
# conflicted on old commits and blocked a branch that was a plain fast-forward (T046, 11 Oct).
if git merge-base --is-ancestor origin/main HEAD; then :
elif ! git rebase -q origin/main > "$WORK/rebase.out" 2>&1; then
  conflicts="$(git diff --name-only --diff-filter=U | tr '\n' ' ')"
  git rebase --abort
  task_mark_blocked "$TASK" "rebase onto origin/main conflicts in: ${conflicts:-unknown files}"
  git add "$TASK" && git commit -q -m "$ID: blocked, rebase onto origin/main conflicts"
  echo "land: BLOCKED $ID: rebase conflicts in ${conflicts:-unknown files}" >&2
  exit 3
fi

# 2b. a task lands as one commit. Any other task whose "<id>:" commit is on main and that lacks
# `landed` gets status done and the sha here, whatever its status said (T099: claims that outlived
# their landing, T053 and F11-fix, blocked other claims for a day); every commit of this branch must
# be this task's own; then the branch is squashed into "<id>: <goal>" with status done and the
# release note as the body (T064). Never a tasks/fixes/F*.yml: its "F<n>: the full suite is red"
# commit is on main from the moment it opens, so this loop closed F15 to F19 at the next landing
# with nothing fixed (T117); a fix task is closed only by the `fixes`-labelled task that fixes it.
edited=0
for tf in tasks/*.yml; do
  [ -f "$tf" ] && [ "$tf" != "$TASK" ] || continue
  [ -z "$(task_field "$tf" landed)" ] || continue
  case "$(task_field "$tf" status)" in open|claimed|todo|done) ;; *) continue ;; esac
  tid="$(task_field "$tf" id)"
  [ -n "$tid" ] || continue
  lsha="$(git log origin/main --format='%H %s' | awk -v p="$tid:" 'index($2, p) == 1 { print $1; exit }')"
  [ -n "$lsha" ] || continue
  task_mark_done "$tf"
  task_mark_landed "$tf" "$lsha"
  edited=1
done
others="$(git log --format=%s origin/main..HEAD | grep -E '^[TF][0-9]+(-fix)?([: ]|$)' | grep -vE "^$ID([: ]|\$)")"
[ -z "$others" ] || { GATE_OUT=/dev/null; refuse mixed "the branch carries commits of other tasks, land them on their own branches: $(printf '%s' "$others" | tr '\n' '|')"; }
if [ "$(task_field "$TASK" status)" != done ]; then
  case "$(task_field "$TASK" status)" in open|claimed|todo) task_mark_done "$TASK"; edited=1 ;; esac
fi
# The squash discards the branch's own messages, so the attribution gate reads them first.
for sha in $(git rev-list origin/main..HEAD); do
  git log -1 --format=%B "$sha" > "$WORK/message"
  run_gate attribution "$WORK/message" "$ATTRIBUTION_CMD"
done
if [ -n "$(git rev-list origin/main..HEAD)" ] || [ "$edited" = 1 ]; then
  task_commit_message "$ID" "$(task_field "$TASK" goal)" "$(task_field "$TASK" release_note)" > "$WORK/squash.msg"
  git reset -q --soft origin/main && git add -A && git commit -q -F "$WORK/squash.msg" \
    || { echo "land: squash commit failed" >&2; exit 2; }
fi

# 3. the task's contract is intact
while read -r path hash; do
  [ -n "$path" ] || continue
  actual="$(git show "HEAD:$path" 2>/dev/null | sha256sum | cut -d' ' -f1)"
  [ "$actual" = "$hash" ] || refuse locked "$path changed (locked by $TASK)"
done < <(task_locked "$TASK")
if git cat-file -e "origin/main:$TASK" 2>/dev/null; then
  git show "origin/main:$TASK" > "$WORK/task.origin"
  [ "$(task_contract "$WORK/task.origin")" = "$(task_contract "$TASK")" ] \
    || refuse done_test "$TASK changed its done_test or locked entries since origin/main"
fi

# 4. no open fixes task
if [ "$(task_field "$TASK" label)" != "fixes" ]; then
  open_fixes="$(grep -l '^status: open' tasks/fixes/*.yml 2>/dev/null | tr '\n' ' ')"
  [ -z "$open_fixes" ] || refuse fixes "open fixes task: $open_fixes; land a task labelled fixes first"
fi

# 5. the gates
for required in ${LINT_REQUIRES:-}; do
  [ -e "$required" ] || { GATE_OUT=/dev/null; refuse lint "$required is missing in $ROOT, so lint would run with whatever tool the path finds. Create worktrees with _agent_files/bin/new-worktree.sh, which links it in."; }
done
mapfile -t changed < <(git diff --name-only --diff-filter=ACMR origin/main HEAD)
GATE_DEADLINE_S="${LINT_DEADLINE_S:-$GATE_DEADLINE_S}" run_gate lint /dev/null "$LINT_CMD" "${changed[@]}"
GATE_DEADLINE_S="${TYPECHECK_DEADLINE_S:-$GATE_DEADLINE_S}" run_gate typecheck /dev/null "$TYPECHECK_CMD"
# The unit half of every test the change can reach runs HERE, before the push (SDLC S1): a unit
# failure found post-land costs every landing until it is fixed. Its own deadline: a unit run is
# longer than lint.
[ -n "${UNIT_CMD:-}" ] || { GATE_OUT=/dev/null; refuse unit "UNIT_CMD is not set in land.conf; the unit tests of the change must run before a push"; }
GATE_DEADLINE_S="${UNIT_DEADLINE_S:-$GATE_DEADLINE_S}" run_gate unit /dev/null "$UNIT_CMD" "${changed[@]}"
# A browser spec takes minutes under load and overran the gate deadline (T036, 11 Oct 2026): the
# browser half runs post-land, never as a task's done_test.
done_test="$(task_field "$TASK" done_test)"
case "$done_test" in
  *.browser.spec.ts*) GATE_OUT=/dev/null; refuse done_test "names a browser spec ($done_test); browser specs run post-land, name a unit spec" ;;
esac
run_gate done_test /dev/null "$done_test"
# Visual baselines: the task changes exactly the screens it lists under `visual:` (scripts/visual/).
if [ -f scripts/visual/check-task.sh ]; then
  run_gate visual /dev/null "bash scripts/visual/check-task.sh" "$TASK" origin/main HEAD
fi
# Visual baselines: a task that changes UI sources has re-taken the baselines on exactly those sources.
if [ -f scripts/visual/check-sources.sh ]; then
  run_gate visual-sources /dev/null "bash scripts/visual/check-sources.sh" origin/main HEAD
fi
for sha in $(git rev-list origin/main..HEAD); do
  git log -1 --format=%B "$sha" > "$WORK/message"
  run_gate attribution "$WORK/message" "$ATTRIBUTION_CMD"
done

# 5b. health: main red for too long blocks everything but a fix. Missing state files mean unknown.
GATE_OUT=/dev/null
now_s="$(date +%s)"
age_min() { echo $(( (now_s - $(stat -c %Y "$1")) / 60 )); }
green_sha="$(cat "${POST_LAND_LOCK}.green" 2>/dev/null)"
tested_sha="$(cat "${POST_LAND_LOCK}.tested" 2>/dev/null)"
green_age=""; [ -f "${POST_LAND_LOCK}.green" ] && green_age="$(age_min "${POST_LAND_LOCK}.green")"
run_state=none
[ -f "${POST_LAND_LOCK}.running" ] && run_state="running $(age_min "${POST_LAND_LOCK}.running")m"
load="$(cut -d' ' -f1 /proc/loadavg 2>/dev/null)"
if [ -n "$green_sha" ] && [ -n "$tested_sha" ]; then
  echo "land: health: green ${green_sha:0:10} ${green_age}m ago, tested ${tested_sha:0:10}, run ${run_state}, load ${load:-?}"
else
  echo "land: health: unknown (green ${green_sha:0:10}, tested ${tested_sha:0:10}), run ${run_state}, load ${load:-?}"
fi
if [ -n "$green_sha" ] && [ -n "$tested_sha" ] && [ "$tested_sha" != "$green_sha" ] \
   && [ "$green_age" -gt "${HEALTH_RED_MAX_MIN:-120}" ] && [ "$(task_field "$TASK" label)" != "fixes" ]; then
  refuse red-main "main has been red for $green_age min (last green ${green_sha:0:10}); land a task labelled fixes first"
fi

# 6. push
before_push="$(git rev-parse origin/main)"
git push -q origin HEAD:main > "$WORK/push.out" 2>&1 || { GATE_OUT="$WORK/push.out"; refuse push "origin rejected the push"; }
pushed="$(git rev-parse HEAD)"
echo "land: landed $ID at ${pushed:0:10}"
# A landing that changed screens leaves a before/after page for John to approve.
if [ -f scripts/visual/publish-changes.sh ]; then
  bash scripts/visual/publish-changes.sh "$ID" "$before_push" "$pushed" 2>&1 | sed 's/^/land: /' || true
fi

# 7. the full run on the pushed commit, in its own session so this landing does not wait for it
if [ -n "${FULL_SUITE_CMD:-}" ] && [ -f "$HERE/land/post-land/run.sh" ]; then
  mkdir -p "$POST_LAND_DIR"
  setsid bash "$HERE/land/post-land/run.sh" "$pushed" >> "$POST_LAND_DIR/post-land.log" 2>&1 9>&- < /dev/null &
fi
