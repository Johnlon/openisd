#!/usr/bin/env bash
# scripts/sync-driver-snapshot.sh in a scratch repo against a scratch git corpus: it refuses a
# dirty or missing corpus and writes nothing; on a clean one it copies the 3 fixtures and writes
# the pin naming the corpus commit. The bundle step is a fake (SYNC_BUNDLE_CMD).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/sync-snap.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }

R="$SCRATCH/repo"; C="$SCRATCH/corpus"
mkdir -p "$R/scripts" "$R/packages/design/test/fixtures" "$SCRATCH/bin"
cp "$REPO/scripts/sync-driver-snapshot.sh" "$REPO/scripts/driverSnapshotPin.mjs" "$R/scripts/"
cat > "$SCRATCH/bin/fake-bundle" <<'EOS'
#!/usr/bin/env bash
mkdir -p packages/ui/public/drivers/a
echo '[]' > packages/ui/public/drivers-index.json
echo '[]' > packages/ui/public/passive-radiators-index.json
echo '{}' > packages/ui/public/drivers/a/b.json
echo "args: $*" > "$SCRATCH_ARGS"
EOS
chmod +x "$SCRATCH/bin/fake-bundle"
export SYNC_BUNDLE_CMD="$SCRATCH/bin/fake-bundle" SCRATCH_ARGS="$SCRATCH/args"

D="$C/db/datasheets"
mkdir -p "$D/accuton/bd90-6-727" "$D/dayton-audio/da215-8" "$D/other/x"
echo '{"a":1}' > "$D/accuton/bd90-6-727/driver.json"
echo '{"b":2}' > "$D/accuton/bd90-6-727/openisd.json"
echo '{"c":3}' > "$D/dayton-audio/da215-8/openisd.json"
echo '{"d":4}' > "$D/other/x/openisd.json"
git -C "$C" init -q && git -C "$C" add -A \
  && git -C "$C" -c user.name=t -c user.email=t@t commit -q -m corpus
SHA="$(git -C "$C" rev-parse HEAD)"
SNAP="$R/packages/design/test/fixtures/driver-snapshot"

run() { ( cd "$R" && bash scripts/sync-driver-snapshot.sh --corpus-root "$1" ) > "$SCRATCH/out" 2>&1; }
untouched() { [ ! -e "$SNAP" ] && [ ! -e "$R/scripts/driver-snapshot.pin" ] && [ ! -e "$R/packages/ui/public" ]; }

echo '{"dirty":1}' >> "$D/other/x/openisd.json"
run "$C"; r=$?
[ $r = 1 ] && grep -qi 'not clean' "$SCRATCH/out" && untouched && ok "dirty checkout refused, nothing written" \
  || fail "dirty: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"
git -C "$C" checkout -q -- . 2>/dev/null

echo x > "$C/untracked.txt"
run "$C"; r=$?
[ $r = 1 ] && grep -qi 'not clean' "$SCRATCH/out" && untouched && ok "untracked file refused" \
  || fail "untracked: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"
rm "$C/untracked.txt"

run "$SCRATCH/nope"; r=$?
[ $r = 1 ] && grep -q "$SCRATCH/nope" "$SCRATCH/out" && grep -qi 'not a git checkout' "$SCRATCH/out" && untouched \
  && ok "missing corpus dir refused, cause named" || fail "missing: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

run "$C"; r=$?
[ $r = 0 ] && ok "clean checkout syncs" || fail "clean: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"
PIN="$R/scripts/driver-snapshot.pin"
grep -q "\"winisd_drivers_commit\": \"$SHA\"" "$PIN" && ok "pin names the corpus commit" || fail "pin commit: $(cat "$PIN" 2>/dev/null)"
bad=0
for f in accuton/bd90-6-727/driver.json accuton/bd90-6-727/openisd.json dayton-audio/da215-8/openisd.json; do
  h="$(sha256sum "$SNAP/$f" | cut -d' ' -f1)"
  cmp -s "$SNAP/$f" "$D/$f" && grep -q "\"$f\": \"$h\"" "$PIN" || bad=1
done
[ $bad = 0 ] && [ "$(find "$SNAP" -type f | wc -l)" = 3 ] && ok "3 fixtures copied, hashes match the pin" || fail "fixtures differ from the pin"
grep -q 'args: --corpus '"$D"' --force' "$SCRATCH/args" && ok "bundle run against the corpus datasheets" || fail "bundle args: $(cat "$SCRATCH/args" 2>/dev/null)"
want="$(cd "$R/packages/ui/public" && for f in $(find drivers-index.json passive-radiators-index.json drivers -type f | LC_ALL=C sort); do printf '%s\t%s\n' "$f" "$(sha256sum "$f" | cut -d' ' -f1)"; done | sha256sum | cut -d' ' -f1)"
grep -q "\"bundle_sha256\": \"$want\"" "$PIN" && ok "bundle_sha256 matches the output files" || fail "bundle hash: want $want, $(cat "$PIN")"

[ $fails = 0 ] && { echo "sync-driver-snapshot: all passed"; exit 0; }
echo "sync-driver-snapshot: $fails failed"; exit 1
