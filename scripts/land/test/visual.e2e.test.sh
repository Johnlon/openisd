#!/usr/bin/env bash
# End-to-end test of the visual-baseline scripts (scripts/visual/) in a scratch repo, with real git and
# real node: the land gate (a task changes exactly the screens it lists), the before/after page of a
# landed change, and the page of a red post-land run's differing screens.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"; trap 'rm -rf "$SCRATCH"' EXIT
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }

cd "$SCRATCH" && git init -q -b main work && cd work || exit 2
git config user.email t@t; git config user.name t
mkdir -p scripts tasks
cp -r "$REPO/scripts/visual" scripts/
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
SNAP=packages/ui/test/visual/visual.browser.spec.ts-snapshots
mkdir -p "$SNAP"
png() { printf '\211PNG\r\n\032\n%s' "$1" > "$2"; }   # not a real picture; the scripts only move bytes
png one "$SNAP/mobile-a.png"; png one "$SNAP/desktop-b.png"
git add -A && git commit -qm base && base=$(git rev-parse HEAD)

# a change to mobile-a, a new screen mobile-c, a removed screen desktop-b
png two "$SNAP/mobile-a.png"; png new "$SNAP/mobile-c.png"; git rm -q "$SNAP/desktop-b.png"
task() { printf 'id: T1\nvisual:\n%s\n' "$(printf '  - %s\n' "$@")" > tasks/T1.yml; }
git add -A && git commit -qm change && head=$(git rev-parse HEAD)

task mobile-a mobile-c desktop-b
bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$head" > out.txt 2>&1 && ok "a task that lists every changed screen passes" || fail "listed change refused: $(cat out.txt)"

task mobile-a mobile-c
bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$head" > out.txt 2>&1 \
  && fail "an unlisted change passed" || { grep -q "desktop-b" out.txt && ok "an unlisted changed screen is refused and named" || fail "refusal does not name the screen: $(cat out.txt)"; }

task mobile-a mobile-c desktop-b mobile-z
bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$head" > out.txt 2>&1 \
  && fail "a listed screen that did not change passed" || { grep -q "mobile-z" out.txt && ok "a listed screen that did not change is refused and named" || fail "refusal does not name the screen: $(cat out.txt)"; }

printf 'id: T1\n' > tasks/T1.yml
bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$head" > out.txt 2>&1 && fail "a task with no visual: list changed baselines unnoticed" || ok "a task with no visual: list cannot change baselines"
bash scripts/visual/check-task.sh tasks/T1.yml "$head" "$head" > out.txt 2>&1 && ok "no baseline change and no list passes" || fail "an untouched baseline set was refused: $(cat out.txt)"

bash scripts/visual/publish-changes.sh T1 "$base" "$head" > out.txt 2>&1
page="$VISUAL_PAGES_DIR/T1-$(git rev-parse --short=10 "$head")"
grep -q "visual changes: http://example.test/pages/T1-.*/index.html" out.txt && [ -s "$page/index.html" ] && ok "a landed change publishes its page and prints the link" || fail "no page: $(cat out.txt)"
[ "$(cat "$page/mobile-a.before.png" | tail -c3)" = one ] && [ "$(tail -c3 "$page/mobile-a.after.png")" = two ] && ok "the page holds the picture before and after" || fail "wrong pictures on the page"
grep -q "mobile-c" "$page/index.html" && [ ! -e "$page/mobile-c.before.png" ] && [ -e "$page/mobile-c.after.png" ] && ok "a new screen shows no before" || fail "new screen wrong"
[ -e "$page/desktop-b.before.png" ] && [ ! -e "$page/desktop-b.after.png" ] && ok "a removed screen shows no after" || fail "removed screen wrong"
bash scripts/visual/publish-changes.sh T1 "$head" "$head" > out.txt 2>&1; [ ! -s out.txt ] && ok "no change publishes nothing" || fail "published for no change"

# a red run: Playwright's test-results
copy="$SCRATCH/copy"; mkdir -p "$copy/test-results/visual-mobile-a" "$copy/test-results/other-test"
png was "$copy/test-results/visual-mobile-a/mobile-a-expected.png"; png now "$copy/test-results/visual-mobile-a/mobile-a-actual.png"; png dif "$copy/test-results/visual-mobile-a/mobile-a-diff.png"
echo trace > "$copy/test-results/other-test/error-context.md"
bash scripts/visual/failures-page.sh "$copy" abcdef0123456789 > out.txt 2>&1
grep -q "^visual screens: mobile-a$" out.txt && grep -q "^visual page: http://example.test/pages/red-abcdef0123/index.html$" out.txt && ok "a red run names the differing screen and links its page" || fail "red output: $(cat out.txt)"
[ -e "$VISUAL_PAGES_DIR/red-abcdef0123/mobile-a.diff.png" ] && ok "the red page holds the difference picture" || fail "no diff picture"
rm -rf "$copy/test-results/visual-mobile-a"
bash scripts/visual/failures-page.sh "$copy" abcdef0123456789 > out.txt 2>&1; [ ! -s out.txt ] && ok "a red run with no screenshot failure prints nothing" || fail "printed for no screenshot failure: $(cat out.txt)"

# source hash: a task that changes UI sources must have re-taken the baselines on exactly them
. scripts/visual/lib.sh
git checkout -q -b src "$head" 2> /dev/null
mkdir -p packages/ui/src; printf '<template>a</template>' > packages/ui/src/A.vue
visual_sources_hash > "$VISUAL_SOURCES_HASH_FILE"
git add -A && git commit -qm "sources and hash" && s0=$(git rev-parse HEAD)
bash scripts/visual/check-sources.sh "$head" "$s0" > out.txt 2>&1 && ok "sources changed and hash re-taken on them passes" || fail "matching hash refused: $(cat out.txt)"
bash scripts/visual/check-sources.sh "$s0" "$s0" > out.txt 2>&1 && ok "no source change passes without a hash" || fail "no source change refused: $(cat out.txt)"

printf '<template>b</template>' > packages/ui/src/A.vue; git commit -qam "edit a source" && s1=$(git rev-parse HEAD)
bash scripts/visual/check-sources.sh "$s0" "$s1" > out.txt 2>&1 \
  && fail "a source edit with a stale hash passed" || { grep -q "packages/ui/src/A.vue" out.txt && grep -q "update.sh" out.txt && ok "a source edit with a stale hash is refused, naming the file and the fix" || fail "refusal text: $(cat out.txt)"; }

visual_sources_hash > "$VISUAL_SOURCES_HASH_FILE"; git commit -qam "re-take" && s2=$(git rev-parse HEAD)
bash scripts/visual/check-sources.sh "$s0" "$s2" > out.txt 2>&1 && ok "after re-taking on the edited sources it passes" || fail "re-taken refused: $(cat out.txt)"

printf '<template>c</template>' > packages/ui/src/B.vue; git add -A; git commit -qm "another source, as a rebase onto a moved main would bring" && s3=$(git rev-parse HEAD)
bash scripts/visual/check-sources.sh "$s0" "$s3" > out.txt 2>&1 && fail "a source added after the hash was recorded passed" || ok "a source that moved after the hash was recorded is refused"

mkdir -p packages/design/fields packages/design/engine; printf x > packages/design/fields/f.ts; printf y > packages/design/engine/calc.ts
git add -A; git commit -qm "design" -q; s4=$(git rev-parse HEAD)
git diff --name-only "$s3" "$s4" > /dev/null
[ "$(visual_sources_changed "$s3" "$s4")" = "$(printf 'packages/design/engine/calc.ts\npackages/design/fields/f.ts')" ] && ok "design label and engine sources count" || fail "source list wrong: $(visual_sources_changed "$s3" "$s4")"
mkdir -p packages/design/test; printf z > packages/design/test/t.ts; git add -A; git commit -qm "design test" -q; s5=$(git rev-parse HEAD)
[ -z "$(visual_sources_changed "$s4" "$s5")" ] && ok "a design test file is not a source" || fail "a design test counted as a source"

[ "$fails" = 0 ] && { echo "visual e2e: all passed"; exit 0; }
echo "visual e2e: $fails failed"; exit 1
