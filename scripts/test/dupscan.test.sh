#!/usr/bin/env bash
# T905: the duplicate-logic check (scripts/dupscan.mjs) refuses a NEW copy of a formula and passes without it.
# A scratch tree holds one clean engine file and an empty allow-list; a second file carrying a driver-count
# formula must fail the run naming that file, and the shipped allow-list must pass on this repo.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JSCPD="$REPO/node_modules/.bin/jscpd"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/dupscan-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

mkdir -p "$SCRATCH/packages/design/engine"
printf 'export const area = (w: number, h: number): number => w + h;\n' > "$SCRATCH/packages/design/engine/clean.ts"
echo '{}' > "$SCRATCH/allow.json"
run() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" 2>&1; }

out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a scratch tree without the formula passes (exit 0)" || bad "clean tree should pass, got exit $rc: $out"

printf 'export const perDriver = (Vb: number, n: number): number => Vb / n;\n' > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/newcopy.ts' <<< "$out"; } && ok "a new formula copy is refused (exit 1) and named" || bad "new copy should exit 1 naming newcopy.ts, got exit $rc"

rm "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "removing the copy passes again (exit 0)" || bad "after removal should pass, got exit $rc"

out="$(node "$REPO/scripts/dupscan.mjs" "$REPO" --jscpd "$JSCPD" --allow "$REPO/scripts/dupscan-allow.json" 2>&1)"; rc=$?
[ "$rc" = 0 ] && ok "this repo passes with the shipped allow-list" || bad "repo should pass with its allow-list, got exit $rc: $out"

[ "$fails" = 0 ] || { echo "dupscan.test: $fails failed"; exit 1; }
echo "dupscan.test: all passed"
