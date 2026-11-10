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
esac
EOF2
chmod +x "$SCRATCH/gh"
export LAND_GH="$SCRATCH/gh"

# setup <typecheck exit code>: main checkout "main", task worktree "wt" on branch t1 with one change.
setup() {
  rm -rf "$SCRATCH/w" "$CALLS"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
  git init -q --bare -b main origin.git
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
  printf 'id: T1\nowner: x\nstatus: claimed\ngoal: a.txt says hello\nrelease_note: internal\ndone_test: true\nfiles:\n  - a.txt\n' > ../wt/tasks/T1.yml
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

# (b) rebase conflict: exit 3, branch pushed, nothing removed
setup 0; echo mainside >> "$SCRATCH/w/main/a.txt"; git -C "$SCRATCH/w/main" commit -qam "main moves"; git -C "$SCRATCH/w/main" push -q origin main
ship T1; r=$?
[ $r = 3 ] && [ -d "$SCRATCH/w/wt" ] && git -C "$SCRATCH/w/main" rev-parse -q --verify refs/heads/t1 > /dev/null \
  && grep -q '^status: blocked' "$SCRATCH/w/wt/tasks/T1.yml" && [ -n "$(remote_t1)" ] && [ ! -s "$CALLS" ] \
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
setup 0; printf 'id: T2\nowner: y\nstatus: open\ngoal: g\nrelease_note: internal\ndone_test: true\nfiles:\n  - b.txt\n' > "$SCRATCH/w/wt/tasks/T2.yml"
ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && grep -q 'tasks/T2.yml' "$SCRATCH/out" \
  && ok "a second task file is refused and named" || fail "second task (r=$r): $(tail -5 "$SCRATCH/out")"

# (d) SHIP_REMOTE / SHIP_REPO: the branch goes to that remote and the pull request to that repo, origin sees nothing
SHIP_REMOTE_FOR_TEST=copy SHIP_REPO_FOR_TEST=c/r setup 0
COPY="$SCRATCH/w/copy.git"; git init -q --bare -b main "$COPY"
git -C "$SCRATCH/w/main" remote add copy "$COPY"; git -C "$SCRATCH/w/main" push -q copy main
ship T1; r=$?
[ $r = 0 ] && git -C "$COPY" rev-parse -q --verify refs/heads/t1 > /dev/null && [ -z "$(remote_t1)" ] \
  && grep -q '^pr|create|--repo|c/r|' "$CALLS" && grep -qx 'pr|merge|7|--repo|c/r|--auto|--squash' "$CALLS" \
  && ok "SHIP_REMOTE and SHIP_REPO send the branch and the pull request to the copy, not origin" || fail "copy (r=$r): $(tail -5 "$SCRATCH/out"); $(cat "$CALLS")"

[ $fails = 0 ] && { echo "ship: all passed"; exit 0; }
echo "ship: $fails failed"; exit 1
