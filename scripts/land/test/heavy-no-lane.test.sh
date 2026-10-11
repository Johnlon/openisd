#!/usr/bin/env bash
# Gates and targeted runs take no heavy lane (T044): with EVERY lane held, the lint gate, the
# typecheck wrapper and quiet-test.sh still start and finish. Lanes here are a scratch dir
# (HEAVY_LOCKDIR) with 2 lanes, both held by real flock holders; ~/bin/npx and ~/.claude/bin/heavy.sh
# read those env vars.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"
holders=()
cleanup() { for p in "${holders[@]}"; do kill "$p" 2>/dev/null; done; rm -rf "$SCRATCH"; }
trap cleanup EXIT

ok()   { echo "ok   $1"; }
fails=0
fail() { echo "FAIL $1"; fails=$((fails+1)); }

export HEAVY_LOCKDIR="$SCRATCH/lanes" HEAVY_LANES=2 HEAVY_WAIT=5
mkdir -p "$HEAVY_LOCKDIR"
for i in 1 2; do
  flock "$HEAVY_LOCKDIR/$i" sleep 120 & holders+=($!)
done
# the holders must own both locks before the probes start: a held lane refuses a non-blocking take
for i in 1 2; do
  timeout 5 bash -c 'until ! flock -n "$1" true; do :; done' _ "$HEAVY_LOCKDIR/$i" 2>/dev/null || true
done

cd "$REPO" || exit 1
probe() { # name, command...
  local name=$1; shift
  local out; out=$(timeout 90 "$@" 2>&1); local rc=$?
  if [ $rc = 0 ] && ! printf '%s' "$out" | grep -q "lanes busy"; then ok "$name runs with every lane held"
  else fail "$name (rc=$rc): $(printf '%s' "$out" | tail -3 | tr '\n' ' ')"; fi
}
probe "lint gate"            bash scripts/land/lint-changed.sh scripts/typecheck.mjs
probe "quiet-test eslint"    bash scripts/quiet-test.sh npx eslint --no-warn-ignored scripts/typecheck.mjs
probe "quiet-test tsc"       bash scripts/quiet-test.sh npx tsc --version
probe "typecheck gate"       bash -c '. land.conf; bash -c "${TYPECHECK_CMD/npm run typecheck/npx tsc --version}"'

[ $fails = 0 ] && { echo "heavy-no-lane: all passed"; exit 0; }
echo "heavy-no-lane: $fails failed"; exit 1
