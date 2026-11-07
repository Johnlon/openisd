#!/usr/bin/env bash
# scripts/land/check-model-ruling.sh: a landing that changes a driver model file needs `ruling: QO<n>` in its task file.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
cd "$SCRATCH" && git init -q . && git config user.email t@t && git config user.name t && git config core.autocrlf false
mkdir -p packages/design/domain/driver tasks
echo a > packages/design/domain/openisdSchema.ts
echo a > other.txt
printf 'id: T9\n' > tasks/T9.yml
git add -A && git commit -qm base && base="$(git rev-parse HEAD)"
gate() { bash "$REPO/scripts/land/check-model-ruling.sh" T9 "$base" HEAD 2>&1; }

echo b > other.txt; git add -A && git commit -qm other
out="$(gate)"; rc=$?
[ "$rc" = 0 ] && ok "no model change passes" || fail "no model change refused: $out"

echo b > packages/design/domain/openisdSchema.ts; git add -A && git commit -qm model
out="$(gate)"; rc=$?
[ "$rc" = 1 ] && ok "model change without ruling refuses" || fail "rc $rc without ruling"
case "$out" in *openisdSchema.ts*"driver model change needs John's ruling: add \`ruling: QO<n>\` to tasks/T9.yml naming the board item where he ruled (QO392)"*) ok "message names file and fix" ;; *) fail "message: $out" ;; esac

printf 'id: T9\nruling: nonsense\n' > tasks/T9.yml
out="$(gate)"; rc=$?
[ "$rc" = 1 ] && ok "ruling: nonsense refuses" || fail "nonsense passed (rc $rc)"

printf 'id: T9\nruling: QO392\n' > tasks/T9.yml
out="$(gate)"; rc=$?
[ "$rc" = 0 ] && ok "ruling: QO392 passes" || fail "QO392 refused: $out"

[ "$fails" = 0 ] || { echo "$fails failed"; exit 1; }
