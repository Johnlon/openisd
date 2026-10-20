#!/usr/bin/env bash
# T334, processes.md rule 7: scripts/land/tidy-branches.sh and scripts/abandon.sh (T355: lands nothing) end to end in a scratch workspace
# with real git, real worktrees beside the main folder, a real origin, and the real land.sh and new-task.sh.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/tidy-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/tidy-branches.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
export TIDY_LOG="$SCRATCH/tidy.log" WORKSPACE="$SCRATCH/ws"
PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2> /dev/null; done; [ -n "${KEEP:-}" ] || rm -rf "$SCRATCH" "$GITCFG"; }
trap cleanup EXIT
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
M="$WORKSPACE/repo"
gm() { git -C "$M" "$@"; }

# setup: origin, the main folder "repo" with the real scripts and a land.conf whose gates all pass
setup() {
  rm -rf "$WORKSPACE" "$SCRATCH/origin.git" "$TIDY_LOG"; mkdir -p "$WORKSPACE"
  git init -q --bare -b main "$SCRATCH/origin.git"
  git clone -q "$SCRATCH/origin.git" "$M" 2> /dev/null
  mkdir -p "$M/scripts" "$M/tasks/fixes" "$M/gates"
  cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" "$REPO/scripts/new-task.sh" "$REPO/scripts/abandon.sh" "$M/scripts/"
  cp -r "$REPO/scripts/land" "$REPO/scripts/visual" "$REPO/scripts/lib" "$M/scripts/"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$M/gates/ok.sh"
  cat > "$M/land.conf" <<EOF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"
GATE_DEADLINE_S=60
LAND_LOCK="$SCRATCH/land.lock"
EOF
  printf 'node_modules/\n.task\nbuild/\n' > "$M/.gitignore"; touch "$M/tasks/fixes/.keep"; echo base > "$M/a.txt"
  gm add -A; gm commit -qm base; gm push -q origin main
}
# wt <n> [ahead]: a task worktree repo-t<n> on branch t<n> at origin/main; with "ahead", one commit not on main
wt() {
  gm worktree add -q "$M-t$1" -b "t$1" origin/main
  [ "${2:-}" = ahead ] && { echo "$1" > "$M-t$1/w$1.txt"; git -C "$M-t$1" add -A; git -C "$M-t$1" commit -qm "t$1 work"; }
  return 0
}
tidy() { bash "$M/scripts/land/tidy-branches.sh" "$@" "$M" > "$SCRATCH/out" 2>&1; }
has_branch() { gm rev-parse -q --verify "refs/heads/$1" > /dev/null; }
has_remote() { git -C "$SCRATCH/origin.git" rev-parse -q --verify "refs/heads/$1" > /dev/null; }

# 1. worktrees and branches: only what is safe on main, clean and unused goes
setup
wt 1; wt 2; echo x > "$M-t2/stray.txt"; wt 3 ahead; wt 4; printf 'T004\n' > "$M-t4/.task"
wt 5; ( cd "$M-t5" && exec sleep 300 ) & PIDS+=("$!"); sleep 0.3
gm branch t6 origin/main; wt 7 ahead; gm worktree remove "$M-t7"
gm push -q origin t6:refs/heads/t6 origin/main:refs/heads/land/T009 t7:refs/heads/t8
gm branch keepme origin/main
gm worktree add -q --detach "$M-preview" origin/main; gm config --add openisd.syncedCopy "$M-preview"
tidy; r=$?
[ $r = 0 ] || fail "tidy exit $r: $(tail -3 "$SCRATCH/out")"
[ ! -d "$M-t1" ] && ! has_branch t1 && ok "a landed, clean, unused worktree goes, with its branch" || fail "t1 kept: $(cat "$SCRATCH/out")"
[ -d "$M-t2" ] && has_branch t2 && ok "a worktree with an untracked file is kept" || fail "t2 removed"
[ -d "$M-t3" ] && has_branch t3 && ok "a worktree with a commit not on main is kept" || fail "t3 removed"
[ ! -d "$M-t4" ] && grep -q "repo-t4.*its claim on T004 was stale" "$TIDY_LOG" && ok "a stale claim does not keep a landed clean worktree; logged" || fail "t4: $(grep t4 "$TIDY_LOG")"
[ -d "$M-t5" ] && grep -q "kept $M-t5: a running program is inside it" "$TIDY_LOG" && ok "a worktree a program runs in is kept" || fail "t5 removed"
! has_branch t6 && ! has_remote t6 && ok "a landed branch with no worktree goes, local and on origin" || fail "t6 kept"
! has_remote land/T009 && ok "a landed land/<task> candidate branch on origin goes" || fail "land/T009 kept"
has_branch t7 && has_remote t8 && ok "branches with commits not on main are kept, local and on origin" || fail "t7/t8 removed"
has_branch keepme && ok "a branch that is not a task branch is never touched" || fail "keepme removed"
[ -d "$M-preview" ] && ok "a synced copy is never touched" || fail "preview removed"

# 1b. squash landings (land.sh): a branch whose content is on main goes; so does one whose only difference is its
#     own task file once main says done; a branch adding work main lacks stays, even when its task is done
setup
wt 160 ahead; cp "$M-t160/w160.txt" "$M/w160.txt"; gm add w160.txt; gm commit -qm "T160 squashed"; gm push -q origin main
gm worktree remove "$M-t160"
gm branch t161 origin/main; gm worktree add -q "$M-t161" t161; printf 'id: T161\nstatus: open\n' > "$M-t161/tasks/T161.yml"
git -C "$M-t161" add -A; git -C "$M-t161" commit -qm "T161: task file"; gm worktree remove "$M-t161"
printf 'id: T161\nstatus: done\nlanded: x\n' > "$M/tasks/T161.yml"; gm add -A; gm commit -qm "T161 landed"; gm push -q origin main
wt 162 ahead; printf 'id: T162\nstatus: done\n' > "$M/tasks/T162.yml"; gm add -A; gm commit -qm "T162 done elsewhere"; gm push -q origin main
gm worktree remove "$M-t162"
tidy
! has_branch t160 && ok "a branch whose content is on main goes, though its shas are not" || fail "t160 kept: $(cat "$SCRATCH/out")"
! has_branch t161 && ok "a done task's branch that differs only in its own task file goes" || fail "t161 kept: $(cat "$SCRATCH/out")"
has_branch t162 && ok "a branch adding work main lacks stays, even when its task says done" || fail "t162 removed"

# 1c. worktrees without a task name, outside the workspace's task folders: an old clean one on main goes; a young
#     one (a live run's copy between steps) and an old one holding a commit not on main stay
gm worktree add -q --detach "$SCRATCH/old-copy" origin/main; touch -d '7 hours ago' "$(git -C "$SCRATCH/old-copy" rev-parse --absolute-git-dir)/HEAD"
gm worktree add -q --detach "$SCRATCH/young-copy" origin/main
gm worktree add -q --detach "$SCRATCH/old-ahead" origin/main; echo z > "$SCRATCH/old-ahead/z"; git -C "$SCRATCH/old-ahead" add z; git -C "$SCRATCH/old-ahead" commit -qm z
touch -d '7 hours ago' "$(git -C "$SCRATCH/old-ahead" rev-parse --absolute-git-dir)/HEAD"
tidy
[ ! -d "$SCRATCH/old-copy" ] && ok "an old, clean, unused copy on main without a task name goes" || fail "old copy kept: $(grep old-copy "$TIDY_LOG")"
[ -d "$SCRATCH/young-copy" ] && ok "a copy younger than 6 h stays (a live run's)" || fail "young copy removed"
[ -d "$SCRATCH/old-ahead" ] && ok "an old copy holding a commit not on main stays" || fail "old-ahead removed"

# 2. leftover folders: only generated folders and no git data goes
mkdir -p "$M-t20/node_modules/x" "$M-t20/build" "$M-t21" "$M-t22"; echo keep > "$M-t21/notes.txt"; echo "gitdir: /nowhere" > "$M-t22/.git"
mkdir -p "$M-t23/node_modules"
touch -d '3 days ago' "$M-t20" "$M-t21" "$M-t22"
tidy
[ ! -e "$M-t20" ] && ok "a leftover folder with only generated folders goes" || fail "t20 kept"
[ -d "$M-t23" ] && grep -q "kept $M-t23: newer than a day" "$TIDY_LOG" && ok "T486 row 10: a fresh peer folder survives" || fail "t23 removed or not logged"
! grep -q readlink "$REPO/scripts/land/tidy-branches.sh" && ok "T486 rows 10/15: no readlink fork per process" || fail "readlink in tidy-branches.sh"
[ -f "$M-t21/notes.txt" ] && grep -q "kept $M-t21: not a worktree, but holds notes.txt" "$TIDY_LOG" && ok "a leftover folder with a file of its own is kept" || fail "t21 removed"
[ -e "$M-t22/.git" ] && ok "a folder with git data is kept" || fail "t22 removed"

# 3. abandon.sh: lands nothing on main, deletes worktree (uncommitted work too) and branch (later commits too),
#    local and on origin, archives nothing, and logs who, why, the tip and the goal
setup
printf 'id: T130\nowner: maryu\nstatus: open\ngoal: phone tab rows\ndone_test: true\nfiles:\n  - tasks/T130.yml\n' > "$M/tasks/T130.yml"
gm add -A; gm commit -qm "T130 task"; gm push -q origin main
wt 130 ahead; tip=$(git -C "$M-t130" rev-parse HEAD); git -C "$M-t130" push -q origin t130
echo wip > "$M-t130/unsaved.txt"; echo more > "$M-t130/w130.txt"
git -C "$M-t130" commit -qam "after the tip"; echo wip2 > "$M-t130/unsaved2.txt"
tip=$(git -C "$M-t130" rev-parse HEAD)
before=$(git -C "$SCRATCH/origin.git" rev-parse main)
( cd "$M" && bash scripts/abandon.sh T130 --by John "John stopped the phone tab rows" ) > "$SCRATCH/ab.out" 2>&1; r=$?
[ $r = 0 ] && ok "abandon exits 0" || fail "abandon exit $r: $(tail -4 "$SCRATCH/ab.out")"
[ "$(git -C "$SCRATCH/origin.git" rev-parse main)" = "$before" ] && [ -z "$(git -C "$SCRATCH/origin.git" show main:tasks/T130.yml | grep abandoned)" ] \
  && ok "origin/main is unchanged: no commit lands, the task file is not edited" || fail "main moved"
[ -z "$(gm for-each-ref refs/archive)" ] && [ -z "$(git -C "$SCRATCH/origin.git" for-each-ref refs/archive)" ] \
  && ok "nothing is archived, here or on origin" || fail "archive refs made"
[ ! -d "$M-t130" ] && ! has_branch t130 && ! has_remote t130 && ok "worktree with uncommitted work and branch with later commits are deleted, local and on origin" || fail "t130 kept: $(tail -3 "$SCRATCH/ab.out")"
l=$(grep "abandoned T130" "$TIDY_LOG")
if grep -q "by John" <<< "$l" && grep -q "John stopped the phone tab rows" <<< "$l" && grep -q "tip ${tip:0:10}" <<< "$l" \
   && grep -q "goal: phone tab rows" <<< "$l" && grep -q "uncommitted work discarded" <<< "$l"; then ok "the log line names who, why, tip, goal and the discarded work"
else fail "log: $l"; fi
[ -z "$(gm worktree list | grep -v "^$M ")" ] && [ -z "$(gm for-each-ref 'refs/heads/t[0-9]*')" ] && ok "no other worktree or task branch is made or left" || fail "leftovers: $(gm worktree list; gm branch)"
tidy; r=$?
[ $r = 0 ] && ! grep -q "held:" "$SCRATCH/out" && ! has_branch t130 && ! has_remote t130 && ok "housekeeping afterwards neither complains nor resurrects it" || fail "tidy after abandon (r=$r): $(cat "$SCRATCH/out")"

# 4b. abandon.sh on a task whose task file never reached main: read from its branch
setup
wt 145; printf 'id: T145\nowner: maryu\nstatus: open\ngoal: g\ndone_test: true\nfiles:\n  - tasks/T145.yml\n' > "$M-t145/tasks/T145.yml"
git -C "$M-t145" add -A; git -C "$M-t145" commit -qm "T145: task file"
before=$(git -C "$SCRATCH/origin.git" rev-parse main)
( cd "$M" && bash scripts/abandon.sh T145 --by fable "never started" ) > "$SCRATCH/ab.out" 2>&1; r=$?
[ $r = 0 ] && [ "$(git -C "$SCRATCH/origin.git" rev-parse main)" = "$before" ] && [ ! -d "$M-t145" ] && ! has_branch t145 && grep -q "abandoned T145 by fable" "$TIDY_LOG" \
  && ok "a task that never reached main is abandoned from its branch's task file, main untouched" || fail "branch-only abandon (r=$r): $(tail -3 "$SCRATCH/ab.out")"

# 5. abandon.sh refuses a task that is done, or not on main, and asks for --by
setup
printf 'id: T150\nowner: m\nstatus: done\ngoal: g\ndone_test: true\nfiles: []\n' > "$M/tasks/T150.yml"; gm add -A; gm commit -qm t; gm push -q origin main
( cd "$M" && bash scripts/abandon.sh T150 --by John "x" ) > /dev/null 2>&1; a=$?
( cd "$M" && bash scripts/abandon.sh T151 --by John "x" ) > /dev/null 2>&1; b=$?
( cd "$M" && bash scripts/abandon.sh T150 "x" ) > /dev/null 2>&1; c=$?
[ $a = 1 ] && [ $b = 1 ] && [ $c = 1 ] && ok "a done task, an unknown task and a missing --by are refused" || fail "refusals ($a $b $c)"

[ $fails = 0 ] && { echo "tidy-branches.e2e: all passed"; exit 0; }
echo "tidy-branches.e2e: $fails failed"; exit 1
