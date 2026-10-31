#!/usr/bin/env bash
# run.sh on a head whose only change since the last tested sha is tasks/** or questions.yml (the F
# note commits post-land itself pushes): it records the head as tested with the tested sha's result and
# pushes NO new F commit. Else the watchdog re-tested every F note, one push per pass (QO321, 31 Oct).
# A code commit after a red is still tested and still red.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
export POST_LAND_QUIET_S=0
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-bk.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
export POST_LAND_KEEP_DIR="$SCRATCH/keep"
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes; touch tasks/fixes/.keep
    cp -r "$REPO/scripts/." scripts/
    printf '#!/usr/bin/env bash\n[ -f FAIL ] && { echo "spec broken.spec.ts failed"; exit 1; }\nexit 0\n' > suite.sh
    printf 'FULL_SUITE_CMD="bash suite.sh"\nPOST_LAND_LOCK="%s/post.lock"\nPOST_LAND_RECORD="%s/post.lock"\nPOST_LAND_DIR="%s/copies"\n' "$SCRATCH" "$SCRATCH" "$SCRATCH" > land.conf
    rm -f "$SCRATCH"/post.lock.*
    git add -A; git commit -qm base; git push -q origin main
}
origin_main() { git -C "$SCRATCH/w/origin.git" rev-parse main; }
run() { timeout 120 bash scripts/land/post-land/run.sh "$1" > "$SCRATCH/out" 2>&1; }

# 1. red at a code sha opens F1 on main; the F commit (tasks/ only) is then run: no new commit, tested = it
setup; echo a >> f.txt; touch FAIL; git add -A; git commit -qm code; s=$(git rev-parse HEAD); git push -q origin main
run "$s"; head1=$(origin_main)
run "$head1"; r=$?
if [ $r = 0 ] && [ "$(origin_main)" = "$head1" ] && [ "$(cat "$SCRATCH/post.lock.tested")" = "$head1" ]; then
    ok "bookkeeping-only head after a red: no new F commit, recorded as tested"
else fail "bookkeeping head (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

# 2. a code commit after the red is still tested and still red (appended to the open F)
git pull -q --rebase origin main; echo b >> f.txt; git add -A; git commit -qm code2; s2=$(git rev-parse HEAD); git push -q origin main
run "$s2"; r=$?
if [ $r = 1 ] && [ "$(git -C "$SCRATCH/w/origin.git" rev-parse "$(origin_main)^")" = "$s2" ]; then
    ok "code commit after a red: still tested, still red"; else fail "code after red (r=$r)"; fi

[ $fails = 0 ] && { echo "post-land-bookkeeping-head: all passed"; exit 0; }
echo "post-land-bookkeeping-head: $fails failed"; exit 1
