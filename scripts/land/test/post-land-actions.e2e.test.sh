#!/usr/bin/env bash
# The post-land run with the suite on GitHub Actions (FULL_SUITE_CMD=scripts/land/post-land/actions.sh),
# end to end in a scratch repo: the real run.sh and actions.sh, real processes, and a fake `gh` on PATH
# that answers from files (no network). processes.md rule 7.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-actions.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# The fake gh. Per sha, in $FAKE_GH: <sha>.conclusion (success|failure; missing = no run yet),
# <sha>.log (--log-failed), <sha>.artifacts/failures-<n>/ (run download), <sha>.watch (seconds the watch
# takes). The run id is the sha. Every call is logged to $FAKE_GH/calls.
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/gh" <<'GH'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_GH/calls"
[ "$1 $2" = "run list" ] && { shift 2; while [ $# -gt 0 ]; do [ "$1" = --commit ] && sha="$2"; shift; done
  [ -f "$FAKE_GH/$sha.conclusion" ] && echo "$sha"; exit 0; }
id="$3"
case "$1 $2" in
  "run watch") sleep "$(cat "$FAKE_GH/$id.watch" 2>/dev/null || echo 0)"; exit 0 ;;
  "run view") case " $* " in
      *" --log-failed "*) cat "$FAKE_GH/$id.log" 2>/dev/null; exit 0 ;;
      *) cat "$FAKE_GH/$id.conclusion"; exit 0 ;; esac ;;
  "run download") shift 3; while [ $# -gt 0 ]; do [ "$1" = -D ] && dir="$2"; shift; done
    [ -d "$FAKE_GH/$id.artifacts" ] || exit 1; cp -r "$FAKE_GH/$id.artifacts/." "$dir/"; exit 0 ;;
esac
exit 1
GH
chmod +x "$SCRATCH/bin/gh"
export PATH="$SCRATCH/bin:$PATH" FAKE_GH="$SCRATCH/gh"

setup() {
    rm -rf "$SCRATCH/w" "$FAKE_GH" "$SCRATCH"/post.lock*; mkdir -p "$SCRATCH/w" "$FAKE_GH"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    mkdir -p scripts tasks/fixes; touch tasks/fixes/.keep
    cp -r "$REPO/scripts/land" "$REPO/scripts/lib" scripts/; cp "$REPO/scripts/paths.sh" "$REPO/scripts/browser-runs.sh" "$REPO/scripts/slice-events.sh" scripts/
    cp -r "$REPO/scripts/admit" "$REPO/scripts/visual" scripts/
    cat > land.conf <<CONF
FULL_SUITE_CMD="bash scripts/land/post-land/actions.sh"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_DIR="$SCRATCH/copies"
ACTIONS_REPO=owner/name
ACTIONS_FIND_S=3
ACTIONS_POLL_S=1
POST_LAND_QUIET_S=0
CONF
    git add -A; git commit -qm base; git push -q origin main
}
commit_push() { echo "$1" >> f.txt; git add -A; git commit -qm "$1"; git push -q origin main; git rev-parse HEAD; }
post() { timeout 120 bash scripts/land/post-land/run.sh "$1" > "$SCRATCH/out.$2" 2>&1; }
green() { cat "$SCRATCH/post.lock.green" 2>/dev/null; }
fixes_for() { git -C "$SCRATCH/w/c" pull -q origin main; grep -l "sha: $1" "$SCRATCH"/w/c/tasks/fixes/F*.yml 2>/dev/null | head -1; }

# 1. a green Actions run records the sha as the last green
setup; s=$(commit_push one); echo success > "$FAKE_GH/$s.conclusion"; post "$s" a; r=$?
if [ $r = 0 ] && [ "$(green)" = "$s" ] && grep -q "run list --repo owner/name --workflow suite.yml --event push --commit $s" "$FAKE_GH/calls"; then
    ok "green run records the sha"; else fail "green (r=$r) $(git -C "$SCRATCH/w/c" pull -q origin main; sed -n "/^output/,\$p" "$SCRATCH"/w/c/tasks/fixes/F1.yml)"; fi

# 2. a red run opens an F naming the failing specs and linking the run
setup; s=$(commit_push two); echo failure > "$FAKE_GH/$s.conclusion"
printf 'browser (3)\tbrowser tests\t2026-10-17T01:00:00.1234567Z   \033[31m✘  12 packages/ui/test/ui/broken.browser.spec.ts:5:3 › breaks (1.0s)\033[0m\nunit (1)\tunit tests\t2026-10-17T01:00:00Z  FAIL  |ui| test/x.test.ts > x\n' > "$FAKE_GH/$s.log"
post "$s" a; r=$?; f=$(fixes_for "$s")
if [ $r = 1 ] && [ -n "$f" ] && grep -q '^status: open' "$f" && grep -q 'browser (3): *✘  12 packages/ui/test/ui/broken.browser.spec.ts:5:3' "$f" && grep -q 'FAIL  |ui| test/x.test.ts' "$f" \
   && grep -q "https://github.com/owner/name/actions/runs/$s" "$f" && ! grep -q $'\033' "$f"; then
    ok "red opens an F with the failing specs and the run link"; else fail "red (r=$r f=$f) $(tail -5 "$SCRATCH/out.a")"; fi

# 3. a red with screen-picture failures builds the visual before/after page from the downloaded pictures
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
setup; s=$(commit_push three); echo failure > "$FAKE_GH/$s.conclusion"
echo "  ✘  7 packages/ui/test/visual/visual.browser.spec.ts:9:3 › visual mobile a (1.0s)" > "$FAKE_GH/$s.log"
mkdir -p "$FAKE_GH/$s.artifacts/failures-2/visual-mobile-a"
for k in expected actual diff; do printf "$k" > "$FAKE_GH/$s.artifacts/failures-2/visual-mobile-a/mobile-a-$k.png"; done
post "$s" a; r=$?; f=$(fixes_for "$s")
if [ $r = 1 ] && [ -n "$f" ] && grep -q 'visual screens: mobile-a' "$f" && [ -e "$VISUAL_PAGES_DIR/red-${s:0:10}/mobile-a.diff.png" ]; then
    ok "a screen-picture red names the screen and builds its page"; else fail "visual red (r=$r f=$f) $(tail -5 "$SCRATCH/out.a")"; fi
unset VISUAL_PAGES_DIR VISUAL_PAGES_URL

# 4. no Actions run for the sha within ACTIONS_FIND_S is a red, never a green
setup; s=$(commit_push four); post "$s" a; r=$?; f=$(fixes_for "$s")
if [ $r = 1 ] && [ -z "$(green)" ] && [ -n "$f" ] && grep -q "no suite.yml run on ${s:0:10}" "$f"; then
    ok "no run found is a red"; else fail "no run (r=$r f=$f) $(tail -3 "$SCRATCH/out.a")"; fi

# 5. a run that appears late (after the first look) is still found
setup; s=$(commit_push five)
( sleep 1.5; echo success > "$FAKE_GH/$s.conclusion" ) &
post "$s" a; r=$?; wait
if [ $r = 0 ] && [ "$(green)" = "$s" ]; then ok "a run that appears late is found"; else fail "late run (r=$r) $(tail -3 "$SCRATCH/out.a")"; fi

# 6. two landings close together: the running Actions wait is never killed (T261); the newer sha is
#    tested after it, and the last green is the newer sha
setup; s1=$(commit_push six); s2=$(commit_push seven)
echo success > "$FAKE_GH/$s1.conclusion"; echo 3 > "$FAKE_GH/$s1.watch"; echo success > "$FAKE_GH/$s2.conclusion"
post "$s1" a & p1=$!
for _ in $(seq 50); do grep -q "run watch $s1" "$FAKE_GH/calls" 2>/dev/null && break; sleep 0.1; done
post "$s2" b & p2=$!; wait $p1; r1=$?; wait $p2; r2=$?
order=$(grep -o "run watch [0-9a-f]*" "$FAKE_GH/calls" | awk '{print $3}' | tr '\n' ' ')
if [ $r1 = 0 ] && [ $r2 = 0 ] && grep -q "green at ${s1:0:10}" "$SCRATCH/out.a" && [ "$order" = "$s1 $s2 " ] && [ "$(green)" = "$s2" ]; then
    ok "two landings: the running wait finishes, the newer sha is tested after it"; else fail "two landings (r1=$r1 r2=$r2 order=$order) a: $(tail -2 "$SCRATCH/out.a" | tr '\n' ' ') b: $(tail -2 "$SCRATCH/out.b" | tr '\n' ' ')"; fi

# 7. run.sh killed while actions.sh waits: nothing of the run is left running
setup; s=$(commit_push eight); echo success > "$FAKE_GH/$s.conclusion"; echo 30 > "$FAKE_GH/$s.watch"
setsid bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out.a" 2>&1 & p=$!
for _ in $(seq 50); do grep -q "run watch $s" "$FAKE_GH/calls" 2>/dev/null && break; sleep 0.1; done
kill -TERM "$p"; wait "$p" 2>/dev/null
left=$(ps -eo pgid=,args= | awk -v g="$p" '$1 == g' | grep -c .)
if [ "$left" = 0 ] && [ ! -d "$SCRATCH/copies/$p-${s:0:10}" ]; then ok "killed mid-wait leaves nothing running"; else fail "killed (left=$left)"; fi

# 8. the suite command comes from the tested commit's land.conf, not the main checkout's, which can lag
setup; s=$(commit_push nine); echo success > "$FAKE_GH/$s.conclusion"
sed -i 's|^FULL_SUITE_CMD=.*|FULL_SUITE_CMD="false"|' land.conf
post "$s" a; r=$?
if [ $r = 0 ] && [ "$(green)" = "$s" ] && grep -q "suite command (from ${s:0:10}): bash scripts/land/post-land/actions.sh" "$SCRATCH/out.a"; then
    ok "the suite command is the tested commit's"; else fail "commit's suite command (r=$r) $(tail -3 "$SCRATCH/out.a")"; fi

# 9. the main checkout lags origin/main and has local edits: the run uses origin/main's scripts and settings
setup; s=$(commit_push ten); echo success > "$FAKE_GH/$s.conclusion"
git clone -q "$SCRATCH/w/origin.git" "$SCRATCH/w/other" 2>/dev/null
( cd "$SCRATCH/w/other" && git config user.email t@t && git config user.name t \
  && sed -i 's|^ACTIONS_REPO=.*|ACTIONS_REPO=moved/repo|' land.conf && git commit -qam "repo moved" && git push -q origin main )
s=$(git -C "$SCRATCH/w/other" rev-parse HEAD); echo success > "$FAKE_GH/$s.conclusion"
echo 'exit 7' > scripts/land/post-land/actions.sh; echo 'exit 7' > scripts/paths.sh
post "$s" a; r=$?
if [ $r = 0 ] && [ "$(green)" = "$s" ] && grep -q -- "--repo moved/repo" "$FAKE_GH/calls" && [ -z "$(ls -d "${TMPDIR:-/tmp}"/post-land-tools.* 2>/dev/null | xargs -r -n1 sh -c 'grep -l "moved/repo" "$0/land.conf" 2>/dev/null')" ]; then
    ok "a lagging main checkout: origin/main's scripts and settings, snapshot removed"; else fail "lagging checkout (r=$r) $(tail -3 "$SCRATCH/out.a")"; fi

[ $fails = 0 ] && { echo "post-land-actions.e2e: all passed"; exit 0; }
echo "post-land-actions.e2e: $fails failed"; exit 1
