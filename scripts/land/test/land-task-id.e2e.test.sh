#!/usr/bin/env bash
# T323, processes.md rule 7: a task id is its own task's. land.sh refuses a branch whose tasks/<id>.yml would
# replace another owner's file on main (17 Oct 2026: a second "T321" overwrote a landed T321's record), and lets
# an owner re-land their own id. End to end in a scratch repo: the real land.sh, real git.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-task-id.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"  # never the machine's own runtime state
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
ORIGIN="$SCRATCH/w/origin.git"

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git seed 2>/dev/null; cd seed || exit 2
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/
    cp -r "$REPO/scripts/land" "$REPO/scripts/visual" "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh
    printf '#!/usr/bin/env bash\n! grep -qi "^co-authored-by:.*claude"\n' > gates/attribution.sh
    cat > land.conf <<EOF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/attribution.sh"
CANDIDATE_CMD="true"
GATE_DEADLINE_S=60
LAND_LOCK="$SCRATCH/land.lock"
EOF
    touch tasks/.keep tasks/fixes/.keep; echo base > a.txt; echo base > b.txt
    git add -A; git commit -qm base; git push -q origin main
    cd ..
    for w in w1 w2; do git clone -q origin.git $w; git -C $w config user.email t@t; git -C $w config user.name t; done
}
# task <clone> <id> <owner> <file>: a task that edits one file, committed in the clone
task() {
    cat > "$SCRATCH/w/$1/tasks/$2.yml" <<EOF
id: $2
owner: $3
status: claimed
goal: $3 changes $4
done_test: true
files:
  - $4
EOF
    echo "$3" >> "$SCRATCH/w/$1/$4"
    git -C "$SCRATCH/w/$1" add -A; git -C "$SCRATCH/w/$1" commit -qm "work $2 by $3"
}
land() { (cd "$SCRATCH/w/$1" && timeout 120 bash scripts/land.sh "$2" > "$SCRATCH/out.$1" 2>&1); }
main_owner() { git -C "$ORIGIN" show "main:tasks/$1.yml" | sed -n 's/^owner: *//p'; }

# 1. another owner's branch under a landed id is refused, and main keeps the first task's record. The second
#    branch starts from main after the first landing, as the 17 Oct one did, so no rebase conflict hides it.
setup; task w1 T1 maryu a.txt; land w1 T1 || fail "the first landing failed: $(tail -5 "$SCRATCH/out.w1")"
git -C "$SCRATCH/w/w2" pull -q origin main
task w2 T1 fable b.txt; before=$(git -C "$ORIGIN" rev-parse main); land w2 T1; r=$?
if [ $r = 1 ] && grep -q "REFUSED by gate task-id: tasks/T1.yml on main is maryu's task (maryu changes a.txt)" "$SCRATCH/out.w2" \
   && [ "$(git -C "$ORIGIN" rev-parse main)" = "$before" ] && [ "$(main_owner T1)" = maryu ]; then
    ok "another owner's task under a taken id is refused; main keeps the first record"
else fail "taken id (r=$r owner=$(main_owner T1)): $(tail -5 "$SCRATCH/out.w2")"; fi

# 2. the owner re-lands their own id: it lands
setup; task w1 T1 maryu a.txt; land w1 T1 || fail "the first landing failed: $(tail -5 "$SCRATCH/out.w1")"
git -C "$SCRATCH/w/w1" pull -q origin main; echo again >> "$SCRATCH/w/w1/a.txt"; git -C "$SCRATCH/w/w1" commit -qam "follow-up"
land w1 T1; r=$?
if [ $r = 0 ] && [ "$(main_owner T1)" = maryu ]; then ok "an owner re-lands their own id"
else fail "re-land (r=$r): $(tail -5 "$SCRATCH/out.w1")"; fi

[ $fails = 0 ] && { echo "land-task-id: all passed"; exit 0; }
echo "land-task-id: $fails failed"; exit 1
