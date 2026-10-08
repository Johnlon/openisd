#!/usr/bin/env bash
# run.sh with NO_RELEASE_PUSH=1: a green run is reported but branch `release` is not moved.
# A red run still opens its fixes task. Not one of the locked specs.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-norelease.XXXXXX")"
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
    git add -A; git commit -qm base; git push -q origin main; git push -q origin main:release
}
commit_push() { echo "$1" >> f.txt; [ -n "${2:-}" ] && touch "$2"; git add -A; git commit -qm "$1"; git push -q origin main; git rev-parse HEAD; }
release() { git -C "$SCRATCH/w/origin.git" rev-parse release; }

setup; before=$(release); s=$(commit_push one)
NO_RELEASE_PUSH=1 timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
if [ $r = 0 ] && [ "$(release)" = "$before" ] && grep -qi "NO_RELEASE_PUSH" "$SCRATCH/out"; then
    ok "green with NO_RELEASE_PUSH=1 leaves release alone and says so"; else fail "green held (r=$r)"; fi

setup; s=$(commit_push two)
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
[ $r = 0 ] && [ "$(release)" = "$s" ] && ok "green without it still moves release" || fail "green default (r=$r)"

setup; before=$(release); s=$(commit_push three FAIL)
NO_RELEASE_PUSH=1 timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
git -C "$SCRATCH/w/c" pull -q origin main
if [ $r = 1 ] && [ "$(release)" = "$before" ] && grep -l "sha: $s" "$SCRATCH"/w/c/tasks/fixes/F*.yml > /dev/null 2>&1; then
    ok "red with NO_RELEASE_PUSH=1 still opens its fixes task"; else fail "red held (r=$r)"; fi

[ $fails = 0 ] && { echo "post-land-no-release: all passed"; exit 0; }
echo "post-land-no-release: $fails failed"; exit 1
