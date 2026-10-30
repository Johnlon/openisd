#!/usr/bin/env bash
# The land.sh gate-files check: a diff touching a GATE_FILES glob refuses `gates` unless the task has
# gates_approved: QO<n> and that board item has a thread entry by John. Scratch repo, real git, fake
# gates, its own QUESTIONS_FILE. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-gates.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# setup <task extra lines> <file to change> ; GATE_FILES copied from the real land.conf
setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    cat > "$SCRATCH/questions.yml" <<'Q'
questions:
- id: QO1
  title: Gate change for T9
  thread:
  - id: QO1.c1
    by: fable
    text: please approve
  - id: QO1.c2
    by: John
    text: ok
- id: QO2
  title: Gate change for T9
  thread:
  - id: QO2.c1
    by: fable
    text: please approve
- id: QO11
  title: Unrelated item, mentions T90 only
  thread:
  - id: QO11.c1
    by: John
    text: ok
Q
    gate_files="$(grep '^GATE_FILES=' "$REPO/land.conf")"
    cat > land.conf <<CONF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_RECORD="$SCRATCH/post.lock"
QUESTIONS_FILE="$SCRATCH/questions.yml"
$gate_files
CONF
    printf 'id: T9\nowner: t\nstatus: claimed\nrelease_note: internal\ngoal: Do the thing.\ndone_test: true\nfiles:\n  - f.txt\n%s' "${1:-}" > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
    mkdir -p "$(dirname "$2")"; echo 1 > "$2"; git add -A; git commit -qm wip
}
land() { timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; echo $?; }
refused_gates() { [ "$1" = 1 ] && grep -q 'REFUSED by gate gates:' "$SCRATCH/out"; }

setup "" f.txt; r=$(land)
[ "$r" = 0 ] && ok "1 non-gate file lands" || fail "1 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" tsconfig.json; r=$(land)
if refused_gates "$r" && grep -q 'tsconfig.json' "$SCRATCH/out" && grep -q 'John approves gate changes' "$SCRATCH/out"; then ok "2 tsconfig.json without field refuses gates"; else fail "2 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

setup $'gates_approved: QO99\n' tsconfig.json; r=$(land)
refused_gates "$r" && ok "3 QO absent from the board refuses" || fail "3 (r=$r)"

setup $'gates_approved: QO2\n' tsconfig.json; r=$(land)
refused_gates "$r" && ok "4 QO with only agent comments refuses" || fail "4 (r=$r)"

setup $'gates_approved: QO1\n' tsconfig.json; r=$(land)
[ "$r" = 0 ] && ok "5 QO with a by: John entry lands" || fail "5 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" packages/ui/coverage-baseline.json; r=$(land)
[ "$r" = 0 ] && ok "6 coverage-baseline.json alone lands" || fail "6 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" packages/design/vitest.coverage.config.ts; r=$(land)
refused_gates "$r" && ok "7 packages/design/vitest.coverage.config.ts refuses" || fail "7 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup $'gates_approved: QO11\n' scripts/coverage-x.sh; r=$(land)
refused_gates "$r" && ok "8 John-answered QO that names T90, not T9, refuses" || fail "8 (r=$r)"

setup "" tsconfig.json; sed -i '/^GATE_FILES=/d' land.conf; git add -A; git commit -qm nogf; r=$(land)
if refused_gates "$r" && grep -q 'GATE_FILES is not set in land.conf' "$SCRATCH/out"; then ok "9 unset GATE_FILES refuses"; else fail "9 (r=$r)"; fi

[ $fails = 0 ] && { echo "land-gates: all passed"; exit 0; }
echo "land-gates: $fails failed"; exit 1
