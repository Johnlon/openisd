#!/usr/bin/env bash
# T334, processes.md rule 7: scripts/land/tidy-branches.sh and scripts/abandon.sh end to end in a scratch workspace
# with real git, real worktrees beside the main folder, a real origin, and the real land.sh and new-task.sh.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/tidy-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/tidy-branches.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"
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
gm branch t6 origin/main; gm branch t7 origin/main; git -C "$M" commit -q --allow-empty -m x 2> /dev/null; gm branch -f t7 HEAD
gm push -q origin t6:refs/heads/t6 origin/main:refs/heads/land/T009 HEAD:refs/heads/t8
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

# 2. leftover folders: only generated folders and no git data goes
mkdir -p "$M-t20/node_modules/x" "$M-t20/build" "$M-t21" "$M-t22"; echo keep > "$M-t21/notes.txt"; echo "gitdir: /nowhere" > "$M-t22/.git"
tidy
[ ! -e "$M-t20" ] && ok "a leftover folder with only generated folders goes" || fail "t20 kept"
[ -f "$M-t21/notes.txt" ] && grep -q "kept $M-t21: not a worktree, but holds notes.txt" "$TIDY_LOG" && ok "a leftover folder with a file of its own is kept" || fail "t21 removed"
[ -e "$M-t22/.git" ] && ok "a folder with git data is kept" || fail "t22 removed"

# 3. abandon.sh: records the decision on main, keeps the commits, removes worktree and branch, local and on origin
setup
printf 'id: T130\nowner: maryu\nstatus: open\ngoal: phone tab rows\ndone_test: true\nfiles:\n  - tasks/T130.yml\n' > "$M/tasks/T130.yml"
gm add -A; gm commit -qm "T130 task"; gm push -q origin main
wt 130 ahead; tip=$(git -C "$M-t130" rev-parse HEAD); git -C "$M-t130" push -q origin t130
( cd "$M" && bash scripts/abandon.sh T130 --by John "John stopped the phone tab rows" ) > "$SCRATCH/ab.out" 2>&1; r=$?
rec=$(git -C "$SCRATCH/origin.git" show main:tasks/T130.yml 2> /dev/null)
if [ $r = 0 ] && grep -qx 'status: abandoned' <<< "$rec" && grep -qx 'abandoned_by: John' <<< "$rec" \
   && grep -qx "archived: $tip" <<< "$rec" && grep -qx 'abandoned_why: John stopped the phone tab rows' <<< "$rec"; then
  ok "the decision lands in tasks/T130.yml: status, who, why, the archived commit"
else fail "decision (r=$r): $(tail -4 "$SCRATCH/ab.out") RECORD: $rec"; fi
[ "$(gm rev-parse -q --verify refs/archive/T130)" = "$tip" ] && [ "$(git -C "$SCRATCH/origin.git" rev-parse -q --verify refs/archive/T130)" = "$tip" ] \
  && ok "the commits are kept as refs/archive/T130, here and on origin" || fail "archive ref missing"
[ ! -d "$M-t130" ] && ! has_branch t130 && ! has_remote t130 && ok "its worktree and branch are removed, local and on origin" || fail "t130 kept: $(tail -3 "$SCRATCH/ab.out")"
[ -z "$(gm worktree list | grep -v "^$M ")" ] && [ -z "$(gm for-each-ref 'refs/heads/t[0-9]*')" ] \
  && ok "the recording task's own worktree and branch are removed too" || fail "leftovers: $(gm worktree list; gm branch)"

# 4. abandon.sh on a worktree with uncommitted work: recorded, the worktree kept and said so (exit 4); the
#    watchdog-run tidy says "held" until the work is committed, then removes it
setup
printf 'id: T140\nowner: maryu\nstatus: open\ngoal: g\ndone_test: true\nfiles:\n  - tasks/T140.yml\n' > "$M/tasks/T140.yml"
gm add -A; gm commit -qm "T140 task"; gm push -q origin main
wt 140 ahead; echo wip > "$M-t140/unsaved.txt"
( cd "$M" && bash scripts/abandon.sh T140 --by John "no longer wanted" ) > "$SCRATCH/ab.out" 2>&1; r=$?
[ $r = 4 ] && [ -f "$M-t140/unsaved.txt" ] && grep -q "uncommitted work" "$SCRATCH/ab.out" && ok "uncommitted work keeps the worktree; abandon says so (exit 4)" || fail "dirty abandon (r=$r): $(tail -3 "$SCRATCH/ab.out")"
tidy; grep -q "^held: abandoned task T140's worktree" "$SCRATCH/out" && ok "housekeeping reports it as held" || fail "no held line: $(cat "$SCRATCH/out")"
git -C "$M-t140" add -A; git -C "$M-t140" commit -qm "late work"; tidy
[ -d "$M-t140" ] && has_branch t140 && ok "work committed after the archive is not lost: worktree and branch kept" || fail "late work removed"

# 5. abandon.sh refuses a task that is done, or not on main, and asks for --by
setup
printf 'id: T150\nowner: m\nstatus: done\ngoal: g\ndone_test: true\nfiles: []\n' > "$M/tasks/T150.yml"; gm add -A; gm commit -qm t; gm push -q origin main
( cd "$M" && bash scripts/abandon.sh T150 --by John "x" ) > /dev/null 2>&1; a=$?
( cd "$M" && bash scripts/abandon.sh T151 --by John "x" ) > /dev/null 2>&1; b=$?
( cd "$M" && bash scripts/abandon.sh T150 "x" ) > /dev/null 2>&1; c=$?
[ $a = 1 ] && [ $b = 1 ] && [ $c = 1 ] && ok "a done task, an unknown task and a missing --by are refused" || fail "refusals ($a $b $c)"

[ $fails = 0 ] && { echo "tidy-branches.e2e: all passed"; exit 0; }
echo "tidy-branches.e2e: $fails failed"; exit 1
