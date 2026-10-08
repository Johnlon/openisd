#!/usr/bin/env bash
# T002 acceptance (locked; author lots). The task-file gates, end to end in a scratch repo.
#
# Contract under test:
#   bash scripts/land/task-gates/claim.sh <id>
#       sets tasks/<id>.yml status: claimed and writes the id to .task at the clone root
#       (.task is git-ignored); exit 1, naming the other task, if any file in the repo is matched
#       by both this task's files globs and those of another task whose status is claimed;
#       exit 1 on a malformed task file (missing id, owner, status, goal, done_test or files).
#   bash scripts/land/task-gates/check-commit.sh
#       run by pre-commit; exit 1, naming each file, if a staged path is outside the files globs of
#       the task named in .task (tasks/<id>.yml itself is always allowed); exit 0 with no .task
#       (commits outside the task process, e.g. John's own, are not gated by this check).
# Globs are git pathspec globs (`:(glob)` semantics: ** crosses directories, * does not).
set -uo pipefail
# Independent of the user's git config (core.autocrlf=true would check scripts out with CRLF).
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/task-gates-e2e.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/r"; mkdir -p "$SCRATCH/r"; cd "$SCRATCH/r" || exit 2
    git init -q -b main; git config user.email t@t; git config user.name t
    mkdir -p scripts tasks src/a src/b docs
    cp -r "$REPO/scripts/land" scripts/
    echo .task > .gitignore
    echo 1 > src/a/x.ts; echo 1 > src/a/y.ts; echo 1 > src/b/z.ts; echo 1 > docs/d.md
    git add -A; git commit -qm base
}
mktask() { # mktask <id> <status> <glob...>
    local id=$1 st=$2; shift 2
    { printf 'id: %s\nowner: t\nstatus: %s\ngoal: g\ndone_test: true\nlocked: []\nfiles:\n' "$id" "$st"
      for g in "$@"; do printf '  - %s\n' "$g"; done; } > "tasks/$id.yml"
    git add "tasks/$id.yml"; git commit -qm "task $id"
}
claim() { timeout 60 bash scripts/land/task-gates/claim.sh "$1" > "$SCRATCH/out" 2>&1; }
check() { timeout 60 bash scripts/land/task-gates/check-commit.sh > "$SCRATCH/out" 2>&1; }

# 1. claim of a disjoint task succeeds and records it
setup; mktask T1 open 'src/a/**'; mktask T2 claimed 'src/b/**'
claim T1; r=$?
if [ $r = 0 ] && grep -q '^status: claimed' tasks/T1.yml && [ "$(cat .task 2>/dev/null)" = T1 ]; then
    ok "disjoint claim"; else fail "disjoint claim (r=$r)"; fi

# 2. overlapping claim refused, names the other task
setup; mktask T1 open 'src/**'; mktask T2 claimed 'src/b/**'
claim T1; r=$?
if [ $r = 1 ] && grep -q T2 "$SCRATCH/out" && grep -q '^status: open' tasks/T1.yml; then
    ok "overlapping claim refused"; else fail "overlapping claim (r=$r)"; fi

# 3. overlap with an OPEN (unclaimed) task is allowed
setup; mktask T1 open 'src/**'; mktask T2 open 'src/b/**'
claim T1; r=$?
[ $r = 0 ] && ok "overlap with open task allowed" || fail "overlap with open task (r=$r)"

# 4. malformed task file refused
setup; printf 'id: T1\nstatus: open\n' > tasks/T1.yml; git add -A; git commit -qm bad
claim T1; r=$?
[ $r = 1 ] && ok "malformed task refused" || fail "malformed task (r=$r)"

# 5. commit inside the allowlist passes; outside is refused naming the file
setup; mktask T1 open 'src/a/**'; claim T1
echo 2 >> src/a/x.ts; git add src/a/x.ts; check; r=$?
[ $r = 0 ] && ok "in-allowlist commit passes" || fail "in-allowlist commit (r=$r)"
echo 2 >> src/b/z.ts; git add src/b/z.ts; check; r=$?
if [ $r = 1 ] && grep -q 'src/b/z.ts' "$SCRATCH/out"; then
    ok "out-of-allowlist commit refused"; else fail "out-of-allowlist commit (r=$r)"; fi

# 6. single * does not cross directories
setup; mktask T1 open 'src/*'; claim T1
echo 2 >> src/a/x.ts; git add src/a/x.ts; check; r=$?
[ $r = 1 ] && ok "* does not cross directories" || fail "* crossed a directory (r=$r)"

# 7. own task file always allowed; no .task means not gated
setup; mktask T1 open 'src/a/**'; claim T1
echo 'note: x' >> tasks/T1.yml; git add tasks/T1.yml; check; r=$?
[ $r = 0 ] && ok "own task file allowed" || fail "own task file (r=$r)"
setup; echo 2 >> docs/d.md; git add docs/d.md; check; r=$?
[ $r = 0 ] && ok "no .task: not gated" || fail "no .task (r=$r)"

[ $fails = 0 ] && { echo "task-gates.e2e: all passed"; exit 0; }
echo "task-gates.e2e: $fails failed"; exit 1
