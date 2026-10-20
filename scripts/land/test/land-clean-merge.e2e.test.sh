#!/usr/bin/env bash
# T498: land.sh puts a branch that merges cleanly with origin/main onto it as one commit, even when
# replaying the branch's commits one by one would conflict. A branch that really conflicts still
# blocks (exit 3). Scratch repo, real git, fake gates. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-clean-merge.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"
export OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_STATE_DIR"
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
    cp "${LAND_SH:-$REPO/scripts/land.sh}" scripts/land.sh; cp "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    printf '#!/usr/bin/env bash\nif grep -qi "^co-authored-by:"; then echo "AI attribution"; exit 1; fi\n' > gates/attr.sh
    cat > land.conf <<CONF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"
ATTRIBUTION_CMD="bash gates/attr.sh"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
CONF
    printf 'id: T9\nowner: t\nstatus: claimed\nrelease_note: internal\ngoal: Make the thing.\ndone_test: true\nfiles:\n  - f.txt\n' > tasks/T9.yml
    seq 1 10 > f.txt
    git add -A; git commit -qm base; git push -q origin main
}
# main_edit <sed-script>: another agent lands an edit to f.txt on origin/main
main_edit() {
    git clone -q "$SCRATCH/w/origin.git" "$SCRATCH/w/o" 2>/dev/null
    ( cd "$SCRATCH/w/o" && git config user.email t@t && git config user.name t \
      && sed -i "$1" f.txt && git commit -qam "other" && git push -q origin main )
    rm -rf "$SCRATCH/w/o"
}
show() { git -C "$SCRATCH/w/origin.git" show "main:$1"; }

# 1. A edits line 2, B reverts it and edits line 9; main edits line 2: the final tree merges cleanly
setup
sed -i 2s/.*/A/ f.txt; git add -A; git commit -qm "wip A"
sed -i 2s/.*/2/ f.txt; sed -i 9s/.*/B/ f.txt; git add -A; git commit -qm "wip B"
main_edit 2s/.*/M/
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(show f.txt | sed -n 2p)" = M ] && [ "$(show f.txt | sed -n 9p)" = B ]; then ok "clean merge lands though commit A alone would conflict"
else fail "clean merge (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

# 2. a real conflict still blocks with exit 3
setup
sed -i 2s/.*/A/ f.txt; git add -A; git commit -qm "wip A"
main_edit 2s/.*/M/
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 3 ] && git show HEAD:tasks/T9.yml | grep -q '^status: blocked'; then ok "real conflict exits 3, task blocked"
else fail "real conflict (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

# 3. a clean-merge branch carrying another task's commit refuses mixed, nothing pushed
setup; base=$(git -C "$SCRATCH/w/origin.git" rev-parse main)
echo x > g.txt; git add -A; git commit -qm "T8: x"
sed -i 9s/.*/B/ f.txt; git add -A; git commit -qm "wip B"
main_edit 2s/.*/M/
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && grep -q 'REFUSED by gate mixed' "$SCRATCH/out"; then ok "clean-merge branch with another task's commit refuses mixed"
else fail "mixed (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

# 4. a clean-merge branch whose commit body has a Co-Authored-By line is refused by the attribution gate
setup
sed -i 9s/.*/B/ f.txt; git add -A; git commit -qm "wip B" -m "Co-Authored-By: Some Bot <bot@example.com>"
main_edit 2s/.*/M/
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && grep -q 'REFUSED by gate attribution' "$SCRATCH/out"; then ok "clean-merge branch with a Co-Authored-By line refuses attribution"
else fail "attribution (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

[ $fails = 0 ] && { echo "land-clean-merge: all passed"; exit 0; }
echo "land-clean-merge: $fails failed"; exit 1
