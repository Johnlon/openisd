#!/usr/bin/env bash
# The land.sh health gate: main red (tested != green) and the last green older than HEALTH_RED_MAX_MIN
# refuses `red-main` unless the task is labelled fixes; green or unknown state passes. Scratch repo,
# real git, fake gates. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-health.XXXXXX")"
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
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    cat > land.conf <<CONF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"   # the candidate gate is tested in land-candidate.e2e.test.sh
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_RECORD="$SCRATCH/post.lock"
CONF
    printf 'id: T9\nowner: t\nstatus: claimed\nrelease_note: internal\ngoal: Do the thing.\ndone_test: true\nfiles:\n  - f.txt\n%s' "${1:-}" > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
    echo 1 > f.txt; git add -A; git commit -qm wip
}
# state <green|none> <tested|none> <age minutes>
state() {
    rm -f "$SCRATCH"/post.lock.green "$SCRATCH"/post.lock.tested
    [ "$1" = none ] || { echo aaaaaaaaaaaaaaaaaaaa > "$SCRATCH/post.lock.green"; touch -d "$3 minutes ago" "$SCRATCH/post.lock.green"; }
    case "$2" in none) ;; same) echo aaaaaaaaaaaaaaaaaaaa > "$SCRATCH/post.lock.tested" ;; *) echo bbbbbbbbbbbbbbbbbbbb > "$SCRATCH/post.lock.tested" ;; esac
}
land() { timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; echo $?; }

setup; state g red 200; r=$(land)
if [ "$r" = 1 ] && grep -q 'REFUSED by gate red-main: main has been red for 200 min (last green aaaaaaaaaa)' "$SCRATCH/out" \
   && grep -q 'land: health: green aaaaaaaaaa 200m ago, tested bbbbbbbbbb, run none, load ' "$SCRATCH/out"; then ok "red + old refuses, health line printed"
else fail "red+old (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

setup $'label: fixes\n'; state g red 200; r=$(land)
if [ "$r" = 0 ]; then ok "red + old + fixes label lands"; else fail "fixes (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

setup; state g red 30; r=$(land)
if [ "$r" = 0 ]; then ok "red but recent lands"; else fail "red recent (r=$r)"; fi

setup; state g same 500; r=$(land)
if [ "$r" = 0 ] && grep -q 'health: green aaaaaaaaaa' "$SCRATCH/out"; then ok "green lands"; else fail "green (r=$r)"; fi

setup; state none none 0; r=$(land)
if [ "$r" = 0 ] && grep -q 'health: unknown' "$SCRATCH/out"; then ok "unknown lands, says unknown"; else fail "unknown (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

[ $fails = 0 ] && { echo "land-health: all passed"; exit 0; }
echo "land-health: $fails failed"; exit 1
