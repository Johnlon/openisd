#!/usr/bin/env bash
# T003 acceptance (locked; author lots). The post-land full run, end to end in a scratch repo.
#
# Contract under test:
#   bash scripts/land/post-land/run.sh <sha>
#       started by land.sh after a push (detached; land.sh does not wait). Takes the land lock's
#       sibling POST_LAND_LOCK (flock), so post-land runs go one at a time. Builds a clean copy of
#       <sha> outside every clone (git worktree or clone into POST_LAND_DIR), runs FULL_SUITE_CMD
#       there once, with no rerun, then removes the copy.
#       green: fast-forwards branch `release` on origin to <sha> (only if <sha> descends from it).
#       red:   leaves `release` alone and commits + pushes tasks/fixes/F<n>.yml to main with
#              status: open, sha: <sha>, and the failing output's last lines; exit 1.
#   Config in land.conf: FULL_SUITE_CMD, POST_LAND_LOCK, POST_LAND_DIR.
#   .github/workflows/deploy.yml triggers on push to branch release only.
set -uo pipefail
# Independent of the user's git config (core.autocrlf=true would check scripts out with CRLF).
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-e2e.XXXXXX")"
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
    cp -r "$REPO/scripts/land" scripts/; cp "$REPO/scripts/land.sh" scripts/ 2>/dev/null
    # suite: fails if FAIL exists; with ONCE it fails the first time only (a flake)
    cat > suite.sh <<'EOF'
#!/usr/bin/env bash
pwd > "$SUITE_LOG/cwd.$$"; echo start >> "$SUITE_LOG/seq"; trap 'echo end >> "$SUITE_LOG/seq"' EXIT
[ -f FAIL ] && { echo "spec broken.spec.ts failed"; exit 1; }
if [ -f ONCE ] && [ ! -f "$SUITE_LOG/once.done" ]; then touch "$SUITE_LOG/once.done"; echo "spec flaky.spec.ts failed"; exit 1; fi
[ -f SLOW ] && sleep 3
date +%s%N >> "$SUITE_LOG/runs"; exit 0
EOF
    cat > land.conf <<EOF
FULL_SUITE_CMD="bash suite.sh"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_DIR="$SCRATCH/copies"
EOF
    git add -A; git commit -qm base; git push -q origin main; git push -q origin main:release
    export SUITE_LOG="$SCRATCH/log"; rm -rf "$SUITE_LOG"; mkdir -p "$SUITE_LOG"
}
commit_push() { echo "$1" >> f.txt; [ -n "${2:-}" ] && touch "$2"; git add -A; git commit -qm "$1"; git push -q origin main; git rev-parse HEAD; }
post() { timeout 120 bash scripts/land/post-land/run.sh "$1" > "$SCRATCH/out.$2" 2>&1; }
release() { git -C "$SCRATCH/w/origin.git" rev-parse release; }

# 1. green moves release to the sha, in a clean copy that is removed afterwards
setup; s=$(commit_push one); post "$s" a; r=$?
cwd=$(cat "$SUITE_LOG"/cwd.* 2>/dev/null | head -1)
if [ $r = 0 ] && [ "$(release)" = "$s" ] && [ -n "$cwd" ] && [ "$cwd" != "$SCRATCH/w/c" ] && [ ! -d "$cwd" ]; then
    ok "green moves release, clean copy removed"; else fail "green (r=$r cwd=$cwd)"; fi

# 2. red leaves release, opens a fixes task naming the spec and sha
setup; before=$(release); s=$(commit_push two FAIL); post "$s" a; r=$?
git -C "$SCRATCH/w/c" pull -q origin main
f=$(grep -l "sha: $s" "$SCRATCH"/w/c/tasks/fixes/F*.yml 2>/dev/null | head -1)
if [ $r = 1 ] && [ "$(release)" = "$before" ] && [ -n "$f" ] && grep -q '^status: open' "$f" && grep -q broken.spec.ts "$f"; then
    ok "red opens fixes task, release unmoved"; else fail "red (r=$r f=$f)"; fi

# 3. a flake (fails once, passes on retry) is a red: no rerun
setup; before=$(release); s=$(commit_push three ONCE); post "$s" a; r=$?
if [ $r = 1 ] && [ "$(release)" = "$before" ] && [ ! -f "$SUITE_LOG/runs" ]; then
    ok "flake is red, no rerun"; else fail "flake (r=$r)"; fi

# 4. two post-land runs do not overlap
setup; s1=$(commit_push four SLOW); s2=$(commit_push five)
post "$s1" a & p1=$!; post "$s2" b & p2=$!; wait $p1; wait $p2
n=$(ls "$SUITE_LOG"/cwd.* 2>/dev/null | wc -l)
seq=$(tr '\n' ' ' < "$SUITE_LOG/seq")
if [ "$n" = 2 ] && [ "$seq" = "start end start end " ] && [ "$(release)" = "$s2" ] && ! grep -q . <(ls "$SCRATCH/copies" 2>/dev/null); then
    ok "post-land runs serialised"; else fail "serialised (n=$n seq=$seq)"; fi

# 5. deploy.yml in the repo under test deploys only from release
if grep -Eq 'branches: *\[ *release *\]' "$REPO/.github/workflows/deploy.yml" \
   && ! grep -Eq 'branches: *\[ *main *\]' "$REPO/.github/workflows/deploy.yml"; then
    ok "deploy triggers on release only"; else fail "deploy trigger"; fi

[ $fails = 0 ] && { echo "post-land.e2e: all passed"; exit 0; }
echo "post-land.e2e: $fails failed"; exit 1
