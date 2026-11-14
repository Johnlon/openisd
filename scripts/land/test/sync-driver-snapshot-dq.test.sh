#!/usr/bin/env bash
# Gate A in scripts/sync-driver-snapshot.sh, in a scratch repo against a scratch git corpus with
# synthetic dq.alert files: a rise in a kind's count is refused unless --dq-ruling QO<n> names it;
# a pass rewrites scripts/driver-snapshot.dq-baseline.json. The bundle step is a fake (SYNC_BUNDLE_CMD).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/sync-dq.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }

R="$SCRATCH/repo"; C="$SCRATCH/corpus"; D="$C/snapshot/datasheets"
mkdir -p "$R/scripts/lib" "$R/packages/design/test/fixtures" "$SCRATCH/bin"
cp "$REPO/scripts/sync-driver-snapshot.sh" "$REPO/scripts/driverSnapshotPin.mjs" "$REPO/scripts/dqRatchet.mjs" "$R/scripts/"
cp "$REPO/scripts/lib/main-folder.sh" "$R/scripts/lib/"
cat > "$SCRATCH/bin/fake-bundle" <<'EOS'
#!/usr/bin/env bash
mkdir -p packages/ui/public/drivers/a
echo '[]' > packages/ui/public/drivers-index.json
echo '[]' > packages/ui/public/passive-radiators-index.json
echo '{}' > packages/ui/public/drivers/a/b.json
EOS
chmod +x "$SCRATCH/bin/fake-bundle"
export SYNC_BUNDLE_CMD="$SCRATCH/bin/fake-bundle"

mkdir -p "$D/accuton/bd90-6-727" "$D/dayton-audio/da215-8" "$D/other/x" "$D/other/y"
echo '{"a":1}' > "$D/accuton/bd90-6-727/driver.json"
echo '{"b":2}' > "$D/accuton/bd90-6-727/openisd.json"
echo '{"c":3}' > "$D/dayton-audio/da215-8/openisd.json"
cat > "$D/other/x/dq.alert" <<'EOS'
Qes: Qes disagree by 12.5%: Qes = 2π·Fs
Fs_hz: Fs disagree by 3%
EOS
git -C "$C" init -q
commit() { git -C "$C" add -A && git -C "$C" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "$1"; }
commit base

BASE="$R/scripts/driver-snapshot.dq-baseline.json"
run() { ( cd "$R" && bash scripts/sync-driver-snapshot.sh --corpus-root "$C" "$@" ) > "$SCRATCH/out" 2>&1; }
count() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(b.counts[process.argv[2]]??"none")' "$BASE" "$1"; }
ruling() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(b.rulings[process.argv[2]]??"none")' "$BASE" "$1"; }
QES='Qes: Qes disagree by #%: Qes = #π·Fs'

# Missing baseline counts as empty: the first alerts are a rise.
run; r=$?
[ $r = 1 ] && grep -q "Gate A" "$SCRATCH/out" && [ ! -e "$BASE" ] && ok "alerts with no baseline refused" || fail "no baseline: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

run --dq-ruling QO900; r=$?
[ $r = 0 ] && [ "$(count "$QES")" = 1 ] && [ "$(ruling "$QES")" = QO900 ] && ok "initial baseline recorded under a ruling" || fail "initial: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

run; r=$?
[ $r = 0 ] && [ "$(count "$QES")" = 1 ] && ok "equal counts pass" || fail "equal: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

echo 'Qes: Qes disagree by 99%: Qes = 2π·Fs' >> "$D/other/x/dq.alert"
commit plus-one
run; r=$?
[ $r = 1 ] && grep -q "1 -> 2" "$SCRATCH/out" && grep -q 'other/x: Qes: Qes disagree by 99%' "$SCRATCH/out" && [ "$(count "$QES")" = 1 ] \
  && ok "+1 line refused, line named, baseline untouched" || fail "+1: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

echo 'Qms: new kind of warning' > "$D/other/y/dq.alert"
git -C "$C" checkout -q -- . 2>/dev/null; git -C "$C" reset -q --hard HEAD~1
echo 'Qms: new kind of warning' > "$D/other/y/dq.alert"; commit new-kind
run; r=$?
[ $r = 1 ] && grep -q 'Qms: new kind of warning  0 -> 1' "$SCRATCH/out" && grep -q 'other/y: Qms' "$SCRATCH/out" \
  && ok "new kind refused" || fail "new kind: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

run --dq-ruling QO903; r=$?
[ $r = 0 ] && [ "$(count 'Qms: new kind of warning')" = 1 ] && [ "$(ruling 'Qms: new kind of warning')" = QO903 ] && [ "$(ruling "$QES")" = QO900 ] \
  && ok "rise with --dq-ruling QO903 passes and records QO903" || fail "ruled: exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"

before="$(cat "$BASE")"
echo 'Qms: another new kind' > "$D/other/y/dq.alert"; commit rise-again
for bad in QO 903 qo903 "QO9x" "QO903;"; do
  run --dq-ruling "$bad"; r=$?
  [ $r = 1 ] && grep -q 'QO<n>' "$SCRATCH/out" && [ "$(cat "$BASE")" = "$before" ] || fail "bad id '$bad': exit $r, $(tr '\n' ' ' < "$SCRATCH/out")"
done
[ $fails = 0 ] && ok "bad ruling ids refused, baseline untouched"

rm -f "$D/other/y/dq.alert"; : > "$D/other/x/dq.alert"; echo 'Fs_hz: Fs disagree by 3%' > "$D/other/x/dq.alert"; commit fewer
run; r=$?
[ $r = 0 ] && [ "$(count "$QES")" = none ] && [ "$(count 'Fs_hz: Fs disagree by #%')" = 1 ] && [ "$(ruling "$QES")" = none ] \
  && ok "fewer lines pass and the baseline is lowered" || fail "fewer: exit $r, $(tr '\n' ' ' < "$SCRATCH/out"); $(cat "$BASE")"

[ $fails = 0 ] && { echo "sync-driver-snapshot-dq: all passed"; exit 0; }
echo "sync-driver-snapshot-dq: $fails failed"; exit 1
