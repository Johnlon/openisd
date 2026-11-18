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

# T911 (QO949): a consolidated copy stays in the allow-list, marked resolved and resolved to the engine function; it
# never allows its key again, and an allowed entry whose copy is gone fails until it is marked resolved.
COPY_LINE='export const perDriver = (Vb: number, n: number): number => Vb / n;'
KEY="sig|driver-count-scaling|packages/design/engine/newcopy.ts|$COPY_LINE"
resolved_allow() { node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1,
  resolved: true, resolved_to: "packages/design/engine/sealedResonance.ts:arrayVas", resolved_by: "T902", ruling: "QO949"}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"; }
allowed_allow() { node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"; }

allowed_allow
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "an allowed copy that is still there passes (exit 0)" || bad "allowed copy should pass, got exit $rc: $out"

rm "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'mark it resolved' <<< "$out"; } && ok "an allowed entry whose copy is gone fails until it is marked resolved (exit 1)" || bad "stale unresolved entry should exit 1 saying mark it resolved, got exit $rc"

resolved_allow
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a resolved entry whose copy is gone passes (exit 0)" || bad "resolved entry with its copy absent should pass, got exit $rc: $out"

printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'consolidated into packages/design/engine/sealedResonance.ts:arrayVas by T902; call packages/design/engine/sealedResonance.ts:arrayVas' <<< "$out"; } \
  && ok "a resolved copy that reappears fails (exit 1) naming the function to call" || bad "reappearing resolved copy should exit 1 naming arrayVas and T902, got exit $rc"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, resolved: true}}));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'resolved_to' <<< "$out"; } && ok "a resolved entry without resolved_to, resolved_by and ruling is refused (exit 1)" || bad "incomplete resolved entry should exit 1 naming resolved_to, got exit $rc: $out"
echo '{}' > "$SCRATCH/allow.json"

out="$(node "$REPO/scripts/dupscan.mjs" "$REPO" --jscpd "$JSCPD" --allow "$REPO/scripts/dupscan-allow.json" 2>&1)"; rc=$?
[ "$rc" = 0 ] && ok "this repo passes with the shipped allow-list" || bad "repo should pass with its allow-list, got exit $rc: $out"

[ "$fails" = 0 ] || { echo "dupscan.test: $fails failed"; exit 1; }
echo "dupscan.test: all passed"
