#!/usr/bin/env bash
# T815 (John, 15 Nov 2026, QO923): the mistakes agents made when shipping pull requests on 14-15 Nov are refused or caught
# before the pull request opens. Scratch repo, real git and a bare origin, a gh stand-in that behaves like GitHub where it
# matters here: `pr edit --add-label` fails (Projects classic), the REST label call works, and `pr merge --auto` can
# succeed without leaving an auto-merge request (the 5 PRs that sat green and unqueued).
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/ship-guards-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ship-guards.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
ORIGIN="$SCRATCH/w/origin.git"
CALLS="$SCRATCH/gh.calls"
PRSTATE="$SCRATCH/pr.state"        # OPEN | MERGED: what `pr view` reports
AUTO="$SCRATCH/pr.auto"            # present: an auto-merge request exists
INQUEUE="$SCRATCH/pr.inqueue"      # present: the PR is in the merge queue
NOOP="$SCRATCH/gh.merge-noop"      # present: `pr merge` exits 0 but records nothing (the silent failure)

cat > "$SCRATCH/gh" <<EOF2
#!/usr/bin/env bash
( IFS='|'; echo "\$*" ) >> "$CALLS"
case "\$1 \$2" in
  "pr list") [ -e "$SCRATCH/pr.exists" ] && echo 7 || echo "" ;;
  "pr create") echo "https://github.com/o/r/pull/7" ;;
  "pr merge") [ -e "$NOOP" ] || : > "$AUTO"; echo "auto-merge enabled" ;;
  "pr view") s=OPEN; [ -e "$PRSTATE.merged" ] && s=MERGED; if [ -e "$AUTO" ]; then echo "\$s auto"; else echo "\$s none"; fi ;;
  "pr edit") case "\$*" in *) echo "GraphQL: Projects (classic) is being deprecated" >&2; exit 1 ;; esac ;;
  "api repos/o/r/issues/7/labels") [ -e "$SCRATCH/pr.labels" ] && cat "$SCRATCH/pr.labels" ;;
  "api graphql") if [ -e "$INQUEUE" ]; then echo true; else echo false; fi ;;
esac
exit 0
EOF2
chmod +x "$SCRATCH/gh"
export LAND_GH="$SCRATCH/gh"

# setup [<extra ship.conf lines>]: main checkout "main", task worktree "wt" on branch t1 with one change.
setup() {
  rm -rf "$SCRATCH/w" "$SCRATCH/pr.labels" "$SCRATCH/pr.exists" "$CALLS" "$AUTO" "$INQUEUE" "$NOOP" "$PRSTATE.merged"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
  git init -q --bare -b main origin.git
  git -C origin.git config receive.denyNonFastForwards true
  git clone -q origin.git main 2> /dev/null; cd main || exit 2
  mkdir -p scripts tasks gates
  cp "$REPO/scripts/ship.sh" "$REPO/scripts/paths.sh" scripts/
  cp -r "$REPO/scripts/land" "$REPO/scripts/lib" scripts/
  printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh
  printf '#!/usr/bin/env bash\nexit %s\n' "${ARCH_EXIT:-0}" > gates/arch.sh
  printf '#!/usr/bin/env bash\necho "$@" > "%s/unit.args"\nexit %s\n' "$SCRATCH" "${UNIT_EXIT:-0}" > gates/unit.sh
  cat > land.conf <<EOF2
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
ACTIONS_REPO=o/r
GATE_FILES="land.conf"
EOF2
  printf 'SHIP_REMOTE=origin\nSHIP_REPO=o/r\n%s\n' "${1:-}" > ship.conf
  touch tasks/.keep; echo base > a.txt
  git add -A; git commit -qm base; git push -q origin main
  git worktree add -q -b t1 ../wt
  printf 'id: T1\nowner: x\nstatus: claimed\ngoal: a.txt says hello\nwhy: John said so (John, 14 Nov 2026) for this test\nrelease_note: internal\ndone_test: %s\nfiles:\n  - a.txt\n%s' "${DONE_TEST:-true}" "${TASK_EXTRA:-}" > ../wt/tasks/T1.yml
  echo hello >> ../wt/a.txt
}
ship() { (cd "$SCRATCH/w/wt" && timeout 120 bash scripts/ship.sh "$@" > "$SCRATCH/out" 2>&1); }
remote_t1() { git -C "$ORIGIN" rev-parse -q --verify refs/heads/t1; }

# 1. a done_test naming a browser spec is refused by the local task contract, before the push (the pull request's done-test job refused it after)
DONE_TEST='bash scripts/test.sh packages/ui/test/ui/x.browser.spec.ts' setup; ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && [ -d "$SCRATCH/w/wt" ] && [ ! -s "$CALLS" ] && grep -q 'browser spec' "$SCRATCH/out" && grep -q 'x.browser.spec.ts' "$SCRATCH/out" \
  && ok "1 a browser spec as done_test pushes nothing and is named" || fail "1 browser done_test (r=$r): $(tail -5 "$SCRATCH/out")"
DONE_TEST='bash scripts/test.sh packages/ui/test/ui/x.test.ts' setup; ship T1; r=$?
[ $r = 0 ] && ok "1 a unit spec as done_test still ships" || fail "1 unit done_test (r=$r): $(tail -5 "$SCRATCH/out")"

# 2/3. the architecture tests and the unit tests the change reaches run locally before the push, as the pull request's jobs run them
setup 'SHIP_ARCH_CMD="bash gates/arch.sh"
SHIP_UNIT_CMD="bash gates/unit.sh"'
ARCH_EXIT=1 setup 'SHIP_ARCH_CMD="bash gates/arch.sh"
SHIP_UNIT_CMD="bash gates/unit.sh"'
ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && [ -d "$SCRATCH/w/wt" ] && [ ! -s "$CALLS" ] && grep -q 'architecture' "$SCRATCH/out" \
  && ok "2 a red architecture run pushes nothing" || fail "2 red architecture (r=$r): $(tail -5 "$SCRATCH/out")"
UNIT_EXIT=1 setup 'SHIP_ARCH_CMD="bash gates/arch.sh"
SHIP_UNIT_CMD="bash gates/unit.sh"'
ship T1; r=$?
[ $r = 1 ] && [ -z "$(remote_t1)" ] && grep -q 'a.txt' "$SCRATCH/unit.args" && grep -q 'unit' "$SCRATCH/out" \
  && ok "3 a red unit run pushes nothing; it is given the changed files" || fail "3 red unit (r=$r): $(tail -5 "$SCRATCH/out")"
setup 'SHIP_ARCH_CMD="bash gates/arch.sh"
SHIP_UNIT_CMD="bash gates/unit.sh"'
ship T1; r=$?
[ $r = 0 ] && [ -n "$(remote_t1)" ] && ok "2/3 green architecture and unit runs ship" || fail "2/3 green (r=$r): $(tail -5 "$SCRATCH/out")"
ARCH_EXIT=1 setup 'SHIP_ARCH_CMD="bash gates/arch.sh"'
ship T1 --no-local-check; r=$?
[ $r = 0 ] && ok "2 --no-local-check still skips the local runs" || fail "2 skip (r=$r): $(tail -5 "$SCRATCH/out")"

# the architecture list holds every architecture test and the branch map test (pr-gate's `architecture` job runs the same list)
list="$(cd "$REPO" && OPENISD_CI_RUNNER=1 bash scripts/land/unit-architecture.sh --list 2>&1)"
grep -q 'packages/ui/test/scripts/branch-map.test.ts' <<< "$list" && grep -q 'architecture' <<< "$list" \
  && ok "2 unit-architecture.sh lists branch-map.test.ts with the architecture tests" || fail "2 branch-map not in the architecture list: $list"

# 4. auto-merge: ship.sh confirms with GitHub that the pull request is queued; a merge call that leaves no request is refused loudly
setup; ship T1; r=$?
grep -q '^pr|view|7' "$CALLS" && [ $r = 0 ] && grep -q 'queued' "$SCRATCH/out" \
  && ok "4 ship asks GitHub whether the pull request is queued and says so" || fail "4 queued check (r=$r): $(cat "$SCRATCH/out"); $(cat "$CALLS")"
setup; : > "$NOOP"; ship T1; r=$?
[ $r = 1 ] && [ -d "$SCRATCH/w/wt" ] && grep -q 'NOT queued' "$SCRATCH/out" && grep -q 'pr-queue.sh 7' "$SCRATCH/out" \
  && ok "4 a merge call that leaves no auto-merge request exits 1, removes nothing, names pr-queue.sh" || fail "4 silent no-op (r=$r): $(tail -6 "$SCRATCH/out")"
# in the merge queue counts as queued even with no request
setup; : > "$NOOP"; : > "$INQUEUE"; ship T1; r=$?
[ $r = 0 ] && ok "4 a pull request already in the merge queue counts as queued" || fail "4 in queue (r=$r): $(tail -6 "$SCRATCH/out")"

# 4b. pr-queue.sh: the one command that makes sure an open pull request is queued (a queue ejection drops the request)
cd "$SCRATCH/w/main" || exit 2
queue() { (cd "$SCRATCH/w/main" && timeout 60 bash scripts/land/pr-queue.sh "$@" > "$SCRATCH/qout" 2>&1); }
rm -f "$AUTO" "$NOOP" "$INQUEUE" "$CALLS"; queue 7; r=$?
[ $r = 0 ] && grep -qx 'pr|merge|7|--repo|o/r|--auto|--squash' "$CALLS" && grep -q 'queued' "$SCRATCH/qout" \
  && ok "4b pr-queue.sh re-enables auto-merge on a green unqueued pull request and confirms it" || fail "4b re-queue (r=$r): $(cat "$SCRATCH/qout"); $(cat "$CALLS")"
rm -f "$AUTO" "$CALLS"; : > "$NOOP"; queue 7; r=$?
[ $r = 1 ] && grep -q 'NOT queued' "$SCRATCH/qout" && ok "4b pr-queue.sh exits 1 when the pull request still is not queued" || fail "4b still unqueued (r=$r): $(cat "$SCRATCH/qout")"
rm -f "$NOOP" "$CALLS"; : > "$PRSTATE.merged"; queue 7; r=$?
[ $r = 0 ] && grep -q 'merged' "$SCRATCH/qout" && ! grep -q '^pr|merge' "$CALLS" \
  && ok "4b pr-queue.sh leaves a merged pull request alone" || fail "4b merged (r=$r): $(cat "$SCRATCH/qout")"

# 5. labels: the REST call, never `gh pr edit --add-label` (which fails on this repo, Projects classic); --fixes or `label: fixes` in the task
setup; ship T1 --fixes; r=$?
grep -qx 'api|-X|POST|repos/o/r/issues/7/labels|-f|labels\[\]=fixes' "$CALLS" && ! grep -q -- '--add-label' "$CALLS" && [ $r = 0 ] \
  && ok "5 ship.sh --fixes labels the pull request with the REST call" || fail "5 --fixes (r=$r): $(cat "$CALLS"); $(tail -4 "$SCRATCH/out")"
TASK_EXTRA='label: fixes
' setup; ship T1; r=$?
grep -qx 'api|-X|POST|repos/o/r/issues/7/labels|-f|labels\[\]=fixes' "$CALLS" && [ $r = 0 ] \
  && ok "5 a task with label: fixes is labelled without the flag" || fail "5 task label (r=$r): $(cat "$CALLS")"
setup; ship T1; r=$?
! grep -q 'POST|repos/o/r/issues/7/labels' "$CALLS" && ok "5 no label unless asked" || fail "5 unrequested label: $(cat "$CALLS")"
! grep -v '^ *#' "$REPO/scripts/ship.sh" "$REPO/scripts/land/pr.sh" "$REPO/scripts/land/pr-fix.sh" "$REPO/scripts/land/pr-queue.sh" 2> /dev/null | grep -q -- '--add-label' \
  && ok "5 no script calls gh pr edit --add-label" || fail "5 a script still calls --add-label"

# 9. a pull request the lead holds (label hold) is pushed but never queued by ship.sh, and says so loudly
setup; printf 'hold\n' > "$SCRATCH/pr.labels"; ship T1; r=$?
! grep -q '^pr|merge' "$CALLS" && grep -q 'HELD' "$SCRATCH/out" && [ -n "$(remote_t1)" ] \
  && ok "9 a held pull request is pushed, not queued, and ship says HELD" || fail "9 held (r=$r): $(tail -5 "$SCRATCH/out"); $(cat "$CALLS")"

# 7. the worktree goes at once; one command makes a fresh one from the branch, and ship.sh names it
setup; ship T1; r=$?
grep -q 'pr-fix.sh' "$SCRATCH/out" && [ ! -e "$SCRATCH/w/wt" ] && ok "7 ship's last line names the one command that recreates the worktree" || fail "7 message (r=$r): $(tail -3 "$SCRATCH/out")"
cd "$SCRATCH/w/main" && out="$(bash scripts/land/pr-fix.sh T1 2>&1)"; r=$?
fix="$SCRATCH/w/main-t1"
[ $r = 0 ] && [ "$(git -C "$SCRATCH/w/main" rev-parse --show-toplevel)" != "" ] && echo "$out" | grep -q "t1" \
  && wt="$(git -C "$SCRATCH/w/main" worktree list --porcelain | awk '$1=="worktree"{p=$2} $1=="branch"&&$2=="refs/heads/t1"{print p}')" \
  && [ -n "$wt" ] && [ "$(git -C "$wt" rev-parse HEAD)" = "$(remote_t1)" ] && [ ! -e "$wt/.task" ] \
  && ok "7 pr-fix.sh T1 makes a worktree on t1 at the pushed tip" || fail "7 pr-fix (r=$r): $out"
if [ -n "${wt:-}" ]; then
  echo fix >> "$wt/a.txt"; rm -f "$AUTO"
  : > "$SCRATCH/pr.exists"
  (cd "$wt" && timeout 120 bash scripts/ship.sh T1 > "$SCRATCH/out" 2>&1); r=$?
  grep -q '^api|-X|PATCH|repos/o/r/pulls/7|' "$CALLS" && ! grep -q '^pr|edit' "$CALLS" && ok "7 a re-ship retitles the open pull request with REST, not gh pr edit" || fail "7 retitle: $(cat "$CALLS")"
  [ $r = 0 ] && [ "$(git -C "$ORIGIN" show t1:a.txt | tail -1)" = fix ] && ok "7 the fix ships from that worktree and the pull request is queued again" || fail "7 re-ship (r=$r): $(tail -5 "$SCRATCH/out")"
fi
out="$(cd "$SCRATCH/w/main" && bash scripts/land/pr-fix.sh T9 2>&1)"; r=$?
[ $r != 0 ] && echo "$out" | grep -q 'T9' && ok "7 pr-fix.sh refuses a branch the remote does not have, naming it" || fail "7 unknown branch (r=$r): $out"

[ $fails = 0 ] && { echo "ship-guards: all passed"; exit 0; }
echo "ship-guards: $fails failed"; exit 1
