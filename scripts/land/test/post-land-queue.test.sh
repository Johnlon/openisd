#!/usr/bin/env bash
# Post-land queue rules (John, 2026-10-16), scratch repo with real processes:
#   - the suite starts only after origin/main has had POST_LAND_QUIET_S of quiet; a push during the wait
#     restarts it, and the run on the older commit ends superseded by the tip, never testing it
#   - a run that is waiting for the quiet period is not killed by a newer run either
#   - an F records the tested sha, the last green and the commit range
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-queue.XXXXXX")"
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
    cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/; cp "$REPO/scripts/paths.sh" "$REPO/scripts/browser-runs.sh" "$REPO/scripts/slice-events.sh" scripts/; cp -r "$REPO/scripts/admit" scripts/
    cat > suite.sh <<'SUITE'
#!/usr/bin/env bash
echo "$(git rev-parse HEAD) $(date +%s)" >> "$SUITE_LOG/ran"
[ -f FAIL ] && { echo "spec broken.spec.ts failed"; exit 1; }
exit 0
SUITE
    cat > land.conf <<CONF
FULL_SUITE_CMD="bash suite.sh"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_RECORD="$SCRATCH/post.lock"
POST_LAND_DIR="$SCRATCH/copies"
CONF
    git add -A; git commit -qm base; git push -q origin main
    export SUITE_LOG="$SCRATCH/log"; rm -rf "$SUITE_LOG"; mkdir -p "$SUITE_LOG"
}
commit_push() { echo "$1" >> f.txt; [ -n "${2:-}" ] && touch "$2"; git add -A; git commit -qm "$1"; git push -q origin main; git rev-parse HEAD; }
start() { timeout 120 bash scripts/land/post-land/run.sh "$1" > "$SCRATCH/out.$2" 2>&1; echo $? > "$SCRATCH/rc.$2"; }
await_line() { timeout 30 tail -n +1 -f "$2" 2> /dev/null | grep -q -m1 -- "$1"; }

# 1. the suite waits for the quiet period, and a push during the wait restarts it
export POST_LAND_QUIET_S=4
setup; a=$(commit_push one)
start "$a" a & pa=$!
await_line "of quiet before testing" "$SCRATCH/out.a"
[ ! -s "$SUITE_LOG/ran" ] && ok "the suite does not start while main is fresh" || fail "the suite started inside the quiet period"
b=$(commit_push two); tb=$(date +%s)
start "$b" b & pb=$!
wait $pa $pb
set -- $(tail -n 1 "$SUITE_LOG/ran"); ran_sha="$1"; ran_at="$2"
if [ "$(wc -l < "$SUITE_LOG/ran")" = 1 ] && [ "$ran_sha" = "$b" ] && [ $((ran_at - tb)) -ge 3 ]; then
    ok "one suite ran, on the newest commit, after its quiet period"
else fail "quiet (runs=$(wc -l < "$SUITE_LOG/ran") sha=${ran_sha:0:8} want=${b:0:8} waited=$((ran_at - tb)) s)"; fi
grep -q "superseded by ${b:0:10}" "$SCRATCH/out.a" && [ "$(cat "$SCRATCH/rc.a")" = 0 ] && ok "the run on the older commit ended superseded by the tip" || fail "older run: $(tr '\n' ' ' < "$SCRATCH/out.a" | cut -c1-200)"
grep -q killed "$SCRATCH/out.a" "$SCRATCH/out.b" && fail "something was killed" || ok "nothing was killed"

# 2. an F records the tested sha, the last green and the range
export POST_LAND_QUIET_S=0
setup; g=$(commit_push green); start "$g" g
m=$(commit_push mid); r=$(commit_push red FAIL); start "$r" r
git -C "$SCRATCH/w/c" pull -q origin main
f=$(grep -l "sha: $r" "$SCRATCH"/w/c/tasks/fixes/F*.yml 2> /dev/null | head -1)
if [ -n "$f" ] && grep -q "^tested: $r" "$f" && grep -q "^last_green: $g" "$f" && grep -q "^range: $g\.\.$r" "$f"; then
    ok "the F names the tested sha, the last green and the commit range"
else fail "F fields ($f): $(head -8 "$f" 2> /dev/null | tr '\n' '|')"; fi
d=$(commit_push again FAIL); start "$d" d
git -C "$SCRATCH/w/c" pull -q origin main
if grep -q "tested: $d" "$f" && grep -c '^    last_green:' "$f" | grep -q 1; then ok "a second red appended to the F carries the same fields"; else fail "appended fields"; fi

[ $fails = 0 ] && { echo "post-land-queue: all passed"; exit 0; }
echo "post-land-queue: $fails failed"; exit 1
