#!/usr/bin/env bash
# The post-land suite runs BOTH halves, unit and browser, whichever fails: a red unit half must not
# hide the browser half (bugs/BUG_20261009_post-land-unit-red-skips-browser-specs.md). Exit status is
# non-zero when either failed. Fake npx and browser step. Not a locked spec.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/suite-halves.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }

SRC="$SCRATCH/clone"; COPY="$SCRATCH/copies/c1"
mkdir -p "$SRC/node_modules" "$COPY/scripts/land/post-land" "$SCRATCH/bin" "$SCRATCH/seen"
cp "$REPO/scripts/land/post-land/suite.sh" "$COPY/scripts/land/post-land/"
cp "$REPO/scripts/suite-lock.sh" "$COPY/scripts/"; cp -r "$REPO/scripts/lib" "$COPY/scripts/"
[ -f "$COPY/scripts/paths.sh" ] || cp "$REPO/scripts/paths.sh" "$COPY/scripts/"
cp "$REPO/scripts/budget.conf" "$COPY/scripts/"; export BUDGET_SUITE_HELD=1
export SUITE_RUN_LOCK="$SCRATCH/suite-run.lock"
export SEEN="$SCRATCH/seen" ADMIT_TOKEN=test-token PATH="$SCRATCH/bin:$PATH"
# the unit half (fake npx) and the browser half each leave a marker, and fail when told to
# suite.sh runs node_modules/.bin/vitest (S9: no npx inside the funnel); the copy hardlinks node_modules from SRC.
mkdir -p "$SRC/node_modules/.bin"
printf '#!/usr/bin/env bash\ntouch "$SEEN/unit"\n[ -f "$SEEN/unit-fails" ] && { echo "unit spec a.test.ts failed"; exit 1; }\nexit 0\n' > "$SRC/node_modules/.bin/vitest"
printf '#!/usr/bin/env bash\ntouch "$SEEN/browser"\n[ -f "$SEEN/browser-fails" ] && { echo "browser spec b.spec.ts failed"; exit 1; }\nexit 0\n' > "$COPY/scripts/test-browser.sh"
printf '#!/usr/bin/env bash\ntouch "$SEEN/shell"\n[ -f "$SEEN/shell-fails" ] && { echo "shell test c.test.sh failed"; exit 1; }\nexit 0\n' > "$COPY/scripts/test-shell.sh"
chmod +x "$SRC/node_modules/.bin/vitest"
run() { rm -f "$SEEN/unit" "$SEEN/browser"; ( cd "$COPY" && POST_LAND_SRC="$SRC" timeout 60 bash scripts/land/post-land/suite.sh ) > "$SCRATCH/out" 2>&1; echo $?; }

rm -f "$SEEN"/*-fails; r=$(run)
[ "$r" = 0 ] && [ -f "$SEEN/unit" ] && [ -f "$SEEN/browser" ] && ok "both green: both ran, exit 0" || fail "both green (r=$r)"

touch "$SEEN/unit-fails"; r=$(run)
[ "$r" != 0 ] && [ -f "$SEEN/browser" ] && ok "unit red: the browser half still ran, exit non-zero" || fail "unit red skipped the browser half (r=$r browser=$([ -f "$SEEN/browser" ] && echo ran || echo SKIPPED))"

touch "$SEEN/browser-fails"; r=$(run)
[ "$r" != 0 ] && grep -q "unit spec a.test.ts failed" "$SCRATCH/out" && grep -q "browser spec b.spec.ts failed" "$SCRATCH/out" \
    && ok "both red: exit non-zero and both failures are in the output" || fail "both red (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"

rm -f "$SEEN/unit-fails"; r=$(run)
[ "$r" != 0 ] && [ -f "$SEEN/unit" ] && ok "browser red alone: exit non-zero" || fail "browser red alone (r=$r)"

rm -f "$SEEN"/*-fails "$SEEN/shell"; touch "$SEEN/unit-fails" "$SEEN/browser-fails" "$SEEN/shell-fails"; r=$(run)
[ "$r" != 0 ] && grep -q "shell test c.test.sh failed" "$SCRATCH/out" && ok "all three red: the shell failure is in the output" || fail "shell red hidden (r=$r)"
rm -f "$SEEN"/*-fails; touch "$SEEN/shell-fails"; r=$(run)
[ "$r" != 0 ] && ok "shell red alone: exit non-zero" || fail "shell red alone passed the suite (r=$r)"

[ $fails = 0 ] && { echo "suite-both-halves: all passed"; exit 0; }
echo "suite-both-halves: $fails failed"; exit 1
