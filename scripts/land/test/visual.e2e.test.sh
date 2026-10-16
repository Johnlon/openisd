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

[ "$fails" = 0 ] && { echo "visual e2e: all passed"; exit 0; }
echo "visual e2e: $fails failed"; exit 1
