#!/usr/bin/env bash
# T331, processes.md rule 7: every landing is a GitHub pull request from land/<task> (John, 17 Oct 2026: "of course
# it should be pr"). End to end in a scratch repo: the real land.sh and pr.sh, real git, and a stand-in for gh that
# records each call (GitHub itself cannot be scratched).
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-pull-request.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
fails=0
trap '[ -n "${KEEP:-}" ] || rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
ORIGIN="$SCRATCH/w/origin.git"
CALLS="$SCRATCH/gh.calls"

# The gh stand-in: logs its arguments (one call per line, fields joined by |), copies a --body-file, opens #7.
# GH_OPEN=<n>: pull request #n is already open on the branch (pr list prints it, pr create refuses as GitHub does).
cat > "$SCRATCH/gh" <<EOF
#!/usr/bin/env bash
( IFS='|'; echo "\$*" ) >> "$CALLS"
[ -n "\${GH_FAIL:-}" ] && { echo "HTTP 422: no" >&2; exit 1; }
case "\$1 \$2" in
  "pr list") echo "\${GH_OPEN:-}" ;;
  "pr create") if [ -n "\${GH_OPEN:-}" ]; then
                 printf 'a pull request for branch "land/T1" into branch "main" already exists:\\nhttps://github.com/o/r/pull/%s\\n' "\$GH_OPEN" >&2; exit 1
               fi
               while [ \$# -gt 0 ]; do [ "\$1" = --body-file ] && cp "\$2" "$SCRATCH/body.md"; shift; done
               echo "https://github.com/o/r/pull/7" ;;
  "pr edit") while [ \$# -gt 0 ]; do [ "\$1" = --body-file ] && cp "\$2" "$SCRATCH/body.md"; shift; done ;;
  "pr view") echo MERGED ;;
esac
EOF
chmod +x "$SCRATCH/gh"
export LAND_GH="$SCRATCH/gh"

# setup [candidate command] [pull requests on: 1/""]
setup() {
  rm -rf "$SCRATCH/w" "$CALLS" "$SCRATCH/body.md"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
  git init -q --bare -b main origin.git
  git clone -q origin.git seed 2> /dev/null; cd seed || exit 2
  mkdir -p scripts tasks/fixes gates
  cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/
  cp -r "$REPO/scripts/land" "$REPO/scripts/visual" "$REPO/scripts/lib" scripts/
  printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh
  cat > land.conf <<EOF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_FILES="no-such-gate-file"
CANDIDATE_CMD="$1"
GATE_DEADLINE_S=60
LAND_LOCK="$SCRATCH/land.lock"
ACTIONS_REPO=o/r
PULL_REQUESTS=$2
EOF
  touch tasks/.keep tasks/fixes/.keep; echo base > a.txt
  git add -A; git commit -qm base; git push -q origin main
  cd ..; git clone -q origin.git w1
  printf 'id: T1\nowner: maryu\nstatus: claimed\ngoal: a.txt says hello\ndone_test: true\nfiles:\n  - a.txt\n' > w1/tasks/T1.yml
  echo hello >> w1/a.txt; git -C w1 add -A; git -C w1 commit -qm "work T1"
}
land() { (cd "$SCRATCH/w/w1" && timeout 120 bash scripts/land.sh T1 > "$SCRATCH/out" 2>&1); }
has_remote() { git -C "$ORIGIN" rev-parse -q --verify "refs/heads/$1" > /dev/null; }

# 1. a green landing: a pull request from land/T1 titled by the goal; main fast-forwards to the tested commit
#    (no merge commit); the candidate branch stays for GitHub to see main reach it; the pull request is not closed
setup true 1; land; r=$?
cand="$(git -C "$SCRATCH/w/w1" rev-parse HEAD)"
if [ $r = 0 ] && grep -qx 'pr|create|--repo|o/r|--base|main|--head|land/T1|--title|T1: a.txt says hello|--body-file|.*' "$CALLS"; then
  ok "a landing opens a pull request from land/T1 to main, titled by the task"
else fail "no pull request (r=$r): $(cat "$CALLS" 2>&1; tail -5 "$SCRATCH/out")"; fi
grep -q "land: pull request #7: https://github.com/o/r/pull/7" "$SCRATCH/out" && ok "land.sh prints the pull request's link" || fail "no link: $(tail -5 "$SCRATCH/out")"
[ "$(git -C "$ORIGIN" rev-parse main)" = "$cand" ] && [ "$(git -C "$ORIGIN" rev-list --count --merges main)" = 0 ] \
  && ok "main is the tested commit itself, fast-forward, no merge commit" || fail "main is not the candidate"
has_remote land/T1 && ok "the landed candidate branch stays until housekeeping sees it on main" || fail "land/T1 deleted"
! grep -q '^pr|close' "$CALLS" && ok "a landed pull request is not closed" || fail "closed a landed pull request"
grep -q "Opened by scripts/land.sh" "$SCRATCH/body.md" && ! grep -qiE 'co-authored-by|claude|generated with' "$SCRATCH/body.md" \
  && ok "the body says what opened it and carries no AI attribution" || fail "body: $(cat "$SCRATCH/body.md")"

# 2. a red candidate: the pull request is closed, saying why; the branch is removed; main does not move
setup false 1; before=$(git -C "$ORIGIN" rev-parse main); land; r=$?
[ $r = 1 ] && grep -q '^pr|close|7|--repo|o/r|--comment|Not landed: candidate' "$CALLS" \
  && ok "a refused landing closes its pull request with the reason" || fail "not closed (r=$r): $(cat "$CALLS")"
! has_remote land/T1 && [ "$(git -C "$ORIGIN" rev-parse main)" = "$before" ] && ok "its branch is removed and main stays" || fail "branch or main wrong"

# 3. GitHub will not open the pull request: the landing is refused, main stays, the branch is removed
setup true 1; before=$(git -C "$ORIGIN" rev-parse main); GH_FAIL=1 land; r=$?
[ $r = 1 ] && grep -q "REFUSED by gate pull-request" "$SCRATCH/out" && grep -q "HTTP 422" "$SCRATCH/out" && [ "$(git -C "$ORIGIN" rev-parse main)" = "$before" ] && ! has_remote land/T1 \
  && ok "no pull request means no landing" || fail "gh failure (r=$r): $(tail -5 "$SCRATCH/out")"

# 5. an open pull request already on land/T1 (left by a run that died or was refused): the run reuses it, says so,
#    retitles it from this run's task, and lands; no refusal, no second pull request
setup true 1; GH_OPEN=9 land; r=$?
[ $r = 0 ] && grep -q "land: pull request #9 was already open on land/T1; this run reuses it" "$SCRATCH/out" \
  && grep -q "land: pull request #9: https://github.com/o/r/pull/9" "$SCRATCH/out" && ! grep -q '^pr|create' "$CALLS" \
  && grep -qx 'pr|list|--repo|o/r|--head|land/T1|--state|open|--json|number|--jq|.\[\].number' "$CALLS" \
  && ok "an open pull request on the branch is reused in the same run, with a logged line" || fail "stale open pull request (r=$r): $(cat "$CALLS" 2>&1; tail -5 "$SCRATCH/out")"
grep -qx 'pr|edit|9|--repo|o/r|--title|T1: a.txt says hello|--body-file|.*' "$CALLS" && grep -q "Opened by scripts/land.sh" "$SCRATCH/body.md" \
  && ok "the reused pull request gets this run's title and body" || fail "not retitled: $(cat "$CALLS")"
setup false 1; GH_OPEN=9 land; r=$?
[ $r = 1 ] && grep -q '^pr|close|9|--repo|o/r|--comment|Not landed: candidate' "$CALLS" \
  && ok "a refused run closes the reused pull request with the reason" || fail "reused not closed (r=$r): $(cat "$CALLS")"

# 4. off unless land.conf sets PULL_REQUESTS: gh is never called, and the candidate branch is removed as before
setup true ""; land; r=$?
[ $r = 0 ] && [ ! -s "$CALLS" ] && ! has_remote land/T1 && ok "PULL_REQUESTS unset: no gh call, branch removed" || fail "off (r=$r): $(cat "$CALLS" 2>&1)"

[ $fails = 0 ] && { echo "land-pull-request.e2e: all passed"; exit 0; }
echo "land-pull-request.e2e: $fails failed"; exit 1
