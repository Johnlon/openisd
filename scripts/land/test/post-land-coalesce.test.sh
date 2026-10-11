#!/usr/bin/env bash
# Post-land runs coalesce (John 2026-10-08, throughput; kill added 2026-10-11, SDLC S2): a run on an
# older commit is killed by the next run; a run that gets its turn when a NEWER run is waiting, or when a
# newer commit was already tested, ends "superseded by <sha>" with exit 0 without running its suite. The
# newest run tests the latest sha. A red names EVERY commit since the last green.
# Not one of the locked specs.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-coalesce.XXXXXX")"
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
    cp "$REPO/scripts/paths.sh" scripts/
    cat > suite.sh <<'EOF'
#!/usr/bin/env bash
echo "$(git rev-parse HEAD)" >> "$SUITE_LOG/ran"
[ -f HOLD ] && { : > "$SUITE_LOG/holding"; for _ in $(seq 1 300); do [ -f "$SUITE_LOG/unhold" ] && break; sleep 0.1; done; }
[ -f FAIL ] && { echo "spec broken.spec.ts failed"; exit 1; }
exit 0
EOF
    cat > land.conf <<EOF
FULL_SUITE_CMD="bash suite.sh"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_DIR="$SCRATCH/copies"
EOF
    git add -A; git commit -qm base; git push -q origin main
    export SUITE_LOG="$SCRATCH/log"; rm -rf "$SUITE_LOG"; mkdir -p "$SUITE_LOG"
}
commit_push() { echo "$1" >> f.txt; [ -n "${2:-}" ] && touch "$2"; git add -A; git commit -qm "$1"; git push -q origin main; git rev-parse HEAD; }
green() { cat "$SCRATCH/post.lock.green" 2>/dev/null; }
start() { timeout 120 bash scripts/land/post-land/run.sh "$1" > "$SCRATCH/out.$2" 2>&1; echo $? > "$SCRATCH/rc.$2"; }
await_line() { timeout 30 tail -n +1 -f "$2" 2> /dev/null | grep -q -m1 -- "$1"; }  # file $2 shows line $1 (bounded)

# 1. run A holds the lock on an older commit; B arrives and KILLS it (SDLC S2) and runs; C arrives and
#    kills B. Every suite started, none but C's finished; green = latest.
setup; a=$(commit_push one HOLD)
start "$a" a & pa=$!
await_line "running the full suite on ${a:0:10}" "$SCRATCH/out.a"
b=$(commit_push two); c=$(commit_push three)
start "$b" b & pb=$!; await_line "running the full suite on ${b:0:10}" "$SCRATCH/out.b"
wait $pa
start "$c" c & pc=$!
wait $pb $pc
ran=$(tr '\n' ' ' < "$SUITE_LOG/ran")
if [ "$ran" = "$a $b $c " ] && [ "$(cat "$SCRATCH/rc.a")" = 0 ] && grep -q "superseded by ${b:0:10}; killed" "$SCRATCH/out.a" \
   && [ "$(cat "$SCRATCH/rc.b")" = 0 ] && grep -q "superseded by ${c:0:10}; killed" "$SCRATCH/out.b" \
   && grep -q "killed the run on ${a:0:10}" "$SCRATCH/out.b" && [ "$(green)" = "$c" ]; then
    ok "a run on an older commit is killed by the next run; green = latest"
else fail "kill (ran='$ran' rc.a=$(cat "$SCRATCH/rc.a") rc.b=$(cat "$SCRATCH/rc.b") green=$(green | cut -c1-8)): a: $(tr '\n' ' ' < "$SCRATCH/out.a" | cut -c1-200) b: $(tr '\n' ' ' < "$SCRATCH/out.b" | cut -c1-200)"; fi

# 1b. a run on a commit older than the last tested one does not run its suite
: > "$SUITE_LOG/ran"; start "$b" b2
if [ ! -s "$SUITE_LOG/ran" ] && [ "$(cat "$SCRATCH/rc.b2")" = 0 ] && grep -q "superseded by ${c:0:10} (already tested)" "$SCRATCH/out.b2"; then
    ok "a run on an already-covered commit is superseded without running"
else fail "already tested (rc=$(cat "$SCRATCH/rc.b2")): $(cat "$SCRATCH/out.b2" | tr '\n' ' ' | cut -c1-200)"; fi

# 1c. two runs waiting behind a holder: the older waiting run is superseded by the newer waiting run
setup; a=$(commit_push one HOLD)
start "$a" a & pa=$!
await_line "running the full suite on ${a:0:10}" "$SCRATCH/out.a"
# B and C start while A's suite holds; both kill A, then queue for the lock in either order.
b=$(commit_push two); c=$(commit_push three)
start "$b" b & pb=$!; start "$c" c & pc=$!
wait $pa $pb $pc
if [ "$(green)" = "$c" ] && [ "$(cat "$SCRATCH/rc.b")" = 0 ] && [ "$(cat "$SCRATCH/rc.c")" = 0 ] \
   && { ! grep -q "running the full suite on ${b:0:10}" "$SCRATCH/out.b" || grep -q "superseded by ${c:0:10}; killed" "$SCRATCH/out.b"; }; then
    ok "with two runs queued behind a holder only the newest result counts; green = latest"
else fail "queue (green=$(green | cut -c1-8) rc.b=$(cat "$SCRATCH/rc.b") rc.c=$(cat "$SCRATCH/rc.c")) b: $(tr '\n' ' ' < "$SCRATCH/out.b" | cut -c1-200) c: $(tr '\n' ' ' < "$SCRATCH/out.c" | cut -c1-200)"; fi

# 2. the latest is red: the fixes task names every commit since the last green and has an owner and the failing spec
setup; a=$(commit_push one); start "$a" a
b=$(commit_push two); c=$(commit_push three FAIL)
start "$c" c
git -C "$SCRATCH/w/c" pull -q origin main
f=$(grep -l "sha: $c" "$SCRATCH"/w/c/tasks/fixes/F*.yml 2> /dev/null | head -1)
if [ -n "$f" ] && grep -q "${b:0:10}" "$f" && grep -q "${c:0:10}" "$f" && [ "$(green)" = "$a" ] && [ "$(cat "$SCRATCH/rc.c")" = 1 ] \
   && grep -q '^owner: t$' "$f" && grep -A2 '^failing:' "$f" | grep -q broken.spec.ts; then
    ok "red on the latest: F lists every commit since the last green, names the owner and the failing spec"
else fail "red range (f=$f green=$(green | cut -c1-8) rc.c=$(cat "$SCRATCH/rc.c"))"; fi

# 2b. a second red while that F is open is appended to it: one F per fault, never a second F
d=$(commit_push four FAIL); start "$d" d
git -C "$SCRATCH/w/c" pull -q origin main
nf=$(ls "$SCRATCH"/w/c/tasks/fixes/F*.yml | wc -l)
if [ "$nf" = 1 ] && grep -q "sha: $d" "$f" && grep -q '^also_red:' "$f" && [ "$(cat "$SCRATCH/rc.d")" = 1 ]; then
    ok "a red while an F is open is appended to that F"
else fail "append to open F (files=$nf)"; fi

# 3. a lone run (nothing newer waiting) still runs its own sha
setup; s=$(commit_push solo)
start "$s" a
if [ "$(tr '\n' ' ' < "$SUITE_LOG/ran")" = "$s " ] && [ "$(green)" = "$s" ]; then ok "a lone run runs its own sha"; else fail "lone run"; fi

[ $fails = 0 ] && { echo "post-land-coalesce: all passed"; exit 0; }
echo "post-land-coalesce: $fails failed"; exit 1
