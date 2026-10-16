#!/usr/bin/env bash
# The only path that merges a feature branch (one that did not go through land.sh) into main.
#
#   bash scripts/integrate.sh <task-id> <branch>      run from any clone of the repo
#
#   exit 0  integrated: origin/main is the branch squash-merged, pushed
#   exit 1  refused by a gate; main untouched; the message names the gate
#   exit 2  cannot start (no land.conf, bad branch, leftover worktree, no fetch)
#   exit 3  blocked: the squash merge conflicts; the paths are in tasks/<id>.yml under `blocked: |`
#           and the worktree is left in place for a resolution by hand (never --ours/--theirs)
#
# Steps, in order, under the landing lock (LAND_LOCK), so it never runs beside a landing:
#   1. no open tasks/fixes/*.yml, unless the task is labelled `fixes`
#   2. a fresh worktree of origin/main, node_modules hardlinked in
#   3. git merge --squash <branch>; a conflict exits 3
#   4. branch-tests: every test file the branch added or changed still exists, and passes
#   5. lint, typecheck, unit (the unit half every land.sh runs)
#   6. corpus, when the merge touches the schema, projectRepo, a loader or `driver_type`: the
#      stored-data corpus spec and the schemagen proof (SDLC S4)
#   7. commit the squash, attribution guard, push to main, start the post-land run, detached
#
# Config: land.conf (read, never changed). Env INTEGRATE_CORPUS_CMD and INTEGRATE_PROOF_CMD replace
# the corpus commands (the scratch-repo test stubs them); INTEGRATE_DIR replaces the worktree root.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT"
if [ -d "$HERE/core" ]; then CORE="$HERE/core"; else CORE="$HERE/land/core"; fi
if [ -f "$HERE/land.conf" ]; then CONF="$HERE/land.conf"; else CONF="$ROOT/land.conf"; fi
[ -f "$CONF" ] || { echo "integrate: no land.conf next to integrate.sh or in $ROOT" >&2; exit 2; }
# shellcheck source=/dev/null
. "$HERE/paths.sh"
# shellcheck source=/dev/null
. "$CONF"
# shellcheck source=./land/core/task.sh
. "$CORE/task.sh"
# shellcheck source=./land/core/gate.sh
. "$CORE/gate.sh"

# gate.sh's refuse says "land:"; this script says its own name.
refuse() {
  echo "integrate: REFUSED by gate $1: $2" >&2
  [ -s "$GATE_OUT" ] && tail -n 20 "$GATE_OUT" | sed 's/^/  | /' >&2
  exit 1
}

# gate.sh's gate waits on the gate and reads its status; under set -e a red gate would end this
# script before refuse names it. So gates run with -e off.
gate() {
  set +e
  run_gate "$@"
  set -e
}

ID="${1:?usage: integrate.sh <task-id> <branch>}"
BRANCH="${2:?usage: integrate.sh <task-id> <branch>}"
TASK="tasks/$ID.yml"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/integrate.XXXXXX")"
GATE_OUT="$WORK/gate.out"
WT=""
KEEP_WT=0
cleanup() {
  local status=$?
  gate_stop
  rm -rf "$WORK"
  if [ -n "$WT" ] && [ "$KEEP_WT" = 0 ]; then
    git -C "$ROOT" worktree remove --force "$WT" > /dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# One landing or integration at a time. The lock is released when this process ends.
exec 9> "$LAND_LOCK"
flock -n 9 || { echo "integrate: waiting for another landing"; flock 9; }

git fetch -q origin || { echo "integrate: fetch failed" >&2; exit 2; }
if git rev-parse -q --verify "refs/heads/$BRANCH" > /dev/null; then BRANCH_REF="refs/heads/$BRANCH"
elif git rev-parse -q --verify "refs/remotes/origin/$BRANCH" > /dev/null; then BRANCH_REF="refs/remotes/origin/$BRANCH"
else echo "integrate: no branch $BRANCH" >&2; exit 2; fi
BASE="$(git merge-base origin/main "$BRANCH_REF")" || { echo "integrate: $BRANCH shares no history with origin/main" >&2; exit 2; }

# 1. no open fixes task (the task file may be on the branch or on main)
task_text="$(git show "$BRANCH_REF:$TASK" 2> /dev/null || git show "origin/main:$TASK" 2> /dev/null || true)"
printf '%s\n' "$task_text" > "$WORK/task.yml"
if [ "$(task_field "$WORK/task.yml" label)" != "fixes" ]; then
  open_fixes="$(git ls-tree -r --name-only origin/main tasks/fixes/ | while read -r f; do
    git show "origin/main:$f" | grep -q '^status: open' && printf '%s ' "$f"; done || true)"
  [ -z "$open_fixes" ] || refuse fixes "open fixes task: $open_fixes; land a task labelled fixes first"
fi

# 2. a fresh worktree of origin/main
INTEGRATE_DIR="${INTEGRATE_DIR:-${POST_LAND_DIR:-$OPENISD_RUNTIME_DIR}/integrate}"
WT="$INTEGRATE_DIR/$ID"
if [ -e "$WT" ]; then
  echo "integrate: $WT exists (a conflict left for hand resolution?); resolve and finish it, or git worktree remove it" >&2
  WT=""
  exit 2
fi
mkdir -p "$INTEGRATE_DIR"
git worktree add -q --detach "$WT" origin/main
# node_modules hardlinked, as _agent_files/bin/new-worktree.sh does (same filesystem, no install).
for dir in $(ls -d node_modules packages/*/node_modules 2> /dev/null || true); do
  mkdir -p "$WT/$(dirname "$dir")"
  cp -al "$ROOT/$dir" "$WT/$dir"
done
# schemagen reads the read-only driver corpus at ../winisd_drivers/db, relative to the tree.
[ -d "$ROOT/../winisd_drivers" ] && [ ! -e "$INTEGRATE_DIR/../winisd_drivers" ] \
  && ln -s "$(cd "$ROOT/../winisd_drivers" && pwd)" "$INTEGRATE_DIR/../winisd_drivers" 2> /dev/null || true
cd "$WT"

# 3. the squash merge
if ! git merge --squash "$BRANCH_REF" > "$WORK/merge.out" 2>&1; then
  mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
  [ "${#conflicts[@]}" -gt 0 ] || { GATE_OUT="$WORK/merge.out"; refuse merge "git merge --squash failed"; }
  mkdir -p tasks
  [ -f "$TASK" ] || printf 'id: %s\nstatus: blocked\n' "$ID" > "$TASK"
  sed -i -e '/^blocked: |/,$d' -e 's/^status: .*/status: blocked/' "$TASK"
  {
    echo 'blocked: |'
    echo "  integrate: conflicts in ${conflicts[*]}; resolve by hand in $WT, never --ours/--theirs"
    printf '  - %s\n' "${conflicts[@]}"
  } >> "$TASK"
  KEEP_WT=1
  echo "integrate: BLOCKED: conflicts in ${conflicts[*]}; resolve by hand in $WT ($TASK says so)" >&2
  exit 3
fi

# 4. branch-tests: each test the branch added or changed exists after the merge, and passes
unit_tests=(); sh_tests=()
while IFS=$'\t' read -r st path; do
  case "$path" in *.test.ts|*.spec.ts|*.test.sh) ;; *) continue ;; esac
  case "$st" in
    D) GATE_OUT=/dev/null; refuse branch-tests "$BRANCH deletes the test $path" ;;
    *) [ -f "$path" ] || { GATE_OUT=/dev/null; refuse branch-tests "$path (added or changed by $BRANCH) is missing after the merge"; } ;;
  esac
  case "$path" in
    *.browser.spec.ts) ;;  # browser specs run post-land; the file must exist, nothing more
    *.test.ts|*.spec.ts) unit_tests+=("$path") ;;
    *.test.sh) sh_tests+=("$path") ;;
  esac
done < <(git -C "$ROOT" diff --name-status --no-renames "$BASE" "$BRANCH_REF")
if [ "${#unit_tests[@]}" -gt 0 ]; then
  gate branch-tests /dev/null "bash scripts/test.sh" "${unit_tests[@]}"
fi
for t in "${sh_tests[@]}"; do
  gate branch-tests /dev/null "bash" "$t"
done

# 5. lint, typecheck, unit half, on the squash committed (so every gate sees it as the diff from origin/main)
git add -A
{
  echo "$ID: $BRANCH integrated"
  echo
  git -C "$ROOT" log --format='- %s' "$BASE..$BRANCH_REF"
} > "$WORK/message"
if [ -z "$(git status --porcelain)" ]; then
  GATE_OUT=/dev/null; refuse merge "$BRANCH adds nothing to origin/main"
fi
git commit -q -F "$WORK/message" || { GATE_OUT=/dev/null; refuse commit "git commit failed"; }
mapfile -t changed < <(git diff --name-only --diff-filter=ACMR origin/main HEAD)
for required in ${LINT_REQUIRES:-}; do
  [ -e "$required" ] || { GATE_OUT=/dev/null; refuse lint "$required is missing in $WT"; }
done
GATE_DEADLINE_S="${LINT_DEADLINE_S:-$GATE_DEADLINE_S}" gate lint /dev/null "$LINT_CMD" "${changed[@]}"
GATE_DEADLINE_S="${TYPECHECK_DEADLINE_S:-$GATE_DEADLINE_S}" gate typecheck /dev/null "$TYPECHECK_CMD"
[ -n "${UNIT_CMD:-}" ] || { GATE_OUT=/dev/null; refuse unit "UNIT_CMD is not set in land.conf"; }
GATE_DEADLINE_S="${UNIT_DEADLINE_S:-$GATE_DEADLINE_S}" gate unit /dev/null "$UNIT_CMD" "${changed[@]}"

# 6. the stored-data corpus, when the merge can break what users already hold
if git diff --name-only origin/main HEAD | grep -Eq '(openisdSchema|projectRepo)\.ts$|^packages/[^/]+/src/.*[Ll]oader[^/]*\.ts$' \
   || git diff -U0 origin/main HEAD | grep -q 'driver_type'; then
  echo "integrate: schema, loader or driver_type touched; running the stored-data corpus"
  GATE_DEADLINE_S="${UNIT_DEADLINE_S:-$GATE_DEADLINE_S}" gate corpus /dev/null "${INTEGRATE_CORPUS_CMD:-bash scripts/test.sh packages/persistence/test/corpus/storedCorpus.test.ts packages/persistence/test/corpus/bundledDrivers.shard0.test.ts packages/persistence/test/corpus/bundledDrivers.shard1.test.ts packages/persistence/test/corpus/bundledDrivers.shard2.test.ts packages/persistence/test/corpus/bundledDrivers.shard3.test.ts}"
  GATE_DEADLINE_S="${UNIT_DEADLINE_S:-$GATE_DEADLINE_S}" gate schemagen /dev/null "${INTEGRATE_PROOF_CMD:-npm run schemagen:prove}"
  # The proof rewrites the generated module: a difference from the merged one means the branch did not regenerate it.
  [ -z "$(git status --porcelain)" ] || { git status --porcelain > "$WORK/dirty.out"; GATE_OUT="$WORK/dirty.out"; refuse schemagen "the proof changed the tree; regenerate scripts/schemagen/out in the branch"; }
fi

# 7. attribution, task record, push, post-land
gate attribution "$WORK/message" "$ATTRIBUTION_CMD"
if [ -f "$TASK" ]; then
  sed -i '/^landed:/d' "$TASK"
  printf 'landed: %s\n' "$(git rev-parse --short=10 HEAD)" >> "$TASK"
  git add "$TASK"
  git commit -q -m "$ID: landed $(git rev-parse --short=10 HEAD)" || { GATE_OUT=/dev/null; refuse commit "task commit failed"; }
fi
git push -q origin HEAD:main > "$WORK/push.out" 2>&1 || { GATE_OUT="$WORK/push.out"; refuse push "origin rejected the push"; }
pushed="$(git rev-parse HEAD)"
echo "integrate: integrated $BRANCH as $ID at ${pushed:0:10}"

if [ -n "${FULL_SUITE_CMD:-}" ] && [ -f "$HERE/land/post-land/run.sh" ]; then
  mkdir -p "$POST_LAND_DIR"
  setsid bash "$HERE/land/post-land/run.sh" "$pushed" >> "$POST_LAND_DIR/post-land.log" 2>&1 9>&- < /dev/null &
fi
