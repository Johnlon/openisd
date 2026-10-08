#!/usr/bin/env bash
# T004 acceptance (locked; author lots). The rule docs describe one process: land.sh and the
# post-land run. Nothing in them still tells an agent to use the queue, announce slow runs or rely
# on the pre-commit hook for the full suite.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

RULES=("$REPO/.claude/rules/verify.md" "$REPO/.claude/rules/processes.md" "$REPO/docs/DEV_PROCESS.md")
for f in "${RULES[@]}"; do [ -f "$f" ] && ok "exists: ${f#$REPO/}" || fail "missing: ${f#$REPO/}"; done

# retired instructions: none may remain in any rule doc
RETIRED=(
  'slow-run/queue.sh'
  'queue ticket'
  'tell each other before'
  'announced to the coordinator'
  'pre-commit hook is the only full run'
  'FLAKY'
  'rerun once'
  'commit-in-progress'
)
for term in "${RETIRED[@]}"; do
    hits=$(grep -lF -- "$term" "${RULES[@]}" 2>/dev/null | sed "s#$REPO/##" | tr '\n' ' ')
    [ -z "$hits" ] && ok "retired: $term" || fail "retired term '$term' still in: $hits"
done

# the new process is described where agents read it
need() { grep -qF -- "$2" "$REPO/$1" && ok "$1 names: $2" || fail "$1 lacks: $2"; }
need .claude/rules/verify.md     'scripts/land.sh'
need .claude/rules/verify.md     'post-land'
need .claude/rules/processes.md  'scripts/land.sh'
need docs/DEV_PROCESS.md         'scripts/land.sh'
need docs/DEV_PROCESS.md         'tasks/'
need docs/DEV_PROCESS.md         'done_test'
need docs/DEV_PROCESS.md         'locked'
need docs/DEV_PROCESS.md         'release'
need docs/DEV_PROCESS.md         'tasks/fixes/'

# John's standing rules survive the rewrite
need .claude/rules/verify.md     'no-verify'
need .claude/rules/verify.md     'AI-attribution'
need .claude/rules/processes.md  'pgrep -f'

# the hooks run only fast gates: no full unit or browser suite in pre-commit or pre-push
for h in pre-commit pre-push; do
    f="$REPO/scripts/hooks-local/$h"
    if [ -f "$f" ] && ! grep -Eq 'test:unit|playwright test|health-check|slow-run' "$f"; then
        ok "$h runs fast gates only"; else fail "$h still runs a slow suite or is missing"; fi
done

[ $fails = 0 ] && { echo "rules-docs: all passed"; exit 0; }
echo "rules-docs: $fails failed"; exit 1
