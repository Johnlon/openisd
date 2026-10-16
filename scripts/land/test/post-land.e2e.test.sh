#!/usr/bin/env bash
# T003 acceptance (locked; author lots). The post-land full run, end to end in a scratch repo.
#
# Contract under test:
#   bash scripts/land/post-land/run.sh <sha>
#       started by land.sh after a push (detached; land.sh does not wait). Takes the land lock's
#       sibling POST_LAND_LOCK (flock), so post-land runs go one at a time. Builds a clean copy of
#       <sha> outside every clone (git worktree or clone into POST_LAND_DIR), runs FULL_SUITE_CMD
#       there once, with no rerun, then removes the copy.
#       green: records <sha> in ${POST_LAND_LOCK}.green.
#       red:   commits + pushes tasks/fixes/F<n>.yml to main with
#              status: open, sha: <sha>, and the failing output's last lines; exit 1.
#   Config in land.conf: FULL_SUITE_CMD, POST_LAND_LOCK, POST_LAND_DIR.
#   .github/workflows/deploy.yml triggers on push to main.
#   (Amended by lots, 10 Oct: no release branch. Cases 1, 4 and 5 changed; nothing else.)
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
    cp "$REPO/scripts/paths.sh" scripts/
    cp "$REPO/scripts/browser-runs.sh" scripts/; cp -r "$REPO/scripts/admit" scripts/; cp -r "$REPO/scripts/visual" scripts/
    # suite: fails if FAIL exists; with ONCE it fails the first time only (a flake)
    cat > suite.sh <<'EOF'
#!/usr/bin/env bash
pwd > "$SUITE_LOG/cwd.$$"; echo start >> "$SUITE_LOG/seq"; trap 'echo end >> "$SUITE_LOG/seq"' EXIT
if [ -f VISUALFAIL ]; then
  mkdir -p test-results/visual-mobile-a; for k in expected actual diff; do printf "$k" > "test-results/visual-mobile-a/mobile-a-$k.png"; done
  echo "  ✘  7 packages/ui/test/visual/visual.browser.spec.ts:9:3 › visual mobile a (1.0s)"; exit 1
fi
[ -f FAIL ] && { echo "stderr | test/noisy.test.ts > a passing test that logs"; echo "spec broken.spec.ts failed"; exit 1; }
if [ -f ONCE ] && [ ! -f "$SUITE_LOG/once.done" ]; then touch "$SUITE_LOG/once.done"; echo "spec flaky.spec.ts failed"; exit 1; fi
if [ -f SLOW ]; then [ -p "$SUITE_LOG/entered.fifo" ] && echo up > "$SUITE_LOG/entered.fifo"; sleep 3; fi
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
green() { cat "$SCRATCH/post.lock.green" 2>/dev/null; }

# 1. green records the sha as the last green, in a clean copy that is removed afterwards
setup; s=$(commit_push one); post "$s" a; r=$?
cwd=$(cat "$SUITE_LOG"/cwd.* 2>/dev/null | head -1)
if [ $r = 0 ] && [ "$(green)" = "$s" ] && [ -n "$cwd" ] && [ "$cwd" != "$SCRATCH/w/c" ] && [ ! -d "$cwd" ]; then
    ok "green records the sha, clean copy removed"; else fail "green (r=$r cwd=$cwd)"; fi

# 2. red leaves release, opens a fixes task naming the spec and sha
setup; before=$(release); s=$(commit_push two FAIL); post "$s" a; r=$?
git -C "$SCRATCH/w/c" pull -q origin main
f=$(grep -l "sha: $s" "$SCRATCH"/w/c/tasks/fixes/F*.yml 2>/dev/null | head -1)
if [ $r = 1 ] && [ "$(release)" = "$before" ] && [ -n "$f" ] && grep -q '^status: open' "$f" && grep -q broken.spec.ts "$f" && ! sed -n '/^failing:/,/^output:/p' "$f" | grep -q noisy.test.ts; then
    ok "red opens fixes task, release unmoved"; else fail "red (r=$r f=$f)"; fi

# 2b. a red caused by a screenshot differing names the screen and links the before/after page (scripts/visual/)
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
setup; s=$(commit_push vis VISUALFAIL); post "$s" a; r=$?
git -C "$SCRATCH/w/c" pull -q origin main
f=$(grep -l "sha: $s" "$SCRATCH"/w/c/tasks/fixes/F*.yml 2>/dev/null | head -1)
if [ $r = 1 ] && [ -n "$f" ] && grep -q '^visual: |' "$f" && grep -q 'visual screens: mobile-a' "$f" && grep -q "visual page: http://example.test/pages/red-${s:0:10}/index.html" "$f" && [ -e "$VISUAL_PAGES_DIR/red-${s:0:10}/mobile-a.diff.png" ]; then
    ok "a screenshot red names the screen and links its page"; else fail "visual red (r=$r f=$f): $(cat "$f" 2>/dev/null | head -20)"; fi

# 3. a flake (fails once, passes on retry) is a red: no rerun
setup; before=$(release); s=$(commit_push three ONCE); post "$s" a; r=$?
if [ $r = 1 ] && [ "$(release)" = "$before" ] && [ ! -f "$SUITE_LOG/runs" ]; then
    ok "flake is red, no rerun"; else fail "flake (r=$r)"; fi

# 4. two post-land runs do not overlap (serialised, no coalesce because first completes before second waits)
setup; s1=$(commit_push four SLOW); s2=$(commit_push five)
# wait (blocking, bounded) for the first run's suite to signal on the fifo, then start the second
mkfifo "$SUITE_LOG/entered.fifo"
post "$s1" a & p1=$!
timeout 10 cat "$SUITE_LOG/entered.fifo" > /dev/null || fail "serialised: first run never entered the suite"
rm -f "$SUITE_LOG/entered.fifo"
post "$s2" b & p2=$!; wait $p1; wait $p2
n=$(ls "$SUITE_LOG"/cwd.* 2>/dev/null | wc -l)
seq=$(tr '\n' ' ' < "$SUITE_LOG/seq")
if [ "$n" = 2 ] && [ "$seq" = "start end start end " ] && [ "$(green)" = "$s2" ] && ! grep -q . <(ls "$SCRATCH/copies" 2>/dev/null); then
    ok "post-land runs serialised"; else fail "serialised (n=$n seq=$seq)"; fi

# 5. deploy.yml never deploys the root on a push to main by itself (T056: root = Latest release;
#    build.yml makes a snapshot build on push and calls deploy.yml)
if grep -Eq '^  workflow_call:' "$REPO/.github/workflows/deploy.yml" \
   && ! grep -Eq '^  push:' "$REPO/.github/workflows/deploy.yml" \
   && grep -Eq 'branches: *\[ *main *\]' "$REPO/.github/workflows/build.yml"; then
    ok "deploy runs only when called; build triggers on main"; else fail "deploy trigger"; fi

# 6. started from a task worktree that is removed while the suite runs: the run still completes
setup; s=$(commit_push six SLOW)
git -C "$SCRATCH/w/c" worktree add -q "$SCRATCH/w/task" -b task "$s"
mkfifo "$SUITE_LOG/entered.fifo"
( cd "$SCRATCH/w/task" && timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out.a" 2>&1 ) & p1=$!
timeout 10 cat "$SUITE_LOG/entered.fifo" > /dev/null || fail "worktree gone: run never entered the suite"
rm -f "$SUITE_LOG/entered.fifo"
git -C "$SCRATCH/w/c" worktree remove --force "$SCRATCH/w/task"
wait $p1; r=$?
if [ $r = 0 ] && [ "$(green)" = "$s" ] && ! grep -q . <(ls "$SCRATCH/copies" 2>/dev/null) && ! grep -qi "getcwd\|No such file" "$SCRATCH/out.a"; then
    ok "run survives its starting worktree being removed"; else fail "worktree gone (r=$r out=$(tail -2 "$SCRATCH/out.a" | tr '\n' ' '))"; fi

[ $fails = 0 ] && { echo "post-land.e2e: all passed"; exit 0; }
echo "post-land.e2e: $fails failed"; exit 1
