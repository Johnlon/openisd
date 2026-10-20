#!/usr/bin/env bash
# T328, T476, processes.md rule 7: scripts/land/sync-main-folder.sh end to end in a scratch repo with real git: a
# main folder (clone), a preview copy (detached worktree), stray edits (tracked; untracked files are left alone, T485), a stray edit to a file that landed
# differently, the folder's own commits, and npm ci only on a lockfile change (a fake npm on PATH that records
# its calls). Stray work goes to a stray/ branch; main only fast-forwards; exit 0.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/sync-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/sync-main-folder.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"
export SYNC_SYSTEMCTL="$SCRATCH/systemctl"
# stub systemctl: records every call; "cat" succeeds only when $SCRATCH/unit.exists is there; restart fails when $SCRATCH/restart.fails is there
cat > "$SCRATCH/systemctl" <<STUB
#!/usr/bin/env bash
echo "\$*" >> "$SCRATCH/systemctl.calls"
[ "\$2" = cat ] && [ ! -e "$SCRATCH/unit.exists" ] && exit 1
[ "\$2" = restart ] && [ -e "$SCRATCH/restart.fails" ] && exit 1
exit 0
STUB
chmod +x "$SCRATCH/systemctl"
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
  rm -rf "$SCRATCH/w" "$SCRATCH/npm.calls" "$SCRATCH/systemctl.calls" "$SCRATCH/unit.exists" "$SCRATCH/restart.fails" "$SYNC_LOG"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
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

# 3. a stray modified tracked file whose content is already on main: kept on a stray/ branch, the folder equals
#    main, ignored files untouched, exit 0
setup; land questions.yml q2; cp dev/questions.yml main/questions.yml
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -z "$(dirty main)" ] && [ -f main/node_modules/x ] \
   && [ "$(git -C main branch --list 'stray/*' | wc -l)" = 1 ]; then
  ok "stray edits already on main: kept on a stray branch; the folder equals main; ignored files kept"
else fail "already on main (r=$r dirty=$(dirty main)): $(tail -3 "$SCRATCH/out")"; fi

# 4. a stray tracked edit not on main: exit 0, main == target, the edit is on the stray branch, main's own history untouched
setup; land a.txt b; printf 'mine\n' >> main/questions.yml; before=$(head_of main)
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
sb=$(git -C main branch --list 'stray/*' --format='%(refname:short)' | head -1)
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -n "$sb" ] && git -C main show "$sb:questions.yml" | grep -q mine \
   && [ "$(git -C main rev-parse "$sb~1")" = "$before" ] && [ -z "$(dirty main)" ] && grep -q "STRAY main folder: kept on branch $sb" "$SYNC_LOG"; then
  ok "an edit not on main: on a stray branch made from HEAD, main fast-forwarded, logged, exit 0"
else fail "own edit (r=$r sb=$sb): $(tail -3 "$SCRATCH/out")"; fi

# 5. the stuck case (T476): a stray edit to a file that landed differently on main: exit 0, main == target, the
#    stray branch holds the edit; a second run makes no second branch
setup; land questions.yml "QO182 from main"; printf 'QO182 stray\n' >> main/questions.yml
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
sb=$(git -C main branch --list 'stray/*' --format='%(refname:short)' | head -1)
gd=$(git -C main rev-parse --absolute-git-dir)
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -n "$sb" ] && git -C main show "$sb:questions.yml" | grep -q "QO182 stray" \
   && ! grep -q "QO182 stray" main/questions.yml && [ ! -e "$gd/rebase-merge" ] && [ ! -e "$gd/rebase-apply" ] && [ -z "$(dirty main)" ]; then
  bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out2" 2>&1; r2=$?
  if [ $r2 = 0 ] && [ "$(git -C main branch --list 'stray/*' | wc -l)" = 1 ]; then
    ok "a conflicting stray edit: main == target, the edit is on a stray branch, exit 0, no second branch"
  else fail "conflict, second run (r=$r2): $(tail -3 "$SCRATCH/out2")"; fi
else fail "conflict (r=$r sb=$sb): $(tail -4 "$SCRATCH/out")"; fi

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

# 8. a post-commit hook that dirties a tracked file after the stray commit cannot stick the sync (the commit runs
#    with hooks off): exit 0, main == target, clean
setup; land a.txt b; echo stray >> main/questions.yml
printf '#!/bin/sh\necho again >> questions.yml\n' > "$(git -C main rev-parse --absolute-git-dir)/hooks/post-commit"
chmod +x "$(git -C main rev-parse --absolute-git-dir)/hooks/post-commit"
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -z "$(dirty main)" ]; then
  ok "a hook on the stray commit cannot leave the folder dirty or held"
else fail "hook (r=$r): $(tail -3 "$SCRATCH/out")"; fi

# 8b. the folder's own commit (not on main): moved to a stray branch, main reset to the target only after the branch holds it
setup; land a.txt b; printf 'own\n' > main/own.txt; git -C main add own.txt; git -C main commit -qm "own work"; own=$(head_of main)
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
sb=$(git -C main branch --list 'stray/*' --format='%(refname:short)' | head -1)
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -n "$sb" ] && [ "$(git -C main rev-parse "$sb")" = "$own" ] && [ -z "$(dirty main)" ]; then
  ok "the folder's own commit is kept on a stray branch; main == target"
else fail "own commit (r=$r sb=$sb): $(tail -3 "$SCRATCH/out")"; fi

# 9. the preview unit runs Vite on the main folder, and a rebase leaves Vite serving stale modules: when the main
#    folder moved, the unit is restarted (once, after the move); nothing moved, no restart; no unit, no restart;
#    a failed restart is logged and exits 1
setup; touch "$SCRATCH/unit.exists"; land a.txt b
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
moved_calls=$(grep -c "^--user restart openisd-preview" "$SCRATCH/systemctl.calls" 2> /dev/null)
rm -f "$SCRATCH/systemctl.calls"; bash "$SYNC" "$SCRATCH/w/main" > /dev/null 2>&1
still_calls=$(grep -c "restart" "$SCRATCH/systemctl.calls" 2> /dev/null)
if [ $r = 0 ] && [ "$moved_calls" = 1 ] && [ "${still_calls:-0}" = 0 ]; then ok "main folder moved: the preview unit is restarted once; unmoved: not restarted"
else fail "restart on move (r=$r moved=$moved_calls still=$still_calls): $(tail -3 "$SCRATCH/out")"; fi
setup; land a.txt b
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && ! grep -q restart "$SCRATCH/systemctl.calls" 2> /dev/null; then ok "no preview unit installed: no restart, no error"
else fail "no unit (r=$r): $(tail -3 "$SCRATCH/out")"; fi
setup; touch "$SCRATCH/unit.exists" "$SCRATCH/restart.fails"; land a.txt b
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && grep -q "preview restart FAILED" "$SCRATCH/out"; then ok "a failed preview restart is logged loudly and exits 1"
else fail "restart failure (r=$r): $(tail -3 "$SCRATCH/out")"; fi

# 10. untracked files are John's (T485): left on disk with the same content, on no stray branch; with nothing else
#     dirty no stray branch is made at all; the copies still move. In the main folder and in the preview copy.
setup; land a.txt b; printf 'ps listing\n' > main/lll1; printf 'pv\n' > preview/lll2
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ "$(head_of preview)" = "$(head_of dev)" ] \
   && [ "$(cat main/lll1 2> /dev/null)" = "ps listing" ] && [ "$(cat preview/lll2 2> /dev/null)" = pv ] \
   && [ -z "$(git -C main branch --list 'stray/*')" ] && ! grep -q STRAY "$SYNC_LOG"; then
  ok "untracked files in the main folder and the preview survive a sync; no stray branch is made"
else fail "untracked left alone (r=$r branches=$(git -C main branch --list 'stray/*')): $(tail -3 "$SCRATCH/out")"; fi

# 10b. an untracked file beside a tracked edit: the edit goes to the stray branch, the untracked file stays on
#      disk and is on no branch
setup; land a.txt b; printf 'ps listing\n' > main/lll1; printf 'mine\n' >> main/questions.yml
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
sb=$(git -C main branch --list 'stray/*' --format='%(refname:short)' | head -1)
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -n "$sb" ] && git -C main show "$sb:questions.yml" | grep -q mine \
   && ! git -C main cat-file -e "$sb:lll1" 2> /dev/null && [ "$(cat main/lll1 2> /dev/null)" = "ps listing" ]; then
  ok "tracked edit on a stray branch; the untracked file stays on disk and on no branch"
else fail "untracked beside edit (r=$r sb=$sb): $(tail -3 "$SCRATCH/out")"; fi

# 11. collision: an untracked file at a path the passed commit adds: the copy is held (exit 1, not moved), the log
#     names the file, the content is unchanged. Fast-forward path, then the reset path (the copy has its own commit).
setup; land new.txt landed; printf 'johns\n' > main/new.txt; before=$(head_of main)
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && [ "$(head_of main)" = "$before" ] && [ "$(cat main/new.txt)" = johns ] && grep -q "untracked new.txt would be overwritten" "$SYNC_LOG" \
   && [ -z "$(git -C main branch --list 'stray/*')" ]; then
  ok "an untracked file the passed commit adds holds the copy (fast-forward path); content unchanged"
else fail "collision ff (r=$r): $(tail -3 "$SCRATCH/out")"; fi
setup; land new.txt landed; printf 'own\n' > main/own.txt; git -C main add own.txt; git -C main commit -qm "own work"
printf 'johns\n' > main/new.txt; before=$(head_of main)
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && [ "$(head_of main)" = "$before" ] && [ "$(cat main/new.txt)" = johns ] && grep -q "untracked new.txt would be overwritten" "$SYNC_LOG"; then
  ok "an untracked file the passed commit adds holds the copy (reset path); content unchanged"
else fail "collision reset (r=$r): $(tail -3 "$SCRATCH/out")"; fi

[ $fails = 0 ] && { echo "sync-main-folder.e2e: all passed"; exit 0; }
echo "sync-main-folder.e2e: $fails failed"; exit 1
