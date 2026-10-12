#!/usr/bin/env bash
# End-to-end test of scripts/integrate.sh (SDLC S4) in a scratch repo: real git, a bare origin, a
# feature branch that did not go through land.sh. The gate commands are stubbed to fast ones in
# the scratch land.conf; the corpus commands are stubbed through INTEGRATE_CORPUS_CMD and
# INTEGRATE_PROOF_CMD. Exit 0 = every case passed.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/integrate-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/integrate-e2e.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

W="$SCRATCH/w"
export OPENISD_RUNTIME_DIR="$SCRATCH/runtime" INTEGRATE_DIR="$SCRATCH/integrate" GATE_LOG="$SCRATCH/gatelog"

setup() {
    rm -rf "$W" "$INTEGRATE_DIR" "$GATE_LOG"; mkdir -p "$W" "$GATE_LOG"; cd "$W" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git seed 2>/dev/null; cd seed || exit 2
    mkdir -p scripts tasks/fixes gates tests packages/persistence/src
    cp "$REPO/scripts/integrate.sh" "$REPO/scripts/paths.sh" scripts/
    cp -r "$REPO/scripts/land" scripts/
    for g in lint typecheck unit; do printf '#!/usr/bin/env bash\nexit 0\n' > "gates/$g.sh"; done
    cat > gates/attribution.sh <<'STUB'
#!/usr/bin/env bash
! grep -qi '^co-authored-by:.*claude'
STUB
    # scripts/test.sh stub: records its arguments, fails on a file that says FAILME
    cat > scripts/test.sh <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$@" >> "$GATE_LOG/test.args"
for f in "$@"; do ! grep -q FAILME "$f" || exit 1; done
STUB
    cat > land.conf <<CONF
LINT_CMD="bash gates/lint.sh"
TYPECHECK_CMD="bash gates/typecheck.sh"
UNIT_CMD="bash gates/unit.sh"
ATTRIBUTION_CMD="bash gates/attribution.sh"
GATE_DEADLINE_S=20
LAND_LOCK="$SCRATCH/land.lock"
CONF
    echo base > a.txt; echo base > b.txt; echo ok > tests/old.test.sh
    echo base > packages/persistence/src/openisdSchema.ts
    touch tasks/fixes/.keep
    git add -A; git commit -qm base; git push -q origin main
    cd ..
    git clone -q origin.git w1; git -C w1 config user.email t@t; git -C w1 config user.name t
    export INTEGRATE_CORPUS_CMD="echo corpus >> $GATE_LOG/corpus.ran"
    export INTEGRATE_PROOF_CMD="echo proof >> $GATE_LOG/proof.ran"
}
c1() { git -C "$W/w1" "$@"; }
branch() { c1 checkout -qb "$1"; }
back() { c1 checkout -q main; }
integrate() { (cd "$W/w1" && timeout 120 bash scripts/integrate.sh "$1" "$2" > "$SCRATCH/out" 2>&1); }
origin_head() { git -C "$W/origin.git" rev-parse main; }
origin_has() { git -C "$W/origin.git" log --format=%s main | grep -F "$1" > /dev/null; }
out_has() { grep -qi "$1" "$SCRATCH/out"; }
show_out() { tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300; }

# (a) a clean branch integrates; main advances; the branch's tests ran
setup; branch feat
echo one > "$W/w1/a.txt"; echo ok > "$W/w1/tests/new.test.ts"
printf 'id: T1\nowner: t\nstatus: claimed\ngoal: g\n' > "$W/w1/tasks/T1.yml"
c1 add -A; c1 commit -qm "feat one"; back
before=$(origin_head); integrate T1 feat; r=$?
if [ $r = 0 ] && [ "$(origin_head)" != "$before" ] && origin_has "T1: feat integrated" \
   && git -C "$W/origin.git" show main:a.txt | grep -q one \
   && git -C "$W/origin.git" log --format=%B main | grep -q "feat one" \
   && grep -q 'tests/new.test.ts' "$GATE_LOG/test.args" \
   && git -C "$W/origin.git" show main:tasks/T1.yml | grep -q '^landed: ' \
   && [ ! -e "$INTEGRATE_DIR/T1" ] && [ ! -e "$GATE_LOG/corpus.ran" ]; then
    ok "clean branch integrates, branch tests ran, no corpus"
else fail "clean branch (r=$r): $(show_out)"; fi

# (b) a branch that deletes a test is refused
setup; branch feat; c1 rm -q tests/old.test.sh; echo x > "$W/w1/b.txt"; c1 add -A; c1 commit -qm "drop test"; back
before=$(origin_head); integrate T1 feat; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && out_has "gate branch-tests" && out_has "old.test.sh"; then
    ok "deleted test refused (branch-tests)"
else fail "deleted test (r=$r): $(show_out)"; fi

# (c) a branch whose own test fails is refused
setup; branch feat; echo FAILME > "$W/w1/tests/bad.test.ts"; c1 add -A; c1 commit -qm "bad test"; back
before=$(origin_head); integrate T1 feat; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && out_has "gate branch-tests"; then
    ok "failing branch test refused (branch-tests)"
else fail "failing test (r=$r): $(show_out)"; fi

# (d) a conflicting branch exits 3, lists the paths in the task file, leaves the worktree
setup; branch feat; echo mine > "$W/w1/a.txt"; c1 commit -qam "mine"; back
echo theirs > "$W/w1/a.txt"; c1 commit -qam "theirs"; c1 push -q origin main
before=$(origin_head); integrate T1 feat; r=$?
if [ $r = 3 ] && [ "$(origin_head)" = "$before" ] && [ -d "$INTEGRATE_DIR/T1" ] \
   && grep -q '^blocked: |' "$INTEGRATE_DIR/T1/tasks/T1.yml" \
   && grep -q 'integrate: conflicts in a.txt' "$INTEGRATE_DIR/T1/tasks/T1.yml" \
   && grep -q 'never --ours/--theirs' "$INTEGRATE_DIR/T1/tasks/T1.yml"; then
    ok "conflict exits 3, task file lists a.txt, worktree left"
else fail "conflict (r=$r): $(show_out)"; fi

# (e) a schema-touching branch runs the corpus gate and the proof; a red corpus refuses
setup; branch feat; echo changed >> "$W/w1/packages/persistence/src/openisdSchema.ts"; c1 commit -qam "schema"; back
integrate T1 feat; r=$?
if [ $r = 0 ] && [ -f "$GATE_LOG/corpus.ran" ] && [ -f "$GATE_LOG/proof.ran" ]; then
    ok "schema change runs the corpus and the proof"
else fail "corpus gate (r=$r): $(show_out)"; fi
setup; branch feat; echo changed >> "$W/w1/packages/persistence/src/openisdSchema.ts"; c1 commit -qam "schema"; back
export INTEGRATE_CORPUS_CMD="false"
before=$(origin_head); integrate T1 feat; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && out_has "gate corpus"; then
    ok "red corpus refuses"
else fail "red corpus (r=$r): $(show_out)"; fi
setup; branch feat; echo 'driver_type' > "$W/w1/d.txt"; c1 add -A; c1 commit -qm "dt"; back
integrate T1 feat; r=$?
if [ $r = 0 ] && [ -f "$GATE_LOG/corpus.ran" ]; then ok "driver_type in the diff runs the corpus"; else fail "driver_type (r=$r): $(show_out)"; fi

# (f) an open fixes task refuses
setup
mkdir -p "$W/w1/tasks/fixes"
printf 'id: F1\nstatus: open\ngoal: red main\n' > "$W/w1/tasks/fixes/F1.yml"
c1 add -A; c1 commit -qm F1; c1 push -q origin main
branch feat; echo one > "$W/w1/b.txt"; c1 commit -qam "feat"; back
before=$(origin_head); integrate T1 feat; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && out_has "gate fixes"; then
    ok "open fixes task refuses"
else fail "fixes refusal (r=$r): $(show_out)"; fi

[ $fails = 0 ] && { echo "integrate.e2e: all passed"; exit 0; }
echo "integrate.e2e: $fails failed"; exit 1
