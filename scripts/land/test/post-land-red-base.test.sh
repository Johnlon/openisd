#!/usr/bin/env bash
# run.sh on a RED run: the fixes task is committed on top of the tested sha, never on top of an older
# origin/main. When the sha is not on origin yet (main is ahead of origin), the push is a fast-forward
# that carries the sha's own history plus the F commit. Not one of the locked specs.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-redbase.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes; touch tasks/fixes/.keep
    cp -r "$REPO/scripts/land" scripts/
    printf '#!/usr/bin/env bash\n[ -f FAIL ] && { echo "spec broken.spec.ts failed"; exit 1; }\nexit 0\n' > suite.sh
    printf 'FULL_SUITE_CMD="bash suite.sh"\nPOST_LAND_LOCK="%s/post.lock"\nPOST_LAND_DIR="%s/copies"\n' "$SCRATCH" "$SCRATCH" > land.conf
    git add -A; git commit -qm base; git push -q origin main
}
local_commit() { echo "$1" >> f.txt; [ -n "${2:-}" ] && touch "$2"; git add -A; git commit -qm "$1"; git rev-parse HEAD; }
origin_main() { git -C "$SCRATCH/w/origin.git" rev-parse main; }

# 1. main is ahead of origin (two unpushed commits, the second one red): the F commit lands on
#    top of the red sha, origin/main moves by fast-forward and now holds both commits
setup; base=$(origin_main); local_commit one > /dev/null; s=$(local_commit two FAIL)
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
om=$(origin_main)
if [ $r = 1 ] && [ "$(git -C "$SCRATCH/w/origin.git" rev-parse "$om^")" = "$s" ] \
   && git -C "$SCRATCH/w/origin.git" merge-base --is-ancestor "$base" "$s" \
   && [ "$(git -C "$SCRATCH/w/origin.git" rev-list --count "$base..$om")" = 3 ]; then
    ok "unpushed red sha: origin/main = the sha's history + the F commit on top (fast-forward)"
else fail "unpushed red (r=$r om=$om): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

# 2. the sha is already on origin/main: the F commit lands on top of origin/main as before
setup; s=$(local_commit three FAIL); git push -q origin main
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
om=$(origin_main)
if [ $r = 1 ] && [ "$(git -C "$SCRATCH/w/origin.git" rev-parse "$om^")" = "$s" ]; then
    ok "pushed red sha: the F commit sits on top of it"; else fail "pushed red (r=$r)"; fi

# 3. origin/main moved on without the sha (a diverged main): no F commit, loud failure, origin untouched
setup; s=$(local_commit four FAIL)
git clone -q "$SCRATCH/w/origin.git" "$SCRATCH/w/other" 2>/dev/null
( cd "$SCRATCH/w/other" && git config user.email t@t && git config user.name t && echo x > other.txt && git add -A && git commit -qm other && git push -q origin main )
before=$(origin_main)
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
if [ $r != 0 ] && [ "$(origin_main)" = "$before" ] && grep -qi "diverged\|not a fast-forward\|cannot" "$SCRATCH/out"; then
    ok "diverged origin: nothing pushed, the cause is named"; else fail "diverged (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

[ $fails = 0 ] && { echo "post-land-red-base: all passed"; exit 0; }
echo "post-land-red-base: $fails failed"; exit 1
