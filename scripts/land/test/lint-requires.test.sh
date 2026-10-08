#!/usr/bin/env bash
# land.sh: a lint gate whose land.conf sets LINT_REQUIRES refuses with a clear message, naming the
# missing path, instead of running lint with a stray tool (2026-10-08: a worktree without
# node_modules linted with ESLint 6). Not one of the locked T001-T005 specs.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/lint-requires.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    mkdir -p scripts tasks/fixes; touch tasks/fixes/.keep
    cp "$REPO/scripts/land.sh" scripts/; cp -r "$REPO/scripts/land" scripts/
    cat > land.conf <<CONF
LINT_CMD="true"
TYPECHECK_CMD="true"
ATTRIBUTION_CMD="true"
GATE_DEADLINE_S=5
LAND_LOCK="$SCRATCH/land.lock"
LINT_REQUIRES="node_modules"
CONF
    printf 'id: T1\nowner: t\nstatus: claimed\ngoal: g\ndone_test: true\nlocked: []\nfiles:\n  - a.txt\n' > tasks/T1.yml
    echo base > a.txt; echo node_modules > .gitignore
    git add -A; git commit -qm base; git push -q origin main
    echo change >> a.txt; git commit -qam change
}

setup
timeout 60 bash scripts/land.sh T1 > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && grep -q "node_modules" "$SCRATCH/out" && grep -qi "new-worktree" "$SCRATCH/out" \
   && [ "$(git -C "$SCRATCH/w/origin.git" log --format=%s main | head -1)" = base ]; then
    ok "missing node_modules refuses the lint gate, names it and the fix"; else fail "missing node_modules (r=$r: $(cat "$SCRATCH/out"))"; fi

mkdir node_modules
timeout 60 bash scripts/land.sh T1 > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ]; then ok "node_modules present: lands"; else fail "node_modules present (r=$r: $(cat "$SCRATCH/out"))"; fi

[ $fails = 0 ] && { echo "lint-requires: all passed"; exit 0; }
echo "lint-requires: $fails failed"; exit 1
