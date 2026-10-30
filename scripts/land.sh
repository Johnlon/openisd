#!/usr/bin/env bash
# The only path to main: land one task's branch.
#
#   bash scripts/land.sh <task-id>      run from the worker's own clone of the repo
#   bash scripts/land.sh --self-check   every locked sha256 in tasks/*.yml matches its file
#
#   exit 0  landed: origin/main is this branch rebased onto origin/main, pushed
#   exit 1  refused by a gate; main untouched; the message names the gate
#   exit 2  cannot start (no task file, no land.conf, no fetch)
#   exit 4  landed, but the main folder could not update to it (scripts/land/sync-main-folder.sh says why):
#           the landing agent fixes that before anything else
#   exit 3  blocked: the rebase conflicts; it is aborted, tasks/<id>.yml says status: blocked and why,
#           and the worktree is committed and clean
#
# Steps, in order, all under one flock (LAND_LOCK) so landings run one at a time:
#   1. commit everything in the worktree (nothing is ever discarded)
#   2. fetch, rebase onto origin/main
#   2a. a tasks/<id>.yml on main under another owner refuses (task-id): the id is another task's
#   2b. the branch is squashed into one commit "<id>: <goal>" (body: release note), status done and
#      `landed` of earlier done tasks written into it; commits of other tasks refuse (mixed)
#   3. the task's contract is intact: locked files match their hash, done_test and locked entries
#      are what origin/main has
#   4. no open tasks/fixes/*.yml, unless this task is labelled `fixes`
#   5. lint (the changed files as arguments), typecheck, unit (the changed files as arguments; every
#      unit test the change reaches, within UNIT_DEADLINE_S), architecture (every architecture unit
#      test, whatever changed), done_test (never a browser spec),
#      attribution (each new commit's message on stdin), each within GATE_DEADLINE_S
#   5c. candidate: the rebased commit is pushed to land/<task>, a pull request is opened from it to main (when
#      land.conf sets PULL_REQUESTS; closed, saying why, if the landing is refused), and CANDIDATE_CMD waits
#      for the full suite on GitHub Actions there (within CANDIDATE_DEADLINE_S); only a green run lets main
#      move. The branch is removed, except a landed one with a pull request (housekeeping removes that).
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
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/lib/main-folder.sh"
refuse_in_main_folder land
# This file is vendored byte for byte into winisd_tools (tools/land/land.sh), so it finds its parts
# by where it sits: the core next to it (tools/land/core) or under land/ (scripts/land/core), and
# land.conf next to it (tools/land/land.conf) or at the repo root.
if [ -d "$HERE/core" ]; then CORE="$HERE/core"; else CORE="$HERE/land/core"; fi
if [ -f "$HERE/land.conf" ]; then CONF="$HERE/land.conf"; else CONF="$ROOT/land.conf"; fi
[ -f "$CONF" ] || { echo "land: no land.conf next to land.sh or in $ROOT" >&2; exit 2; }

# shellcheck source=/dev/null
. "$HERE/paths.sh"
# shellcheck source=/dev/null
. "$HERE/land/pr-title.sh"
# shellcheck source=/dev/null
. "$CONF"
# shellcheck source=./land/core/task.sh
. "$CORE/task.sh"
# shellcheck source=./land/core/gate.sh
. "$CORE/gate.sh"
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"

# --self-check: every locked sha256 in tasks/*.yml matches its file (T000's done_test); nothing lands.
if [ "${1:-}" = "--self-check" ]; then
  task_self_check tasks
  exit $?
fi

ID="${1:?usage: land.sh <task-id> | land.sh --self-check}"
run_start "land-$ID"
TASK="tasks/$ID.yml"
[ -f "$TASK" ] || { echo "land: no task file $TASK" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/land.XXXXXX")"
GATE_OUT="$WORK/gate.out"
CANDIDATE_BRANCH=""
PR_NUMBER=""
LANDED=""
REFUSED=""
# net <what> <command...>: a network call, bounded (LAND_NET_TIMEOUT_S, default 120) so a stall cannot hold LAND_LOCK
# for ever. A timeout is named, loudly, on stderr. Only network calls go through this: gates and builds are never
# bounded here (T489, load audit row 7).
NET_TIMEOUT_S="${LAND_NET_TIMEOUT_S:-120}"
net() {
  local what="$1" status; shift
  timeout -k 5 "$NET_TIMEOUT_S" "$@"; status=$?
  if [ "$status" = 124 ] || [ "$status" = 137 ]; then echo "land: $what timed out after ${NET_TIMEOUT_S}s (the network stalled); nothing landed" >&2; return 124; fi
  return "$status"
}
cleanup() {
  local status=$?
  run_end "land-$ID" "$status" 2>/dev/null || true
  gate_stop
  # A pull request of a landing that did not land is closed, saying why (T331).
  if [ -n "$PR_NUMBER" ] && [ -z "$LANDED" ]; then
    ACTIONS_REPO="${ACTIONS_REPO:-}" bash "$HERE/land/pr.sh" close "$PR_NUMBER" "Not landed: ${REFUSED:-land.sh stopped (exit $status)}." 2>&1 | sed 's/^/land: /' >&2
  fi
  # The candidate branch is only the gate's input: removed whatever the result. A landed one with a pull request
  # stays until GitHub has seen main reach it (it then shows the pull request merged); housekeeping
  # (tidy-branches.sh) removes it once it is on main.
  if [ -n "$CANDIDATE_BRANCH" ] && { [ -z "$LANDED" ] || [ -z "$PR_NUMBER" ]; }; then
    net "git push --delete $CANDIDATE_BRANCH" git push -q origin --delete "$CANDIDATE_BRANCH" > /dev/null 2>&1 || true
  fi
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
  git add -A && git commit -q -m "(auto) $ID${goal:+: $goal}" || { echo "land: commit failed" >&2; exit 2; }
fi

# One landing at a time. The lock is released when this process ends, however it ends.
exec 9> "$LAND_LOCK"
flock -n 9 || { echo "land: waiting for another landing"; flock 9; }

# 2. rebase onto origin/main
net "git fetch" git fetch -q origin main || { echo "land: fetch failed" >&2; exit 2; }
# The branch's own commits are checked here, before step 2 replaces them (T498, 20 Oct 2026: the clean-merge
# squash left the checks one new commit to read): every commit is this task's own (mixed), and each message
# passes the attribution gate, because the squash into one commit discards the messages.
others="$(git log --format=%s origin/main..HEAD | grep -E '^(\(auto\) )?[TF][0-9]+(-fix)?([: ]|$)' | grep -vE "^(\(auto\) )?$ID([: ]|\$)")"
[ -z "$others" ] || { GATE_OUT=/dev/null; refuse mixed "the branch carries commits of other tasks, land them on their own branches: $(printf '%s' "$others" | tr '\n' '|')"; }
for sha in $(git rev-list origin/main..HEAD); do
  git log -1 --format=%B "$sha" > "$WORK/message"
  run_gate attribution "$WORK/message" "$ATTRIBUTION_CMD"
done
# A branch already on top of origin/main needs no rebase: replaying its history (merges included)
# conflicted on old commits and blocked a branch that was a plain fast-forward (T046, 11 Oct).
# Baseline pictures and their sources hash are generated by scripts/visual/update.sh, so a conflict on them
# is never real (two agents were blocked by one on 17 Oct 2026, T313): the rebase takes main's side, and the
# baselines are re-taken on the rebased sources below. A conflict on any other file blocks as before.
VISUAL_SNAPSHOT_DIR="packages/ui/test/visual/visual.browser.spec.ts-snapshots"
VISUAL_SOURCES_HASH_FILE="packages/ui/test/visual/SOURCES.sha256"
[ -f scripts/visual/lib.sh ] && . scripts/visual/lib.sh
generated_only() { # generated_only <file...>: true when every file is a baseline picture or the sources hash
  local f
  [ "$#" -gt 0 ] || return 1
  for f in "$@"; do
    case "$f" in "$VISUAL_SNAPSHOT_DIR"/*|"$VISUAL_SOURCES_HASH_FILE") ;; *) return 1 ;; esac
  done
}
RETAKE_BASELINES=""
rebase_onto_main() { # rebase_onto_main: 0 rebased; 1 a conflict stopped it (the rebase is still in progress)
  local -a conflicts
  local f
  git rebase -q origin/main > "$WORK/rebase.out" 2>&1 && return 0
  while :; do
    mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
    generated_only "${conflicts[@]}" || return 1
    for f in "${conflicts[@]}"; do
      # Stage 2 is main's side while a rebase replays this branch; no stage 2 means main removed the file.
      if git cat-file -e ":2:$f" 2> /dev/null; then git checkout-index -f --stage=2 -- "$f" && git add -- "$f"
      else git rm -q -- "$f"; fi
    done
    RETAKE_BASELINES=1
    echo "land: baselines conflict with main (${conflicts[*]}); taking main's, to re-take them after the rebase"
    if git diff --cached --quiet; then
      # The commit changed nothing else: with main's pictures it is empty.
      GIT_EDITOR=true git rebase --skip >> "$WORK/rebase.out" 2>&1 && return 0
    else
      GIT_EDITOR=true git rebase --continue >> "$WORK/rebase.out" 2>&1 && return 0
    fi
  done
}
# A branch whose final tree merges cleanly with origin/main lands even when replaying its commits one by one
# would conflict on an intermediate one (a commit and its revert, T498, 20 Oct 2026). Step 2b squashes the task
# into one commit anyway, so the replayed history has no value: the branch becomes one commit on origin/main
# with the merged tree. The worktree is fully committed (step 1), so a keep-mode move of the branch touches no
# file. A merge that is not clean takes the rebase path, which still handles the baselines.
squash_onto_main() { # squash_onto_main: 0 the branch is now one commit on origin/main with the merged tree; 1 not clean, nothing moved
  local tree commit subject
  subject="(auto) $ID: $(task_field "$TASK" goal)"
  tree="$(git merge-tree --write-tree origin/main HEAD 2> /dev/null)" || return 1
  commit="$(git commit-tree "$tree" -p origin/main -m "$subject")" || return 1
  git reset -q --keep "$commit"
}
if git merge-base --is-ancestor origin/main HEAD; then :
elif squash_onto_main; then echo "land: merges cleanly with origin/main; put onto it as one commit"
elif ! rebase_onto_main; then
  conflicts="$(git diff --name-only --diff-filter=U | tr '\n' ' ')"
  git rebase --abort
  task_mark_blocked "$TASK" "rebase onto origin/main conflicts in: ${conflicts:-unknown files}"
  git add "$TASK" && git commit -q -m "(auto) $ID: blocked, rebase onto origin/main conflicts"
  echo "land: BLOCKED $ID: rebase conflicts in ${conflicts:-unknown files}" >&2
  exit 3
fi
if [ -n "$RETAKE_BASELINES" ]; then
  echo "land: re-taking the visual baselines on the rebased sources"
  run_gate visual-retake /dev/null "$VISUAL_RETAKE_CMD"
  git add -A -- "$VISUAL_SNAPSHOT_DIR" "$VISUAL_SOURCES_HASH_FILE"
  if ! git diff --cached --quiet; then
    git commit -q -m "(auto) $ID: visual baselines re-taken on origin/main" > "$GATE_OUT" 2>&1 \
      || refuse visual-retake "the re-taken baselines could not be committed (a changed screen the task does not list in files:?)"
  fi
fi

# 2a. the id is this task's own. A tasks/<id>.yml already on main under another owner is another task's: this
# landing would overwrite its record (17 Oct 2026: a second "T321" replaced a landed T321's file). Re-landing
# one's own id is normal and goes on.
main_owner="$(git show "origin/main:$TASK" 2> /dev/null | sed -n 's/^owner: *//p' | head -n 1)"
if [ -n "$main_owner" ] && [ "$main_owner" != "$(task_field "$TASK" owner)" ]; then
  GATE_OUT=/dev/null
  refuse task-id "$TASK on main is $main_owner's task ($(git show "origin/main:$TASK" | sed -n 's/^goal: *//p' | head -n 1)); this branch would overwrite it. Claim a fresh id with scripts/new-task.sh and move the work there"
fi

# 2b. a task lands as one commit. Any other task whose "<id>:" commit is on main and that lacks
# `landed` gets status done and the sha here, whatever its status said (T099: claims that outlived
# their landing, T053 and F11-fix, blocked other claims for a day; T499: a task blocked once by a rebase
# conflict and landed later kept "blocked" for good); every commit of this branch must
# be this task's own; then the branch is squashed into "<id>: <goal>" with status done and the
# release note as the body (T064). Never a tasks/fixes/F*.yml: its "F<n>: the full suite is red"
# commit is on main from the moment it opens, so this loop closed F15 to F19 at the next landing
# with nothing fixed (T117); a fix task is closed only by the `fixes`-labelled task that fixes it.
edited=0
for tf in tasks/*.yml; do
  [ -f "$tf" ] && [ "$tf" != "$TASK" ] || continue
  [ -z "$(task_field "$tf" landed)" ] || continue
  case "$(task_field "$tf" status)" in open|claimed|todo|blocked|done) ;; *) continue ;; esac
  tid="$(task_field "$tf" id)"
  [ -n "$tid" ] || continue
  lsha="$(git log origin/main --format='%H %s' | awk -v p="$tid:" '{ i = ($2 == "(auto)") ? 3 : 2 } index($i, p) == 1 { print $1; exit }')"
  [ -n "$lsha" ] || continue
  task_mark_done "$tf"
  task_mark_landed "$tf" "$lsha"
  edited=1
done
if [ "$(task_field "$TASK" status)" != done ]; then
  case "$(task_field "$TASK" status)" in open|claimed|todo|blocked) task_mark_done "$TASK"; edited=1 ;; esac
fi
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
# A file this branch changed that another task locks needs that task's hash updated in the same
# landing: T235, T249 and T261 changed files locked by T001 and T003, only the landing task's own
# locks were checked, and --self-check went red on main.
changed="$(git diff --name-only origin/main HEAD)"
for other in tasks/*.yml; do
  [ "$other" = "$TASK" ] && continue
  while read -r path hash; do
    [ -n "$path" ] && [ "$hash" != pending ] && grep -qxF "$path" <<< "$changed" || continue
    actual="$(git show "HEAD:$path" 2>/dev/null | sha256sum | cut -d' ' -f1)"
    [ "$actual" = "$hash" ] || refuse locked "$path changed (locked by $other); update its sha256 there in this landing"
  done < <(task_locked "$other")
done

# 4. no open fixes task
if [ "$(task_field "$TASK" label)" != "fixes" ]; then
  open_fixes="$(grep -l '^status: open' tasks/fixes/*.yml 2>/dev/null | tr '\n' ' ')"
  [ -z "$open_fixes" ] || refuse fixes "open fixes task: $open_fixes; land a task labelled fixes first"
fi

# 4b. gate files: John approves changes to them (30 Oct 2026, report a4 section 1.4: an agent could make a
# coverage gate pass by editing the gate). A diff touching a GATE_FILES glob (land.conf) lands only when the
# task carries `gates_approved: QO<n>` and that board item (QUESTIONS_FILE) has a thread entry `by: John`.
# A separate field from `label:` so a task can be labelled fixes and also carry gates approval.
# An unset or empty GATE_FILES refuses: deleting the list must not switch the check off.
[ -n "${GATE_FILES:-}" ] || { GATE_OUT=/dev/null; refuse gates "GATE_FILES is not set in land.conf"; }
# The item must name this landing's task id (a whole word in title or body), so an agent cannot cite an
# unrelated item John once commented on.
{
  gate_hits="$(git diff --name-only origin/main HEAD | python3 -c '
import fnmatch, sys
globs = sys.argv[1:]
for line in sys.stdin.read().split("\n"):
    if line and any(fnmatch.fnmatchcase(line, g) for g in globs):
        print(line)
' $GATE_FILES | tr '\n' ' ')"
  if [ -n "$gate_hits" ]; then
    gates_qo="$(task_field "$TASK" gates_approved)"
    gates_msg="gate files changed: ${gate_hits}; a gate file changed; John approves gate changes: put the change to John as a board item and add gates_approved: QO<n> to the task once he has answered"
    [ -n "$gates_qo" ] || refuse gates "$gates_msg"
    # exit 0 only when the item with id == $gates_qo has a thread entry by John; missing file or item fails
    python3 - "${QUESTIONS_FILE:-}" "$gates_qo" "$ID" <<'PY' || refuse gates "$gates_msg (board item $gates_qo has no answer by John in ${QUESTIONS_FILE:-unset})"
import re, sys, yaml
path, qo, task_id = sys.argv[1], sys.argv[2], sys.argv[3]
names_task = re.compile(r"(?<![A-Za-z0-9])" + re.escape(task_id) + r"(?![A-Za-z0-9])")
with open(path) as f:
    doc = yaml.safe_load(f)
items = doc.get("questions", []) if isinstance(doc, dict) else doc
for item in items or []:
    if isinstance(item, dict) and item.get("id") == qo:
        text = str(item.get("title", "")) + "\n" + str(item.get("body", ""))
        sys.exit(0 if names_task.search(text) and any(isinstance(t, dict) and t.get("by") == "John" for t in item.get("thread") or []) else 1)
sys.exit(1)
PY
  fi
}

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
# Every architecture test, whatever changed: they read the source tree, so the unit gate's import graph
# never picks them (F52, F53: main red on architecture tests no landing ran, 17 Oct 2026).
[ -n "${ARCHITECTURE_CMD:-}" ] || { GATE_OUT=/dev/null; refuse architecture "ARCHITECTURE_CMD is not set in land.conf; every architecture test must run before a push"; }
GATE_DEADLINE_S="${UNIT_DEADLINE_S:-$GATE_DEADLINE_S}" run_gate architecture /dev/null "$ARCHITECTURE_CMD"
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
green_sha="$(cat "${POST_LAND_RECORD}.green" 2>/dev/null)"
tested_sha="$(cat "${POST_LAND_RECORD}.tested" 2>/dev/null)"
green_age=""; [ -f "${POST_LAND_RECORD}.green" ] && green_age="$(age_min "${POST_LAND_RECORD}.green")"
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

# 5c. the full suite on GitHub Actions, BEFORE main moves (fable for John, 17 Oct 2026: main went red four
# times in a night on things only the full suite saw). The candidate goes to land/<task>; the push there
# starts the Actions suite (.github/workflows/suite.yml); main is pushed only when that run is green.
# The landing lock is held throughout, so no other landing moves main in between. CANDIDATE_CMD waits for
# the run on HEAD and exits 0 only on green (scripts/land/post-land/actions.sh).
[ -n "${CANDIDATE_CMD:-}" ] || { GATE_OUT=/dev/null; refuse candidate "CANDIDATE_CMD is not set in land.conf; main moves only after the full suite is green on the candidate"; }
{
  CANDIDATE_BRANCH="land/$ID"
  GATE_OUT="$WORK/candidate.out"
  net "git push of the candidate" git push -q -f origin "HEAD:refs/heads/$CANDIDATE_BRANCH" > "$GATE_OUT" 2>&1 \
    || refuse candidate "origin rejected, or did not answer, the push of the candidate to $CANDIDATE_BRANCH"
  echo "land: candidate $(git rev-parse --short=10 HEAD) is on $CANDIDATE_BRANCH; waiting for GitHub Actions (about 4 min)"
  # Every landing's GitHub record: a pull request from the candidate (T331; on when land.conf sets PULL_REQUESTS).
  if [ -n "${PULL_REQUESTS:-}" ]; then
    goal="$(task_field "$TASK" goal)"
    printf '%s\n\nOpened by scripts/land.sh. Its checks are the candidate gate: when they pass, land.sh moves main to this commit by a fast-forward push, and GitHub shows this pull request merged. A refused landing closes it, saying why.\n' \
      "${goal:-$ID}" > "$WORK/pr-body.md"
    PR_NUMBER="$(ACTIONS_REPO="${ACTIONS_REPO:-}" bash "$HERE/land/pr.sh" open "$ID" "$CANDIDATE_BRANCH" "$(pr_title "$ID" "$goal")" "$WORK/pr-body.md" 2> "$WORK/pr.out")" \
      || { GATE_OUT="$WORK/pr.out"; PR_NUMBER=""; refuse pull-request "GitHub did not open the pull request for $CANDIDATE_BRANCH"; }
    sed 's/^/land: /' "$WORK/pr.out"
    echo "land: pull request #$PR_NUMBER: https://github.com/${ACTIONS_REPO:-}/pull/$PR_NUMBER"
  fi
  GATE_DEADLINE_S="${CANDIDATE_DEADLINE_S:-$GATE_DEADLINE_S}" run_gate candidate /dev/null "$CANDIDATE_CMD"
  grep -m1 'actions: run ' "$GATE_OUT" | sed 's/^.*actions: /land: candidate green: /'
}

# 6. push
before_push="$(git rev-parse origin/main)"
net "git push of main" git push -q origin HEAD:main > "$WORK/push.out" 2>&1 || { GATE_OUT="$WORK/push.out"; refuse push "origin rejected, or did not answer, the push"; }
pushed="$(git rev-parse HEAD)"
LANDED=1
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

# 8. the main folder and the preview copy move to the landed commit (T328). When one cannot (its own commits
# conflict with main, or are not on main), the landing agent is told here and fixes it (John, 17 Oct 2026).
# On when land.conf sets SYNC_MAIN_FOLDER (the scratch repos of the land tests leave it off).
if [ -n "${SYNC_MAIN_FOLDER:-}" ]; then
  bash "$HERE/land/sync-main-folder.sh" --passed "$pushed" "$ROOT" > "$WORK/sync.out" 2>&1 9>&-; synced=$?
  sed 's/^/land: /' "$WORK/sync.out"
  if [ "$synced" != 0 ]; then
    echo "land: LANDED, but the main folder did not update (above). Fix it now, before anything else." >&2
    exit 4
  fi
fi
