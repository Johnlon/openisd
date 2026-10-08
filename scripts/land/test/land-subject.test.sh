#!/usr/bin/env bash
# T021: the commit land.sh makes of the worker's uncommitted work carries the task's goal as its
# subject ("<id>: <goal>"), never "work in progress, committed by land.sh". A landing with nothing
# uncommitted makes no commit of its own. Scratch repo, real git. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-subject.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" scripts/; cp -r "$REPO/scripts/land" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    cat > land.conf <<EOF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
EOF
    printf 'id: T9\nowner: t\nstatus: open\ngoal: Make the thing say what it did.\ndone_test: true\nfiles:\n  - f.txt\n' > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
}
subjects() { git -C "$SCRATCH/w/origin.git" log --format=%s "$1..main"; }

# 1. uncommitted work: land.sh's own commit is "T9: <goal>"
setup; base=$(git rev-parse HEAD); echo change > f.txt
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
s=$(subjects "$base")
if [ $r = 0 ] && [ "$s" = "T9: Make the thing say what it did." ]; then ok "land.sh's commit subject is '<id>: <goal>'"
else fail "subject (r=$r): '$s' $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-160)"; fi

# 2. the worker's own commit keeps its subject and land.sh adds none
setup; base=$(git rev-parse HEAD); echo change > f.txt; git add -A; git commit -qm "the worker's own words"
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
s=$(subjects "$base")
if [ $r = 0 ] && [ "$s" = "the worker's own words" ]; then ok "a worker's commit keeps its subject; none added"
else fail "own commit (r=$r): '$s'"; fi

[ $fails = 0 ] && { echo "land-subject: all passed"; exit 0; }
echo "land-subject: $fails failed"; exit 1
