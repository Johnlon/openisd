#!/usr/bin/env bash
# land.sh runs the driver model gate (check-model-ruling.sh) from origin/main's copy, with the task id (T655):
# a ruled change lands, an unruled one refuses, and a branch that deletes the gate and drops it from GATE_FILES
# still refuses. Scratch repo, real git, fake gates.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-model-ruling.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
MODEL=packages/design/domain/openisdSchema.ts

# setup <task extra lines>: origin/main holds the real land scripts, GATE_FILES and a model file; the branch
# commits a change to the model file.
setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    mkdir -p scripts tasks/fixes gates "$(dirname "$MODEL")"
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    printf 'questions: []\n' > "$SCRATCH/questions.yml"
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
    echo a > "$MODEL"
    printf 'id: T9\nowner: t\nstatus: claimed\nrelease_note: internal\ngoal: Do the thing.\ndone_test: true\nfiles:\n  - %s\n%s' "$MODEL" "${1:-}" > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
    echo b > "$MODEL"; git add -A; git commit -qm model
}
land() { timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; echo $?; }
refused_model() { [ "$1" = 1 ] && grep -q 'REFUSED by gate model-ruling' "$SCRATCH/out"; }
says() { tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400; }

setup $'ruling: QO392\n'; r=$(land)
[ "$r" = 0 ] && ok "1 model change with ruling: QO392 lands" || fail "1 (r=$r): $(says)"

setup ""; r=$(land)
refused_model "$r" && ok "2 model change without a ruling refuses" || fail "2 (r=$r): $(says)"

setup ""
git rm -q scripts/land/check-model-ruling.sh
sed -i 's# scripts/land/check-model-ruling.sh##' land.conf
git add -A; git commit -qm "drop the gate"; r=$(land)
refused_model "$r" && ok "3 a branch that deletes the gate still refuses" || fail "3 (r=$r): $(says)"

[ $fails = 0 ] && { echo "land-model-ruling: all passed"; exit 0; }
echo "land-model-ruling: $fails failed"; exit 1
