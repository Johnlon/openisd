#!/usr/bin/env bash
# T749: scripts/ship.sh end to end in a scratch repo: real git and a bare origin, a gh stand-in that logs its calls.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/ship-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ship.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
ORIGIN="$SCRATCH/w/origin.git"
CALLS="$SCRATCH/gh.calls"

cat > "$SCRATCH/gh" <<EOF2
#!/usr/bin/env bash
( IFS='|'; echo "\$*" ) >> "$CALLS"
case "\$1 \$2" in
  "pr list") echo "" ;;
  "pr create") echo "https://github.com/o/r/pull/7" ;;
  "pr view") echo "OPEN auto" ;;     # GitHub confirms the auto-merge request (T815: ship.sh asks)
esac
EOF2
chmod +x "$SCRATCH/gh"
export LAND_GH="$SCRATCH/gh"

# setup <typecheck exit code>: main checkout "main", task worktree "wt" on branch t1 with one change.
setup() {
  rm -rf "$SCRATCH/w" "$CALLS"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
  git init -q --bare -b main origin.git
  git -C origin.git config receive.denyNonFastForwards true   # a forced push is refused here, as by the GitHub ruleset (QO920)
  git clone -q origin.git main 2> /dev/null; cd main || exit 2
  mkdir -p scripts tasks gates
  cp "$REPO/scripts/ship.sh" "$REPO/scripts/paths.sh" scripts/
  cp -r "$REPO/scripts/land" "$REPO/scripts/lib" scripts/
  printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh
  printf '#!/usr/bin/env bash\nexit %s\n' "$1" > gates/type.sh
  cat > land.conf <<EOF2
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/type.sh"
ACTIONS_REPO=o/r
GATE_FILES="land.conf"
EOF2
  printf 'SHIP_REMOTE=%s\nSHIP_REPO=%s\n' "${SHIP_REMOTE_FOR_TEST:-origin}" "${SHIP_REPO_FOR_TEST:-o/r}" > ship.conf
  touch tasks/.keep; echo base > a.txt
  git add -A; git commit -qm base; git push -q origin main
  git worktree add -q -b t1 ../wt
  printf 'id: T1\nowner: x\nstatus: claimed\ngoal: a.txt says hello\nwhy: John said so (John, 14 Nov 2026) for this test\nrelease_note: internal\ndone_test: true\nfiles:\n  - a.txt\n' > ../wt/tasks/T1.yml
  echo hello >> ../wt/a.txt
}
ship() { (cd "$SCRATCH/w/wt" && timeout 120 bash scripts/ship.sh "$@" > "$SCRATCH/out" 2>&1); }
remote_t1() { git -C "$ORIGIN" rev-parse -q --verify refs/heads/t1; }

# (a) happy path: pushed, PR opened and set to auto-merge, worktree and local branch removed after the push
setup 0; ship T1; r=$?
sha="$(remote_t1)"
[ $r = 0 ] && [ -n "$sha" ] && git -C "$ORIGIN" show "t1:tasks/T1.yml" | grep -q '^status: done' \
  && ok "pushes t1 with everything committed and status done" || fail "push (r=$r): $(tail -5 "$SCRATCH/out")"
grep -qx 'pr|create|--repo|o/r|--base|main|--head|t1|--title|(auto) T1: a.txt says hello|--body-file|.*' "$CALLS" \
  && grep -qx 'pr|merge|7|--repo|o/r|--auto|--squash' "$CALLS" \
  && ok "opens the pull request and sets auto-merge (squash)" || fail "gh calls: $(cat "$CALLS")"
[ ! -e "$SCRATCH/w/wt" ] && ! git -C "$SCRATCH/w/main" rev-parse -q --verify refs/heads/t1 > /dev/null \
  && ok "worktree and local branch removed" || fail "worktree or branch left"
grep -q 'pull/7' "$SCRATCH/out" && grep -q ' START ship-T1' "$SCRATCH/out" && grep -q ' END ship-T1 status=0' "$SCRATCH/out" \
  && ok "prints the PR url, with start and end lines" || fail "output: $(cat "$SCRATCH/out")"

# (b) merge conflict (T792: merge, not rebase): exit 3, branch pushed, nothing removed
setup 0; echo mainside >> "$SCRATCH/w/main/a.txt"; git -C "$SCRATCH/w/main" commit -qam "main moves"; git -C "$SCRATCH/w/main" push -q origin main
ship T1; r=$?
[ $r = 3 ] && [ -d "$SCRATCH/w/wt" ] && git -C "$SCRATCH/w/main" rev-parse -q --verify refs/heads/t1 > /dev/null \
  && grep -q '^status: blocked' "$SCRATCH/w/wt/tasks/T1.yml" && [ -n "$(remote_t1)" ] && [ ! -s "$CALLS" ] \
  && [ ! -d "$SCRATCH/w/wt/.git/rebase-merge" ] && ! git -C "$SCRATCH/w/wt" rev-parse -q --verify MERGE_HEAD > /dev/null \
  && ok "a conflict exits 3, pushes the branch, removes nothing, opens no pull request" || fail "conflict (r=$r): $(tail -5 "$SCRATCH/out")"

# (c) local check red: exit 1, nothing pushed, nothing removed; --no-local-check skips it
setup 1; ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && [ -d "$SCRATCH/w/wt" ] && [ ! -s "$CALLS" ] \
  && ok "a red local check pushes nothing" || fail "red check (r=$r): $(tail -5 "$SCRATCH/out")"
ship T1 --no-local-check; r=$?
[ $r = 0 ] && [ -n "$(remote_t1)" ] && ok "--no-local-check skips the check" || fail "skip (r=$r): $(tail -5 "$SCRATCH/out")"

# (d) refuses any ref but t<n>: a worktree on another branch pushes nothing
setup 0; git -C "$SCRATCH/w/wt" switch -q -c other
ship T1; r=$?
[ $r = 2 ] && grep -q REFUSED "$SCRATCH/out" && [ -z "$(git -C "$ORIGIN" for-each-ref refs/heads | grep -v main)" ] && [ -d "$SCRATCH/w/wt" ] \
  && ok "refuses to push any branch but t1" || fail "other ref (r=$r): $(tail -5 "$SCRATCH/out")"

# (e) task contract (T758): a changed file outside the task's allowlist exits 1 before any push, naming the file
setup 0; echo stray > "$SCRATCH/w/wt/b.txt"
ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && [ -d "$SCRATCH/w/wt" ] && [ ! -s "$CALLS" ] && grep -q 'b.txt' "$SCRATCH/out" \
  && ok "a file outside the allowlist pushes nothing and is named" || fail "allowlist (r=$r): $(tail -5 "$SCRATCH/out")"
# a second task file in the diff is refused too (its path is not in T1's allowlist)
setup 0; printf 'id: T2\nowner: y\nstatus: open\ngoal: g\nwhy: John said so (John, 14 Nov 2026) for this test\nrelease_note: internal\ndone_test: true\nfiles:\n  - b.txt\n' > "$SCRATCH/w/wt/tasks/T2.yml"
ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && grep -q 'tasks/T2.yml' "$SCRATCH/out" \
  && ok "a second task file is refused and named" || fail "second task (r=$r): $(tail -5 "$SCRATCH/out")"

# (f) several tasks (T762): one pull request carries T1 and T2; every file is in one of their allowlists
setup 0; printf 'id: T2\nowner: y\nstatus: claimed\ngoal: b.txt exists\nwhy: John said so (John, 14 Nov 2026) for this test\nrelease_note: internal\ndone_test: true\nfiles:\n  - b.txt\n' > "$SCRATCH/w/wt/tasks/T2.yml"
echo b > "$SCRATCH/w/wt/b.txt"
git -C "$SCRATCH/w/main" worktree add -q -b t2 ../wt2     # T2's own worktree: clean, its branch inside t1
ship T1 T2; r=$?
[ $r = 0 ] && git -C "$ORIGIN" show "t1:tasks/T1.yml" | grep -q '^status: done' && git -C "$ORIGIN" show "t1:tasks/T2.yml" | grep -q '^status: done' \
  && git -C "$ORIGIN" show "t1:b.txt" > /dev/null && [ -z "$(git -C "$ORIGIN" rev-parse -q --verify refs/heads/t2)" ] \
  && ok "T1 and T2 ship as one branch, both tasks done" || fail "two tasks (r=$r): $(tail -5 "$SCRATCH/out")"
[ "$(grep -c '^pr|create|' "$CALLS")" = 1 ] && grep -q '^pr|create|.*|--title|(auto) T1, T2: a.txt says hello / b.txt exists|' "$CALLS" \
  && grep -qx 'pr|merge|7|--repo|o/r|--auto|--squash' "$CALLS" \
  && ok "opens one pull request titled with both ids" || fail "two-task gh calls: $(cat "$CALLS")"
git -C "$ORIGIN" log -1 --format=%s t1 | grep -q '^(auto) T[12]' && ok "commit subjects keep the (auto) T<n> prefix" || fail "subject: $(git -C "$ORIGIN" log -3 --format=%s t1)"
[ ! -e "$SCRATCH/w/wt2" ] && ! git -C "$SCRATCH/w/main" rev-parse -q --verify refs/heads/t2 > /dev/null && [ ! -e "$SCRATCH/w/wt" ] \
  && ok "both worktrees and both local branches are removed" || fail "worktrees left"
# a carried task whose file is not in the tree is refused before anything is pushed
setup 0; ship T1 T9; r=$?
[ $r = 2 ] && [ -z "$(remote_t1)" ] && [ -d "$SCRATCH/w/wt" ] && grep -q 'tasks/T9.yml' "$SCRATCH/out" \
  && ok "an id with no task file in the tree exits 2 and pushes nothing" || fail "missing task (r=$r): $(tail -5 "$SCRATCH/out")"
# a carried task's dirty worktree is left alone
setup 0; printf 'id: T2\nowner: y\nstatus: claimed\ngoal: b.txt exists\nwhy: John said so (John, 14 Nov 2026) for this test\nrelease_note: internal\ndone_test: true\nfiles:\n  - b.txt\n' > "$SCRATCH/w/wt/tasks/T2.yml"
echo b > "$SCRATCH/w/wt/b.txt"; git -C "$SCRATCH/w/main" worktree add -q -b t2 ../wt2; echo unsaved > "$SCRATCH/w/wt2/notes.txt"
ship T1 T2; r=$?
[ $r = 0 ] && [ -f "$SCRATCH/w/wt2/notes.txt" ] && ok "a carried task's worktree with unsaved work is left, not removed" || fail "dirty worktree (r=$r): $(tail -5 "$SCRATCH/out")"

# (g) T792 / QO920: re-ship after main moved is a merge commit and a plain fast-forward push (the remote refuses forced pushes)
setup 0; ship T1 --no-local-check; r=$?
first="$(remote_t1)"
[ $r = 0 ] && [ -n "$first" ] || fail "first ship (r=$r): $(tail -5 "$SCRATCH/out")"
cd "$SCRATCH/w/main" && echo other > c.txt && git add c.txt && git commit -qm "main moves" && git push -q origin main
git fetch -q origin && git worktree add -q -b t1 ../wt origin/t1
printf '  - c.txt\n' > /dev/null; echo more >> "$SCRATCH/w/wt/a.txt"
ship T1 --no-local-check; r=$?
second="$(remote_t1)"
[ $r = 0 ] && [ "$second" != "$first" ] && git -C "$ORIGIN" merge-base --is-ancestor "$first" "$second" \
  && [ "$(git -C "$ORIGIN" rev-list --merges --count "main..t1")" -ge 1 ] && git -C "$ORIGIN" show "t1:c.txt" > /dev/null \
  && ok "re-ship after main moved: merge commit, fast-forward push accepted by a remote that denies non-fast-forward" || fail "re-ship (r=$r): $(tail -5 "$SCRATCH/out")"
! grep -v '^ *#' "$REPO/scripts/ship.sh" | grep -v 'worktree remove' | grep -Eq -- '--force|force-with-lease|rebase' \
  && ok "ship.sh has no force or rebase in its code" || fail "ship.sh still mentions force or rebase"

# (h) T792 / QO920: the remote already has t1 at a commit this branch lacks (someone else's PR branch): refused, remote untouched
setup 0
git clone -q "$ORIGIN" "$SCRATCH/w/other" 2> /dev/null; ( cd "$SCRATCH/w/other" && git switch -q -c t1 && echo foreign > f.txt && git add f.txt && git commit -qm "someone else" && git push -q origin t1 )
foreign="$(remote_t1)"
ship T1; r=$?
[ $r = 1 ] && [ "$(remote_t1)" = "$foreign" ] && [ -d "$SCRATCH/w/wt" ] && [ ! -s "$CALLS" ] \
  && grep -q "REFUSED" "$SCRATCH/out" && grep -q "branch t1" "$SCRATCH/out" && grep -q "$foreign" "$SCRATCH/out" \
  && ok "a remote branch with a foreign head is refused, named, and left untouched" || fail "foreign head (r=$r): $(tail -5 "$SCRATCH/out")"

# (d) SHIP_REMOTE / SHIP_REPO: the branch goes to that remote and the pull request to that repo, origin sees nothing
SHIP_REMOTE_FOR_TEST=copy SHIP_REPO_FOR_TEST=c/r setup 0
COPY="$SCRATCH/w/copy.git"; git init -q --bare -b main "$COPY"
git -C "$SCRATCH/w/main" remote add copy "$COPY"; git -C "$SCRATCH/w/main" push -q copy main
ship T1; r=$?
[ $r = 0 ] && git -C "$COPY" rev-parse -q --verify refs/heads/t1 > /dev/null && [ -z "$(remote_t1)" ] \
  && grep -q '^pr|create|--repo|c/r|' "$CALLS" && grep -qx 'pr|merge|7|--repo|c/r|--auto|--squash' "$CALLS" \
  && ok "SHIP_REMOTE and SHIP_REPO send the branch and the pull request to the copy, not origin" || fail "copy (r=$r): $(tail -5 "$SCRATCH/out"); $(cat "$CALLS")"

# (i) T799: baseline pictures must be drawn by CI's test machine: an unstamped picture is refused before any push
SNAPD=packages/ui/test/visual/visual.browser.spec.ts-snapshots
visual_setup() {   # $1: printf format of the picture's bytes
  setup 0; cp -r "$REPO/scripts/visual" "$SCRATCH/w/main/scripts/"; ( cd "$SCRATCH/w/main" && git add -A && git commit -qm visual && git push -q origin main ) && git -C "$SCRATCH/w/wt" merge -q main
  mkdir -p "$SCRATCH/w/wt/$SNAPD"; printf "$1" > "$SCRATCH/w/wt/$SNAPD/mobile-a.png"
  printf '  - %s/mobile-a.png\nvisual:\n  - mobile-a\nvisual_note: a changed\n' "$SNAPD" >> "$SCRATCH/w/wt/tasks/T1.yml"
}
visual_setup 'drawn on a laptop'
ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && [ -d "$SCRATCH/w/wt" ] && [ ! -s "$CALLS" ] && grep -q 'mobile-a' "$SCRATCH/out" && grep -q 'update.sh' "$SCRATCH/out" \
  && ok "a baseline picture not drawn by CI pushes nothing and says how to re-take" || fail "unstamped picture (r=$r): $(tail -6 "$SCRATCH/out")"
visual_setup 'drawn by ci\0openisd-visual-run\0run=9'
ship T1; r=$?
[ $r = 0 ] && [ -n "$(remote_t1)" ] && ok "a baseline picture stamped by a visual-retake run ships" || fail "stamped picture (r=$r): $(tail -6 "$SCRATCH/out")"

[ $fails = 0 ] && { echo "ship: all passed"; exit 0; }
echo "ship: $fails failed"; exit 1
