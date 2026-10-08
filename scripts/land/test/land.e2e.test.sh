#!/usr/bin/env bash
# T001 acceptance (locked; author lots). End-to-end test of scripts/land.sh in a scratch repo with
# real git, real processes and two concurrent landings. Exit 0 = every case passed.
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
    chmod +x gates/*.sh
    cat > land.conf <<EOF
LINT_CMD="bash gates/lint.sh"
TYPECHECK_CMD="bash gates/typecheck.sh"
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
origin_has() { git -C "$SCRATCH/w/origin.git" log --format=%s main | grep -qF "$1"; }
origin_head() { git -C "$SCRATCH/w/origin.git" rev-parse main; }

# 1. two concurrent landings both land, one after the other
setup
task w1 T1 a.txt; edit w1 a.txt one; git -C "$SCRATCH/w/w1" commit -qam "w1 change"
task w2 T2 b.txt; edit w2 b.txt two; git -C "$SCRATCH/w/w2" commit -qam "w2 change"
cd "$SCRATCH"; land w1 T1 & p1=$!; land w2 T2 & p2=$!
wait $p1; r1=$?; wait $p2; r2=$?
if [ $r1 = 0 ] && [ $r2 = 0 ] && origin_has "w1 change" && origin_has "w2 change" \
   && [ "$(git -C "$SCRATCH/w/origin.git" rev-list --count main)" -ge 5 ] \
   && git -C "$SCRATCH/w/origin.git" log --format=%P main | awk 'NF>1{exit 1}'; then
    ok "concurrent landings both land, linear history"
else fail "concurrent landings (r1=$r1 r2=$r2)"; fi

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
for g in lint typecheck; do
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

# 6. lint gets exactly the changed files
setup; task w1 T1 a.txt; edit w1 a.txt x; git -C "$SCRATCH/w/w1" commit -qam x
land w1 T1
if diff <(printf 'a.txt\ntasks/T1.yml\n') <(sort "$GATE_LOG/lint.args") >/dev/null; then
    ok "lint scoped to changed files"; else fail "lint args: $(tr '\n' ' ' < "$GATE_LOG/lint.args")"; fi

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
task w1 T2 a.txt true fixes; land w1 T2; r=$?
if [ $r = 0 ]; then ok "fixes-labelled landing passes"; else fail "fixes landing (r=$r)"; fi

[ $fails = 0 ] && { echo "land.e2e: all passed"; exit 0; }
echo "land.e2e: $fails failed"; exit 1
