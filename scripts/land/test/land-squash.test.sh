#!/usr/bin/env bash
# T064: a task lands as one commit "<id>: <goal>" with the release note as body, status done written
# into it; commits naming another task refuse with `mixed`; a done task missing `landed` gets it in
# the next landing. Scratch repo, real git, fake gates. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-squash.XXXXXX")"
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
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    cat > land.conf <<CONF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
CONF
    printf 'id: T9\nowner: t\nstatus: claimed\nrelease_note: Things now say what they did.\ngoal: Make the thing say what it did. Then more.\ndone_test: true\nfiles:\n  - f.txt\n' > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
}
msg() { git -C "$SCRATCH/w/origin.git" log -1 --format="$1" main; }
count() { git -C "$SCRATCH/w/origin.git" rev-list --count "$1..main"; }

# a. three commits land as one
setup; base=$(git rev-parse HEAD)
for n in 1 2 3; do echo $n > f.txt; git add -A; git commit -qm "wip $n"; done
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
st=$(git -C "$SCRATCH/w/origin.git" show main:tasks/T9.yml | sed -n 's/^status: //p')
if [ $r = 0 ] && [ "$(count "$base")" = 1 ] && [ "$(msg %s)" = "T9: Make the thing say what it did." ] \
   && [ "$(msg %b | sed '/^$/d')" = "Things now say what they did." ] && [ "$st" = done ]; then ok "three commits land as one, status done"
else fail "squash (r=$r n=$(count "$base") st=$st): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

# b. another task's commit refuses with mixed, nothing pushed
setup; base=$(git rev-parse HEAD)
echo 1 > f.txt; git add -A; git commit -qm "T9: mine"; echo 2 > f.txt; git add -A; git commit -qm "T8: other"
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 1 ] && grep -q 'REFUSED by gate mixed' "$SCRATCH/out" && grep -q 'T8: other' "$SCRATCH/out" && [ "$(count "$base")" = 0 ]; then ok "mixed commit refuses, nothing pushed"
else fail "mixed (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

# c. a done task without landed gets it in the next landing
setup
printf 'id: T7\nowner: t\nstatus: done\ngoal: Old one.\ndone_test: true\nfiles:\n  - g.txt\n' > tasks/T7.yml
echo g > g.txt; git add -A; git commit -qm "T7: Old one."; git push -q origin main; t7=$(git rev-parse HEAD)
base=$t7; echo 1 > f.txt; git add -A; git commit -qm wip
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
got=$(git -C "$SCRATCH/w/origin.git" show main:tasks/T7.yml | sed -n 's/^landed: //p')
if [ $r = 0 ] && [ "$got" = "$t7" ] && [ "$(count "$base")" = 1 ]; then ok "landed filled for a done task, same commit"
else fail "landed (r=$r got=$got want=$t7)"; fi

# d. a single commit still lands as one commit with status done
setup; base=$(git rev-parse HEAD); echo 1 > f.txt; git add -A; git commit -qm "single"
timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; r=$?
st=$(git -C "$SCRATCH/w/origin.git" show main:tasks/T9.yml | sed -n 's/^status: //p')
if [ $r = 0 ] && [ "$(count "$base")" = 1 ] && [ "$(msg %s)" = "T9: Make the thing say what it did." ] && [ "$st" = done ]; then ok "single commit lands with status done"
else fail "single (r=$r st=$st)"; fi

# e. T099: a task still claimed whose "<id>:" commit is on main is marked done and landed by the next landing
setup
printf 'id: T8\nowner: t\nstatus: claimed\nrelease_note: internal\ngoal: Old one.\ndone_test: true\nfiles:\n  - g.txt\n' > tasks/T8.yml
echo g > g.txt; git add -A; git commit -qm "T8: Old one."; git push -q origin main
echo 1 > f.txt; git add -A; git commit -qm "wip"
bash scripts/land.sh T9 > /dev/null 2>&1; r=$?
t8sha=$(git -C "$SCRATCH/w/origin.git" log --format='%H %s' main | awk '$2 == "T8:" { print $1; exit }')
st8=$(git -C "$SCRATCH/w/origin.git" show main:tasks/T8.yml | sed -n 's/^status: //p')
ld8=$(git -C "$SCRATCH/w/origin.git" show main:tasks/T8.yml | sed -n 's/^landed: //p')
if [ $r = 0 ] && [ "$st8" = done ] && [ "$ld8" = "$t8sha" ]; then ok "claimed T8 with its commit on main becomes done + landed"
else fail "stale claim (r=$r st=$st8 landed=$ld8 want=$t8sha)"; fi

# f. T117: an open tasks/fixes/F*.yml stays open through a `fixes` landing even though its own
# "F5:" commit is on main — only the fixing task closes it, never this loop
setup
printf 'id: F5\nowner: t\nstatus: open\ngoal: main is red.\n' > tasks/fixes/F5.yml
git add -A; git commit -qm "F5: the full suite is red at abc"; git push -q origin main
printf 'label: fixes\n' >> tasks/T9.yml
echo 1 > f.txt; git add -A; git commit -qm "wip"
bash scripts/land.sh T9 > /dev/null 2>&1; r=$?
st5=$(git -C "$SCRATCH/w/origin.git" show main:tasks/fixes/F5.yml | sed -n 's/^status: //p')
ld5=$(git -C "$SCRATCH/w/origin.git" show main:tasks/fixes/F5.yml | sed -n 's/^landed: //p')
if [ $r = 0 ] && [ "$st5" = open ] && [ -z "$ld5" ]; then ok "open F5 is not closed by the next landing"
else fail "fix task auto-closed (r=$r st=$st5 landed=$ld5)"; fi

[ $fails = 0 ] && { echo "land-squash: all passed"; exit 0; }
echo "land-squash: $fails failed"; exit 1
