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
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"
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
# The last green is kept on disk under the state dir, never under the runtime dir (/run is cleared at boot, T497).
export SYNC_LOG="$SCRATCH/sync.log" SYNC_NPM="$SCRATCH/npm"; mkdir -p "$OPENISD_STATE_DIR"
printf '#!/usr/bin/env bash\necho "npm $* in $PWD" >> "%s/npm.calls"\n' "$SCRATCH" > "$SCRATCH/npm"; chmod +x "$SCRATCH/npm"
fails=0
# T661: synced copies are read-only; make them writable before any delete
trap 'chmod -R u+w "$SCRATCH" 2> /dev/null; rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
SYNC="$REPO/scripts/land/sync-main-folder.sh"
GREEN="$OPENISD_STATE_DIR/post-land.green"

# setup: origin with one commit; the main folder (a clone, as the real one); the preview, a detached worktree
# of it listed in openisd.syncedCopy; a dev clone that lands commits.
setup() {
  chmod -R u+w "$SCRATCH/w" 2> /dev/null; rm -rf "$SCRATCH/w" "$SCRATCH/npm.calls" "$SCRATCH/systemctl.calls" "$SCRATCH/unit.exists" "$SCRATCH/restart.fails" "$SYNC_LOG"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
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
  git -C "$SCRATCH/w/dev" rev-parse HEAD > "$GREEN"
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
setup; land a.txt b; s=$(head_of dev); rm -f "$GREEN"
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

# 12. a restart clears the runtime dir (/run): the last green is still found and the copies move to it (T497)
setup; land a.txt b; s=$(head_of dev); rm -rf "$OPENISD_RUNTIME_DIR"
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(head_of main)" = "$s" ]; then ok "the last green survives a wiped runtime dir"
else fail "green lost with the runtime dir (r=$r): $(tail -3 "$SCRATCH/out")"; fi
mkdir -p "$OPENISD_RUNTIME_DIR"

# 13. T661: one stray branch per copy, appended to, never a new branch per sync
#     (a) two syncs with stray edits: ONE stray/main-folder branch holding both edits
setup; land a.txt b; printf 'edit-one\n' >> main/questions.yml
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r1=$?
land a.txt c; chmod -R u+w main; printf 'edit-two\n' >> main/questions.yml
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r2=$?
if [ $r1 = 0 ] && [ $r2 = 0 ] && [ "$(git -C main branch --list 'stray/*' | wc -l)" = 1 ] \
   && git -C main rev-parse -q --verify refs/heads/stray/main-folder > /dev/null \
   && git -C main show stray/main-folder:questions.yml | grep -q edit-two \
   && [ -n "$(git -C main log -S edit-one --format=%H stray/main-folder -- questions.yml)" ] \
   && [ "$(head_of main)" = "$(head_of dev)" ] && [ -z "$(dirty main)" ]; then
  ok "two syncs with stray edits make ONE stray/main-folder branch holding both"
else fail "one stray branch (r=$r1/$r2 branches=$(git -C main branch --list 'stray/*' | tr '\n' ' ')): $(tail -3 "$SCRATCH/out")"; fi
#     (b) the preview copy gets stray/<basename>
setup; land a.txt b; printf 'pv-edit\n' >> preview/questions.yml
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && git -C main show stray/preview:questions.yml | grep -q pv-edit && [ -z "$(dirty preview)" ] && [ "$(head_of preview)" = "$(head_of dev)" ]; then
  ok "a preview copy's stray edit goes to stray/preview"
else fail "preview stray (r=$r branches=$(git -C main branch --list 'stray/*' | tr '\n' ' ')): $(tail -3 "$SCRATCH/out")"; fi

# 14. T661: a main folder left on a stray branch (or any other branch) ends on main
setup; land a.txt b; git -C main switch -q -c stray/20261025T131334Z
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(git -C main symbolic-ref -q HEAD)" = refs/heads/main ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -z "$(dirty main)" ]; then
  ok "a clean main folder left on a stray branch ends on main at the passed commit"
else fail "left on stray, clean (r=$r head=$(git -C main symbolic-ref -q HEAD)): $(tail -3 "$SCRATCH/out")"; fi
setup; land a.txt b; git -C main switch -q -c t999; printf 'own\n' > main/own.txt; git -C main add own.txt; git -C main commit -qm own; own=$(head_of main)
printf 'dirty-edit\n' >> main/questions.yml
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(git -C main symbolic-ref -q HEAD)" = refs/heads/main ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ -z "$(dirty main)" ] \
   && git -C main merge-base --is-ancestor "$own" stray/main-folder && git -C main show stray/main-folder:questions.yml | grep -q dirty-edit; then
  ok "a dirty main folder with own commits on another branch: work kept on stray/main-folder, ends on main"
else fail "left on other branch, dirty (r=$r): $(tail -3 "$SCRATCH/out")"; fi

# 15. T661: after a sync the tracked files of each copy are read-only, and so are the tracked folders (no new file
#     in them); node_modules, build/, .git and untracked files stay writable; the next sync still moves the copy
#     and locks it again
setup; land a.txt b; mkdir -p dev/src dev/.claude; echo s > dev/src/s.txt; echo r > dev/.claude/rule.md; git -C dev add -A; git -C dev commit -qm src; git -C dev push -q origin main
git -C dev rev-parse HEAD > "$GREEN"
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
w5=0; { echo x > main/.claude/scheduled_tasks.lock; } 2> /dev/null && w5=1
w1=0; { echo x >> main/a.txt; } 2> /dev/null && w1=1
w2=0; { echo x > main/src/new.txt; } 2> /dev/null && w2=1
w3=0; { echo x >> preview/src/s.txt; } 2> /dev/null && w3=1
echo y > main/node_modules/y && echo z > main/untracked-root.txt && w4=1 || w4=0
if [ $r = 0 ] && [ $w1 = 0 ] && [ $w2 = 0 ] && [ $w3 = 0 ] && [ $w4 = 1 ] && [ $w5 = 1 ] && [ -z "$(git -C main status --porcelain --untracked-files=no)" ]; then
  ok "after a sync the copies' tracked files and tracked folders are read-only; node_modules, untracked files and dot folders (.claude) stay writable"
else fail "lock (r=$r tracked=$w1 newfile=$w2 preview=$w3 free=$w4 dotdir=$w5): $(tail -3 "$SCRATCH/out")"; fi
land a.txt d; printf 'new\n' >> dev/src/s.txt; git -C dev commit -qam more; git -C dev push -q origin main; git -C dev rev-parse HEAD > "$GREEN"
bash "$SYNC" "$SCRATCH/w/main" > "$SCRATCH/out" 2>&1; r=$?
w1=0; { echo x >> main/a.txt; } 2> /dev/null && w1=1
if [ $r = 0 ] && [ "$(head_of main)" = "$(head_of dev)" ] && [ "$(head_of preview)" = "$(head_of dev)" ] && [ $w1 = 0 ] && [ -z "$(git -C main status --porcelain --untracked-files=no)" ]; then
  ok "a locked copy still moves to the next passed commit and is locked again"
else fail "relock (r=$r tracked=$w1): $(tail -3 "$SCRATCH/out")"; fi

[ $fails = 0 ] && { echo "sync-main-folder.e2e: all passed"; exit 0; }
echo "sync-main-folder.e2e: $fails failed"; exit 1
