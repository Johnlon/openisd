#!/usr/bin/env bash
# T912: no tracked file points at a winisd_research note by its old path. On 18 Nov 2026 the research repo moved WINISD_MODEL.md,
# GHIDRA_FINDINGS.md, PROBE_FINDINGS.md, WINISD_IS_BUILT_ON_DPC.md, findings/ and parity/ under archive/ (John: "archive so not
# visited unless some strange cause"). A reference written as winisd_research/<moved name> without archive/ in front is a dead link.
# A scratch git tree proves the check: a bad reference fails and names the file; archive/ in front passes. Then every tracked file
# of this repo is scanned.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SELF="scripts/test/archived-research-paths.test.sh"
PATTERN='winisd_research/(WINISD_MODEL|GHIDRA_FINDINGS|PROBE_FINDINGS|WINISD_IS_BUILT_ON_DPC)\.md|winisd_research/(findings|parity)/'
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/archived-paths-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

# scan <git tree> <file to leave out>: prints file:line:text of each old-path reference, exit 0 when there is none.
# tasks/ is left out: a finished task's files: list records the paths it touched at the time, and task files are locked history.
scan() {
  local hits
  hits="$(git -C "$1" grep -nE "$PATTERN" -- . ":!$2" ":!tasks/" || true)"
  [ -z "$hits" ] || { echo "$hits"; return 1; }
}

git -C "$SCRATCH" init -q
printf 'see winisd_research/archive/GHIDRA_FINDINGS.md and winisd_research/spec/S04_sealed_box.md\n' > "$SCRATCH/good.md"
git -C "$SCRATCH" add good.md
scan "$SCRATCH" none.txt > /dev/null && ok "a reference with archive/ in front passes" || bad "archive/ reference should pass"

printf 'see winisd_research/GHIDRA_FINDINGS.md\n' > "$SCRATCH/bad.md"
printf '[bug](../../winisd_research/findings/FINDING_x.md)\n' > "$SCRATCH/bad2.ts"
git -C "$SCRATCH" add bad.md bad2.ts
out="$(scan "$SCRATCH" none.txt)"; rc=$?
{ [ "$rc" = 1 ] && grep -q '^bad.md:' <<< "$out" && grep -q '^bad2.ts:' <<< "$out"; } && ok "old-path references are refused and named" || bad "old paths should fail naming bad.md and bad2.ts, got rc $rc: $out"

out="$(scan "$REPO" "$SELF")"; rc=$?
echo "$out" | sed 's/^/  | /'
[ "$rc" = 0 ] && ok "no tracked file of this repo uses an old research path" || bad "tracked files reference moved winisd_research notes without archive/ (listed above)"

[ "$fails" = 0 ] || { echo "archived-research-paths.test: $fails failed"; exit 1; }
echo "archived-research-paths.test: all passed"
