#!/usr/bin/env bash
# T001 acceptance (locked; author lots). End-to-end test of scripts/land.sh in a scratch repo with
# real git, real processes and two concurrent landings. Exit 0 = every case passed.
# T064 changed three expectations (concurrent, fast-forward, fixes): a task now lands as one squashed
# commit "<id>: <goal>", so the workers' own subjects and merge commits no longer reach main.
#
# Contract under test:
#   bash scripts/land.sh <task-id>       run from a worker's own clone of the repo
#   exit 0  landed: origin/main == the task branch rebased onto origin/main, pushed
#   exit 1  refused by a gate; main untouched; message names the gate
#   exit 3  blocked (rebase conflict); rebase aborted; task file status: blocked + blocked_reason;
#           worktree committed and clean
# Config: land.conf at the repo root (shell assignments), read by land.sh:
#   LINT_CMD        run with the changed files (vs origin/main) as arguments, nothing else
#   TYPECHECK_CMD   run with no arguments
#   ATTRIBUTION_CMD run once per new commit message, the message on stdin
#   GATE_DEADLINE_S each gate's own deadline; a gate past it is refused (fail closed)
#   LAND_LOCK       lock file serialising landings (flock)
# Task file tasks/<id>.yml: id, owner, status, goal, done_test, locked (list of path + sha256),
#   files, label (optional; "fixes" lets a landing pass an open fixes task).
# Open fixes task: any tasks/fixes/*.yml with status: open.
set -uo pipefail
# Independent of the user's git config (core.autocrlf=true would check scripts out with CRLF).
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-e2e.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"  # never the machine's own runtime state
PGID_FILE="$SCRATCH/pgids"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT

ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# --- scratch world: a bare origin and two worker clones carrying land.sh from the repo under test
setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git seed 2>/dev/null; cd seed || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" scripts/
    cp -r "$REPO/scripts/land" scripts/
    cp -r "$REPO/scripts/visual" "$REPO/scripts/feedback" scripts/
    cp "$REPO/scripts/paths.sh" scripts/
    cp -r "$REPO/scripts/lib" scripts/
    cat > gates/lint.sh <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$GATE_LOG/lint.args"
[ -f "$GATE_LOG/lint.fail" ] && exit 1
[ -f "$GATE_LOG/lint.hang" ] && { echo $$ >> "$GATE_LOG/pids"; sleep 300 & echo $! >> "$GATE_LOG/pids"; wait; }
exit 0
EOF
    cat > gates/typecheck.sh <<'EOF'
#!/usr/bin/env bash
[ -f "$GATE_LOG/typecheck.fail" ] && exit 1; exit 0
EOF
    cat > gates/attribution.sh <<'EOF'
#!/usr/bin/env bash
! grep -qi '^co-authored-by:.*claude'
EOF
    cat > gates/unit.sh <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$GATE_LOG/unit.args"
[ -f "$GATE_LOG/unit.fail" ] && exit 1; exit 0
EOF
    cat > gates/architecture.sh <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$GATE_LOG/architecture.args"
[ -f "$GATE_LOG/architecture.fail" ] && exit 1; exit 0
EOF
    chmod +x gates/*.sh
    cat > land.conf <<EOF
LINT_CMD="bash gates/lint.sh"
TYPECHECK_CMD="bash gates/typecheck.sh"
UNIT_CMD="bash gates/unit.sh"
ARCHITECTURE_CMD="bash gates/architecture.sh"
CANDIDATE_CMD="true"   # the candidate gate is tested in land-candidate.e2e.test.sh
ATTRIBUTION_CMD="bash gates/attribution.sh"
GATE_DEADLINE_S=5
LAND_LOCK="$SCRATCH/land.lock"
EOF
    touch tasks/.keep tasks/fixes/.keep
    echo base > a.txt; echo base > b.txt; echo spec > spec.sh
    git add -A; git commit -qm base; git push -q origin main
    cd ..
    for w in w1 w2; do git clone -q origin.git $w; git -C $w config user.email t@t; git -C $w config user.name t; done
    export GATE_LOG="$SCRATCH/gatelog"; rm -rf "$GATE_LOG"; mkdir -p "$GATE_LOG"
}

# task <clone> <id> <files-glob> [done_test] [label]
task() {
    local c=$1 id=$2 glob=$3 dt=${4:-true} label=${5:-}
    local h; h=$(sha256sum "$SCRATCH/w/$c/spec.sh" | cut -d' ' -f1)
    cat > "$SCRATCH/w/$c/tasks/$id.yml" <<EOF
id: $id
owner: test
status: claimed
goal: test task
done_test: $dt
locked:
  - path: spec.sh
    sha256: $h
files:
  - $glob
${label:+label: $label}
EOF
    git -C "$SCRATCH/w/$c" add "tasks/$id.yml"; git -C "$SCRATCH/w/$c" commit -qm "task $id"
}
edit() { echo "$3" >> "$SCRATCH/w/$1/$2"; }
land() { (cd "$SCRATCH/w/$1" && timeout 120 bash scripts/land.sh "$2" >"$SCRATCH/out.$1" 2>&1); }
origin_has() { git -C "$SCRATCH/w/origin.git" log --format=%s main | grep -F "$1" > /dev/null; }  # not -q: with pipefail a -q early exit SIGPIPEs git
origin_head() { git -C "$SCRATCH/w/origin.git" rev-parse main; }

# 1. two concurrent landings both land, one after the other
setup
task w1 T1 a.txt; edit w1 a.txt one; git -C "$SCRATCH/w/w1" commit -qam "w1 change"
task w2 T2 b.txt; edit w2 b.txt two; git -C "$SCRATCH/w/w2" commit -qam "w2 change"
cd "$SCRATCH"; land w1 T1 & p1=$!; land w2 T2 & p2=$!
wait $p1; r1=$?; wait $p2; r2=$?
if [ $r1 = 0 ] && [ $r2 = 0 ] && origin_has "T1: test task" && origin_has "T2: test task" \
   && [ "$(git -C "$SCRATCH/w/origin.git" rev-list --count main)" -ge 3 ] \
   && git -C "$SCRATCH/w/origin.git" log --format=%P main | awk 'NF>1{exit 1}'; then
    ok "concurrent landings both land, linear history"
else fail "concurrent landings (r1=$r1 r2=$r2)"; fi

# 1b. a branch already on top of origin/main, with a merge commit in its history, lands without a rebase
setup
task w1 T1 a.txt; edit w1 a.txt one; git -C "$SCRATCH/w/w1" commit -qam "w1 change"
git -C "$SCRATCH/w/w1" checkout -qb side HEAD~1; edit w1 b.txt side; git -C "$SCRATCH/w/w1" commit -qam "side change"
git -C "$SCRATCH/w/w1" checkout -q main; git -C "$SCRATCH/w/w1" merge -q --no-ff -m "merge side" side
land w1 T1; r=$?
if [ $r = 0 ] && [ "$(origin_head)" = "$(git -C "$SCRATCH/w/w1" rev-parse HEAD)" ] && origin_has "T1: test task" && ! origin_has "merge side"; then
    ok "a branch on top of origin/main lands without a rebase, squashed into one commit"
else fail "fast-forward branch (r=$r): $(tr '\n' ' ' < "$SCRATCH/out.w1" | cut -c1-200)"; fi

# 2. uncommitted work is committed, never discarded
setup
task w1 T1 a.txt; edit w1 a.txt uncommitted
land w1 T1; r=$?
if [ $r = 0 ] && git -C "$SCRATCH/w/origin.git" show main:a.txt | grep -q uncommitted \
   && [ -z "$(git -C "$SCRATCH/w/w1" status --porcelain)" ]; then
    ok "uncommitted work committed and landed"
else fail "uncommitted work (r=$r)"; fi

# 3. rebase conflict: abort, blocked, committed, main untouched
setup
edit w2 a.txt theirs; git -C "$SCRATCH/w/w2" commit -qam theirs; git -C "$SCRATCH/w/w2" push -q origin main
before=$(origin_head)
task w1 T1 a.txt; edit w1 a.txt mine; git -C "$SCRATCH/w/w1" commit -qam mine
land w1 T1; r=$?
if [ $r = 3 ] && [ "$(origin_head)" = "$before" ] \
   && [ ! -d "$SCRATCH/w/w1/.git/rebase-merge" ] && [ ! -d "$SCRATCH/w/w1/.git/rebase-apply" ] \
   && grep -q '^status: blocked' "$SCRATCH/w/w1/tasks/T1.yml" \
   && grep -q '^blocked_reason: .' "$SCRATCH/w/w1/tasks/T1.yml" \
   && [ -z "$(git -C "$SCRATCH/w/w1" status --porcelain)" ]; then
    ok "conflict blocks, aborts rebase, main untouched"
else fail "conflict (r=$r)"; fi

# 4. each gate failing refuses and names the gate
for g in lint typecheck unit architecture; do
    setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
    touch "$GATE_LOG/$g.fail"; before=$(origin_head)
    land w1 T1; r=$?
    if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -qi "$g" "$SCRATCH/out.w1"; then
        ok "$g failure refuses"; else fail "$g failure (r=$r)"; fi
done
setup; task w1 T1 a.txt "false"; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -qi "done_test" "$SCRATCH/out.w1"; then
    ok "done_test failure refuses"; else fail "done_test failure (r=$r)"; fi
setup; task w1 T1 a.txt; edit w1 a.txt x
git -C "$SCRATCH/w/w1" commit -qam "x
Co-Authored-By: Claude <noreply@anthropic.com>"
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -qi "attribution" "$SCRATCH/out.w1"; then
    ok "attribution failure refuses"; else fail "attribution failure (r=$r)"; fi

# 5. a gate past its deadline is refused (fail closed) and leaves no process behind
setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
touch "$GATE_LOG/lint.hang"; before=$(origin_head)
land w1 T1; r=$?
alive=0; for pid in $(cat "$GATE_LOG/pids" 2>/dev/null); do kill -0 "$pid" 2>/dev/null && alive=1; done
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && [ $alive = 0 ]; then
    ok "hung gate refused at deadline, killed"; else fail "hung gate (r=$r alive=$alive)"; fi

# 6. lint and unit get exactly the changed files
setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
land w1 T1
if diff <(printf 'a.txt\ntasks/T1.yml\n') <(sort "$GATE_LOG/lint.args") >/dev/null; then
    ok "lint scoped to changed files"; else fail "lint args: $(tr '\n' ' ' < "$GATE_LOG/lint.args")"; fi
if diff <(printf 'a.txt\ntasks/T1.yml\n') <(sort "$GATE_LOG/unit.args") >/dev/null; then
    ok "unit gate gets the changed files"; else fail "unit args: $(tr '\n' ' ' < "$GATE_LOG/unit.args" 2>/dev/null)"; fi

# 6b. the unit gate is mandatory (SDLC S1): a land.conf without UNIT_CMD refuses, main untouched
setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
sed -i '/^UNIT_CMD=/d' "$SCRATCH/w/w1/land.conf"
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -q "UNIT_CMD" "$SCRATCH/out.w1"; then
    ok "missing UNIT_CMD refuses"; else fail "missing UNIT_CMD (r=$r)"; fi

# 6b2. the architecture gate is mandatory and runs on a landing that changes no package file
setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
land w1 T1; r=$?
if [ $r = 0 ] && [ -f "$GATE_LOG/architecture.args" ]; then
    ok "architecture gate runs whatever changed"; else fail "architecture gate not run (r=$r)"; fi
setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
sed -i '/^ARCHITECTURE_CMD=/d' "$SCRATCH/w/w1/land.conf"
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -q "ARCHITECTURE_CMD" "$SCRATCH/out.w1"; then
    ok "missing ARCHITECTURE_CMD refuses"; else fail "missing ARCHITECTURE_CMD (r=$r)"; fi

# 6b3. the candidate gate is mandatory: a land.conf without CANDIDATE_CMD refuses, main untouched
setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
sed -i '/^CANDIDATE_CMD=/d' "$SCRATCH/w/w1/land.conf"
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -q "CANDIDATE_CMD" "$SCRATCH/out.w1"; then
    ok "missing CANDIDATE_CMD refuses"; else fail "missing CANDIDATE_CMD (r=$r)"; fi

# 6c. a done_test that names a browser spec is refused before it runs (T036, 11 Oct 2026)
setup; task w1 T1 a.txt "bash scripts/test.sh packages/ui/test/ui/x.browser.spec.ts"
edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -q "browser spec" "$SCRATCH/out.w1"; then
    ok "browser spec in done_test refused"; else fail "browser done_test (r=$r)"; fi

# 6d. baselines (scripts/visual/): a task changes exactly the screens it lists under visual:, and a landing leaves a page
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
SNAP=packages/ui/test/visual/visual.browser.spec.ts-snapshots
setup; mkdir -p "$SCRATCH/w/w1/$SNAP"; printf one > "$SCRATCH/w/w1/$SNAP/mobile-a.png"
git -C "$SCRATCH/w/w1" add -A; git -C "$SCRATCH/w/w1" commit -qm "baseline"; git -C "$SCRATCH/w/w1" push -q origin main
task w1 T1 "*"; printf two > "$SCRATCH/w/w1/$SNAP/mobile-a.png"; git -C "$SCRATCH/w/w1" commit -qam "change a screen"
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -q "visual" "$SCRATCH/out.w1" && grep -q "mobile-a" "$SCRATCH/out.w1"; then
    ok "a changed baseline the task does not list is refused, naming the screen"; else fail "unlisted baseline (r=$r): $(cat "$SCRATCH/out.w1")"; fi
printf 'visual:\n  - mobile-a\n' >> "$SCRATCH/w/w1/tasks/T1.yml"; git -C "$SCRATCH/w/w1" commit -qam "list the screen"
land w1 T1; r=$?
if [ $r = 0 ] && grep -q "land: visual changes: http://example.test/pages/T1-" "$SCRATCH/out.w1" && ls "$VISUAL_PAGES_DIR"/T1-*/mobile-a.before.png > /dev/null 2>&1; then
    ok "a listed baseline change lands and publishes its before/after page"; else fail "listed baseline (r=$r): $(cat "$SCRATCH/out.w1")"; fi

# 6e. a task that changes UI sources without re-taking the baselines on them is refused (scripts/visual/check-sources.sh)
setup; task w1 T1 "*"; mkdir -p "$SCRATCH/w/w1/packages/ui/src"; echo '<template>a</template>' > "$SCRATCH/w/w1/packages/ui/src/A.vue"
git -C "$SCRATCH/w/w1" add -A; git -C "$SCRATCH/w/w1" commit -qm "change a source"
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -q "visual-sources" "$SCRATCH/out.w1" && grep -q "A.vue" "$SCRATCH/out.w1"; then
    ok "a UI source change without re-taken baselines is refused, naming the file"; else fail "source change (r=$r): $(cat "$SCRATCH/out.w1")"; fi
(cd "$SCRATCH/w/w1" && . scripts/visual/lib.sh && visual_sources_hash > "$VISUAL_SOURCES_HASH_FILE" 2>/dev/null; mkdir -p "$(dirname "$VISUAL_SOURCES_HASH_FILE")"; visual_sources_hash > "$VISUAL_SOURCES_HASH_FILE")
git -C "$SCRATCH/w/w1" add -A; git -C "$SCRATCH/w/w1" commit -qm "re-take"
land w1 T1; r=$?
if [ $r = 0 ]; then ok "the same change lands once the hash matches"; else fail "re-taken source change (r=$r): $(cat "$SCRATCH/out.w1")"; fi

# 7. a branch that changed a locked file or its own done_test is refused
setup; task w1 T1 "*"; edit w1 spec.sh weakened; git -C "$SCRATCH/w/w1" commit -qam weaken
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -qi "locked" "$SCRATCH/out.w1"; then
    ok "locked file change refused"; else fail "locked file (r=$r)"; fi
setup; task w1 T1 "*"; git -C "$SCRATCH/w/w1" push -q origin main
sed -i 's/^done_test: .*/done_test: true # weakened/' "$SCRATCH/w/w1/tasks/T1.yml"
git -C "$SCRATCH/w/w1" commit -qam "edit done_test"
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -qi "done_test" "$SCRATCH/out.w1"; then
    ok "own done_test edit refused"; else fail "done_test edit (r=$r)"; fi

# 8. an open fixes task refuses ordinary landings, not a fixes landing
setup
printf 'id: F1\nstatus: open\ngoal: red main\n' > "$SCRATCH/w/w2/tasks/fixes/F1.yml"
git -C "$SCRATCH/w/w2" add -A; git -C "$SCRATCH/w/w2" commit -qm F1; git -C "$SCRATCH/w/w2" push -q origin main
task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
before=$(origin_head); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_head)" = "$before" ] && grep -qi "fixes" "$SCRATCH/out.w1"; then
    ok "open fixes task refuses"; else fail "fixes refusal (r=$r)"; fi
# fresh clones: the refused T1 landing above left w1 holding T1's squashed commit (mixed with T2)
setup
printf 'id: F1\nstatus: open\ngoal: red main\n' > "$SCRATCH/w/w2/tasks/fixes/F1.yml"
git -C "$SCRATCH/w/w2" add -A; git -C "$SCRATCH/w/w2" commit -qm F1; git -C "$SCRATCH/w/w2" push -q origin main
git -C "$SCRATCH/w/w1" pull -q --rebase origin main
task w1 T2 a.txt true fixes; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x; land w1 T2; r=$?
if [ $r = 0 ]; then ok "fixes-labelled landing passes"; else fail "fixes landing (r=$r)"; fi

[ $fails = 0 ] && { echo "land.e2e: all passed"; exit 0; }
echo "land.e2e: $fails failed"; exit 1
