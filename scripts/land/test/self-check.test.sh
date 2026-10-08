#!/usr/bin/env bash
# land.sh --self-check: every locked sha256 in tasks/*.yml matches its file. A hash of `pending` is
# reported, not failed. A mismatch, or a missing file with a real hash, fails (exit 1).
# Not one of the locked T001-T005 specs.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/self-check.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/r"; mkdir -p "$SCRATCH/r"; cd "$SCRATCH/r" || exit 2
    git init -q; mkdir -p scripts tasks/fixes
    cp "$REPO/scripts/land.sh" scripts/; cp -r "$REPO/scripts/land" scripts/
    printf 'LAND_LOCK=%s/l\n' "$SCRATCH" > land.conf
    echo spec > spec.sh
    git add -A; git commit -qm base
}
hash() { sha256sum "$1" | cut -d' ' -f1; }
task() { # task <id> <path> <sha>
    printf 'id: %s\nowner: t\nstatus: open\ngoal: g\ndone_test: true\nlocked:\n  - path: %s\n    sha256: %s\nfiles:\n  - a\n' "$1" "$2" "$3" > "tasks/$1.yml"
}
check() { timeout 60 bash scripts/land.sh --self-check > "$SCRATCH/out" 2>&1; }

setup; task T1 spec.sh "$(hash spec.sh)"; check; r=$?
[ $r = 0 ] && ok "matching hash passes" || fail "matching hash (r=$r)"

setup; task T1 spec.sh "$(hash spec.sh)"; echo more >> spec.sh; check; r=$?
if [ $r = 1 ] && grep -q "T1" "$SCRATCH/out" && grep -q "spec.sh" "$SCRATCH/out"; then
    ok "changed file fails, naming task and file"; else fail "changed file (r=$r)"; fi

setup; task T1 gone.sh "$(hash spec.sh)"; check; r=$?
[ $r = 1 ] && ok "missing file with a real hash fails" || fail "missing file (r=$r)"

setup; task T1 gone.sh pending; check; r=$?
if [ $r = 0 ] && grep -qi "pending" "$SCRATCH/out" && grep -q "T1" "$SCRATCH/out"; then
    ok "pending is reported, not failed"; else fail "pending (r=$r)"; fi

setup; printf 'id: T2\nowner: t\nstatus: open\ngoal: g\ndone_test: true\nlocked: []\nfiles:\n  - a\n' > tasks/T2.yml; check; r=$?
[ $r = 0 ] && ok "a task with no locked files passes" || fail "no locked files (r=$r)"

[ $fails = 0 ] && { echo "self-check: all passed"; exit 0; }
echo "self-check: $fails failed"; exit 1
