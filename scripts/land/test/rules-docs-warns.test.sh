#!/usr/bin/env bash
# T783 (John 10 Nov 2026, rules review rule 1): the rule-docs wording check warns, it never fails the build.
# Copies rules-docs.test.sh into a scratch tree whose docs lack every required word and still carry a retired
# term, then expects exit 0 with WARN lines naming both.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
mkdir -p "$SCRATCH/scripts/land/test" "$SCRATCH/scripts/hooks-local" "$SCRATCH/.claude/rules" "$SCRATCH/docs"
cp "$HERE/rules-docs.test.sh" "$SCRATCH/scripts/land/test/"
echo 'nothing useful; slow-run/queue.sh' > "$SCRATCH/.claude/rules/verify.md"
echo 'empty' > "$SCRATCH/.claude/rules/processes.md"
echo 'empty' > "$SCRATCH/docs/DEV_PROCESS.md"
printf '#!/bin/sh\ntrue\n' > "$SCRATCH/scripts/hooks-local/pre-commit"
printf '#!/bin/sh\ntrue\n' > "$SCRATCH/scripts/hooks-local/pre-push"
out="$(bash "$SCRATCH/scripts/land/test/rules-docs.test.sh" 2>&1)"; rc=$?
fails=0
chk() { if [ "$1" = ok ]; then echo "ok   $2"; else echo "FAIL $2"; fails=$((fails + 1)); fi; }
[ "$rc" = 0 ] && chk ok "exit 0 with missing and retired words" || chk no "exit $rc, expected 0"
grep -q 'WARN.*lacks: scripts/ship.sh' <<< "$out" && chk ok "missing word warned" || chk no "no WARN for a missing word"
grep -q "WARN.*retired.*slow-run/queue.sh" <<< "$out" && chk ok "retired term warned" || chk no "no WARN for a retired term"
! grep -q '^FAIL' <<< "$out" && chk ok "no FAIL line" || chk no "a FAIL line remains"
grep -q 'passed, [1-9][0-9]* warnings' <<< "$out" && chk ok "warning count printed" || chk no "no warning count"
printf '#!/bin/sh\nnpm run test:unit\n' > "$SCRATCH/scripts/hooks-local/pre-commit"
bash "$SCRATCH/scripts/land/test/rules-docs.test.sh" > /dev/null 2>&1 && chk no "slow hook still passes" || chk ok "a slow-suite hook still fails"
[ $fails = 0 ] && { echo "rules-docs-warns: all passed"; exit 0; }
echo "rules-docs-warns: $fails failed"; exit 1
