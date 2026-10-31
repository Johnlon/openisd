#!/usr/bin/env bash
# scripts/sync-driver-snapshot.sh in a scratch repo against a scratch git corpus: it bundles only
# the committed datasheets tree, ignores scraper WIP, and pins the source commit. The bundle step
# is a fake (SYNC_BUNDLE_CMD).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/sync-snap.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }

R="$SCRATCH/repo"; C="$SCRATCH/corpus"
mkdir -p "$R/scripts" "$R/packages/design/test/fixtures" "$SCRATCH/bin"
cp "$REPO/scripts/sync-driver-snapshot.sh" "$REPO/scripts/driverSnapshotPin.mjs" "$R/scripts/"
mkdir -p "$R/scripts/lib"; cp "$REPO/scripts/lib/main-folder.sh" "$R/scripts/lib/"
cat > "$SCRATCH/bin/fake-bundle" <<'EOS'
#!/usr/bin/env bash
ALL_ARGS="$*"
CORPUS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --corpus) CORPUS="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p packages/ui/public/drivers/a
echo '[]' > packages/ui/public/drivers-index.json
echo '[]' > packages/ui/public/passive-radiators-index.json
echo '{}' > packages/ui/public/drivers/a/b.json
echo "args: $ALL_ARGS" > "$SCRATCH_ARGS"
cat "$CORPUS/other/x/openisd.json" > "$SCRATCH_CORPUS_FILE"
if [ -e "$CORPUS/other/x/untracked.txt" ]; then echo yes > "$SCRATCH_UNTRACKED"; fi
EOS
chmod +x "$SCRATCH/bin/fake-bundle"
export SYNC_BUNDLE_CMD="$SCRATCH/bin/fake-bundle" SCRATCH_ARGS="$SCRATCH/args" \
  SCRATCH_CORPUS_FILE="$SCRATCH/corpus-value" SCRATCH_UNTRACKED="$SCRATCH/untracked-in-bundle"

D="$C/snapshot/datasheets"
mkdir -p "$D/accuton/bd90-6-727" "$D/dayton-audio/da215-8" "$D/other/x"
echo '{"a":1}' > "$D/accuton/bd90-6-727/driver.json"
echo '{"b":2}' > "$D/accuton/bd90-6-727/openisd.json"
echo '{"c":3}' > "$D/dayton-audio/da215-8/openisd.json"
echo '{"d":4}' > "$D/other/x/openisd.json"
git -C "$C" init -q && git -C "$C" add -A \
  && git -C "$C" -c user.name=t -c user.email=t@t commit -q -m snapshot
SHA="$(git -C "$C" rev-parse HEAD)"
SNAP="$R/packages/design/test/fixtures/driver-snapshot"
EXPECTED="$SCRATCH/expected"
mkdir -p "$EXPECTED"
for f in accuton/bd90-6-727/driver.json accuton/bd90-6-727/openisd.json dayton-audio/da215-8/openisd.json; do
  mkdir -p "$EXPECTED/$(dirname "$f")"
  git -C "$C" show "${SHA}:snapshot/datasheets/$f" > "$EXPECTED/$f"
done

run() { local corpus="$1"; shift; ( cd "$R" && bash scripts/sync-driver-snapshot.sh --corpus-root "$corpus" "$@" ) > "$SCRATCH/out" 2>&1; }
untouched() { [ ! -e "$SNAP" ] && [ ! -e "$R/scripts/driver-snapshot.pin" ] && [ ! -e "$R/packages/ui/public" ]; }

run "$SCRATCH/nope"; r=$?
[ $r = 1 ] && grep -q "$SCRATCH/nope" "$SCRATCH/out" && grep -qi 'not a git checkout' "$SCRATCH/out" && untouched \
  && ok "missing corpus dir refused, cause named" || fail "missing: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

# Dirty and untracked scraper work must not affect the committed bundle input.
echo '{"dirty":1}' > "$D/other/x/openisd.json"
echo '{"dirty":1}' > "$D/accuton/bd90-6-727/driver.json"
echo x > "$D/other/x/untracked.txt"
mkdir -p "$C/db.6/work" "$C/snapshot/runs"
echo wip > "$C/db.6/work/state.json"
echo run-log > "$C/snapshot/runs/stage-6.log"
echo x > "$C/scraper-notes.txt"

run "$C" --only-record accuton/bd90-6-727; r=$?
[ $r = 0 ] && ok "committed datasheets sync despite dirty scraper worktree" || fail "sync: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"
tr -d '\r' < "$SCRATCH_CORPUS_FILE" | cmp - <(git -C "$C" show "${SHA}:snapshot/datasheets/other/x/openisd.json") \
  && [ ! -e "$SCRATCH_UNTRACKED" ] && ok "bundle reads only committed datasheets" \
  || fail "bundle included scraper worktree changes"
PIN="$R/scripts/driver-snapshot.pin"
grep -q "\"winisd_drivers_commit\": \"$SHA\"" "$PIN" && ok "pin names the corpus commit" || fail "pin commit: $(cat "$PIN" 2>/dev/null)"
bad=0
for f in accuton/bd90-6-727/driver.json accuton/bd90-6-727/openisd.json dayton-audio/da215-8/openisd.json; do
  h="$(sha256sum "$SNAP/$f" | cut -d' ' -f1)"
  tr -d '\r' < "$SNAP/$f" | cmp -s - "$EXPECTED/$f" && grep -q "\"$f\": \"$h\"" "$PIN" || bad=1
done
[ $bad = 0 ] && [ "$(find "$SNAP" -type f | wc -l)" = 3 ] && ok "3 fixtures copied, hashes match the pin" || fail "fixtures differ from the pin"
grep -q "args: --corpus .* --only-record accuton/bd90-6-727 --force" "$SCRATCH/args" \
  && ok "bundle run against selected committed snapshot record" || fail "bundle args: $(cat "$SCRATCH/args" 2>/dev/null)"
want="$(cd "$R/packages/ui/public" && for f in $(find drivers-index.json passive-radiators-index.json drivers -type f | LC_ALL=C sort); do printf '%s\t%s\n' "$f" "$(sha256sum "$f" | cut -d' ' -f1)"; done | sha256sum | cut -d' ' -f1)"
grep -q "\"bundle_sha256\": \"$want\"" "$PIN" && ok "bundle_sha256 matches the output files" || fail "bundle hash: want $want, $(cat "$PIN")"

[ $fails = 0 ] && { echo "sync-driver-snapshot: all passed"; exit 0; }
echo "sync-driver-snapshot: $fails failed"; exit 1
