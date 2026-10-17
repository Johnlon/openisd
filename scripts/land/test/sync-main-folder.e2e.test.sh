#!/usr/bin/env bash
# T328, processes.md rule 7: scripts/land/sync-main-folder.sh end to end in a scratch repo with real git: a main
# folder (clone), a preview copy (detached worktree), stray edits, a conflict, and npm ci only on a lockfile
# change (a fake npm on PATH that records its calls).
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/sync-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/sync-main-folder.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"
export POST_LAND_LOCK="$SCRATCH/rt/post-land.lock" SYNC_LOG="$SCRATCH/sync.log" SYNC_NPM="$SCRATCH/npm"
printf '#!/usr/bin/env bash\necho "npm $* in $PWD" >> "%s/npm.calls"\n' "$SCRATCH" > "$SCRATCH/npm"; chmod +x "$SCRATCH/npm"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
SYNC="$REPO/scripts/land/sync-main-folder.sh"

# setup: origin with one commit; the main folder (a clone, as the real one); the preview, a detached worktree
# of it listed in openisd.syncedCopy; a dev clone that lands commits.
setup() {
  rm -rf "$SCRATCH/w" "$SCRATCH/npm.calls" "$SYNC_LOG"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
  git init -q --bare -b main origin.git
  git clone -q origin.git dev 2> /dev/null
  printf 'a\n' > dev/a.txt; printf 'q1\n' > dev/questions.yml; printf 'lock1\n' > dev/package-lock.json
  printf 'node_modules/\n' > dev/.gitignore
  git -C dev add -A; git -C dev commit -qm base; git -C dev push -q origin main
  git clone -q origin.git main
  git -C main worktree add -q --detach "$SCRATCH/w/preview" HEAD
  git -C main config --add openisd.syncedCopy "$SCRATCH/w/preview"
  mkdir -p main/node_modules; echo keep > main/node_modules/x
}
# land <file> <content> [<file> <content>]: a commit on origin/main from dev, recorded as the last passed
land() {
  while [ $# -gt 0 ]; do printf '%s\n' "$2" >> "$SCRATCH/w/dev/$1"; shift 2; done
  git -C "$SCRATCH/w/dev" add -A; git -C "$SCRATCH/w/dev" commit -qm landed; git -C "$SCRATCH/w/dev" push -q origin main
  git -C "$SCRATCH/w/dev" rev-parse HEAD > "$POST_LAND_LOCK.green"
}
head_of() { git -C "$SCRATCH/w/$1" rev-parse HEAD; }
dirty()   { git -C "$SCRATCH/w/$1" status --porcelain --untracked-files=all; }

# 1. behind and clean: both copies move to the last passed commit; npm ci only when the lockfile changed
setup; land a.txt b; s1=$(head_of dev); bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
calls1=$(cat "$SCRATCH/npm.calls" 2> /dev/null)
land package-lock.json lock2; s2=$(head_of dev); bash "$SYNC" "$SCRATCH/w/main" > /dev/null 2>&1; r2=$?
if [ $r = 0 ] && [ $r2 = 0 ] && [ "$(head_of main)" = "$s2" ] && [ "$(head_of preview)" = "$s2" ] && [ -z "$calls1" ] \
   && [ "$(grep -c "npm ci" "$SCRATCH/npm.calls")" = 2 ] && [ -z "$(git -C "$SCRATCH/w/preview" symbolic-ref -q HEAD)" ]; then
  ok "behind and clean: both copies move; npm ci only on a lockfile change; the preview stays detached"
else fail "behind (r=$r/$r2 main=$(head_of main) s2=$s2 npm=$(cat "$SCRATCH/npm.calls" 2>/dev/null)): $(tail -3 "$SCRATCH/out")"; fi

# 2. only a passed commit: a later commit on origin/main that post-land has not passed is not pulled
setup; land a.txt b; passed=$(head_of dev)
printf 'c\n' >> dev/a.txt; git -C dev commit -qam unpassed; git -C dev push -q origin main
bash "$SYNC" "$SCRATCH/w/main" > /dev/null 2>&1
if [ "$(head_of main)" = "$passed" ]; then ok "only the last passed commit is pulled, never an unpassed tip"
else fail "unpassed tip pulled"; fi

# 3. a stray modified file and a stray untracked file whose content is already on main: committed, then they
#    drop out in the rebase; the folder equals main, ignored files untouched
setup; land questions.yml q2; cp dev/questions.yml main/questions.yml; mkdir -p main/new; printf 'n\n' > main/new/f.txt
cp main/new/f.txt dev/f.txt 2> /dev/null; mkdir -p dev/new; cp main/new/f.txt dev/new/f.txt
git -C dev add -A; git -C dev commit -qm "same content"; git -C dev push -q origin main; head_of dev > "$POST_LAND_LOCK.green"
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -z "$(dirty main)" ] && [ -f main/node_modules/x ]; then
  ok "stray edits already on main drop out; the folder equals main; ignored files kept"
else fail "already on main (r=$r dirty=$(dirty main)): $(tail -3 "$SCRATCH/out")"; fi

# 4. a stray edit not on main that applies cleanly: committed and kept on top, exit 1 naming it; nothing lost
setup; land a.txt b; printf 'mine\n' > main/extra.txt
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && [ "$(git -C main rev-parse HEAD~1)" = "$(head_of dev)" ] && [ "$(git -C main show HEAD:extra.txt)" = mine ] \
   && [ -z "$(dirty main)" ] && grep -q "land what is wanted" "$SCRATCH/out"; then
  ok "an edit not on main: committed on top of main, kept, and reported"
else fail "own edit (r=$r): $(tail -3 "$SCRATCH/out")"; fi

# 5. a conflict (today's questions.yml: both sides appended): the rebase is cancelled, the folder is as it
#    was with the WIP commit, no rebase left in progress, exit 1 naming the file; a second run says the same
setup; land questions.yml "QO182 from main"; printf 'QO182 stray\n' >> main/questions.yml
before=$(head_of main); bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
gd=$(git -C main rev-parse --absolute-git-dir)
if [ $r = 1 ] && [ "$(git -C main rev-parse HEAD~1)" = "$before" ] && [ ! -e "$gd/rebase-merge" ] && [ ! -e "$gd/rebase-apply" ] \
   && grep -q "CONFLICT rebasing onto .* in questions.yml" "$SCRATCH/out" && grep -q "QO182 stray" main/questions.yml && [ -z "$(dirty main)" ]; then
  bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out2" 2>&1; r2=$?
  if [ $r2 = 1 ] && grep -q CONFLICT "$SCRATCH/out2" && [ "$(git -C main rev-list --count HEAD~1..HEAD)" = 1 ]; then
    ok "a conflict: cancelled, nothing lost, reported again on the next run, no second WIP commit"
  else fail "conflict, second run (r=$r2): $(tail -3 "$SCRATCH/out2")"; fi
else fail "conflict (r=$r): $(tail -4 "$SCRATCH/out")"; fi

# 6. two runs at once never overlap: the second exits 0 at once
setup; land a.txt b
exec 9> "$(git -C main rev-parse --absolute-git-dir)/sync-main-folder.lock"; flock 9
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?; exec 9>&-
if [ $r = 0 ] && grep -q "another run is syncing" "$SCRATCH/out" && [ "$(head_of main)" != "$(head_of dev)" ]; then
  ok "a second run while one holds the lock leaves at once"
else fail "overlap (r=$r): $(cat "$SCRATCH/out")"; fi

# 7. --passed (land.sh's call): the named commit is pulled before post-land records it
setup; land a.txt b; s=$(head_of dev); rm -f "$POST_LAND_LOCK.green"
bash "$SYNC" --passed "$s" "$SCRATCH/w/main" > /dev/null 2>&1; r=$?
if [ $r = 0 ] && [ "$(head_of main)" = "$s" ]; then ok "--passed pulls the commit land.sh just pushed"
else fail "--passed (r=$r)"; fi

# 8. git refuses the rebase for a reason that is not a conflict (here a tracked file changes again right after the
#    WIP commit, made by a post-commit hook): reported as a refusal, never as a CONFLICT, no rebase left in progress
setup; land a.txt b; echo stray > main/stray.txt
printf '#!/bin/sh\necho again >> questions.yml\n' > "$(git -C main rev-parse --absolute-git-dir)/hooks/post-commit"
chmod +x "$(git -C main rev-parse --absolute-git-dir)/hooks/post-commit"
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
gd=$(git -C main rev-parse --absolute-git-dir)
if [ $r = 1 ] && grep -q "git refused to rebase onto .* (no conflict)" "$SCRATCH/out" && ! grep -q CONFLICT "$SCRATCH/out" \
   && [ ! -e "$gd/rebase-merge" ] && [ ! -e "$gd/rebase-apply" ]; then
  ok "a rebase git refuses without a conflict is reported as that, not as a conflict"
else fail "refused rebase (r=$r): $(tail -3 "$SCRATCH/out")"; fi

[ $fails = 0 ] && { echo "sync-main-folder.e2e: all passed"; exit 0; }
echo "sync-main-folder.e2e: $fails failed"; exit 1
