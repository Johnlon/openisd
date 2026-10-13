#!/usr/bin/env bash
# T091: check-commit passes the one `landed: <sha>` line land.sh writes into an EARLIER task's file
# during a later landing (bugs/BUG_20261013_land-stamps-previous-task-outside-allowlist.md), and
# still refuses any other change to a task file outside the allowlist. Scratch repo, real git.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/check-commit-landed.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/r"; mkdir -p "$SCRATCH/r"; cd "$SCRATCH/r" || exit 2
    git init -q -b main; git config user.email t@t; git config user.name t
    mkdir -p scripts tasks src
    cp -r "$REPO/scripts/land" scripts/
    echo .task > .gitignore
    echo 1 > src/x.ts
    printf 'id: T1\nowner: t\nstatus: done\ngoal: g\ndone_test: true\nfiles:\n  - src/**\n' > tasks/T1.yml
    printf 'id: T2\nowner: t\nstatus: claimed\ngoal: g\ndone_test: true\nfiles:\n  - src/**\n' > tasks/T2.yml
    git add -A; git commit -qm base
    echo T2 > .task
}
check() { timeout 60 bash scripts/land/task-gates/check-commit.sh > "$SCRATCH/out" 2>&1; }

# a. land.sh's stamp on the earlier task passes
setup; echo 2 > src/x.ts; printf 'landed: %s\n' "$(git rev-parse HEAD)" >> tasks/T1.yml; git add -A
check; r=$?
[ $r = 0 ] && ok "landed stamp on T1 passes while landing T2" || fail "landed stamp refused (r=$r): $(cat "$SCRATCH/out")"

# b. any other edit to the earlier task file still refuses
setup; echo 2 > src/x.ts; sed -i 's/^goal: g$/goal: rewritten/' tasks/T1.yml; git add -A
check; r=$?
[ $r = 1 ] && grep -q 'tasks/T1.yml' "$SCRATCH/out" && ok "other edit to T1 refused" || fail "other edit (r=$r): $(cat "$SCRATCH/out")"

# c. a stamp plus another change refuses too
setup; printf 'landed: %s\nowner: x\n' "$(git rev-parse HEAD)" >> tasks/T1.yml; git add -A
check; r=$?
[ $r = 1 ] && ok "stamp plus another line refused" || fail "stamp plus line (r=$r)"

# d. a new task file outside the allowlist still refuses
setup; printf 'id: T3\nlanded: %s\n' "$(git rev-parse HEAD)" > tasks/T3.yml; git add -A
check; r=$?
[ $r = 1 ] && ok "new task file refused" || fail "new task file (r=$r)"

[ "$fails" -eq 0 ] && echo "check-commit-landed-stamp.test: all passed" || { echo "check-commit-landed-stamp.test: $fails failed"; exit 1; }
