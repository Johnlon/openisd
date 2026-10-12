#!/usr/bin/env bash
# Every tasks/T*.yml says the truth about main:
#  - status is one of: open claimed done superseded backlog blocked
#  - status done has a landed: line whose sha is an ancestor of origin/main
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1
ALLOWED=" open claimed done superseded backlog blocked "
BASE="origin/main"
git rev-parse --verify -q "$BASE" >/dev/null || BASE="main"
bad=0
n=0
for f in tasks/T*.yml; do
  n=$((n + 1))
  status=$(sed -n 's/^status:[[:space:]]*\([A-Za-z-]*\).*/\1/p' "$f" | head -1)
  case "$ALLOWED" in
    *" $status "*) [ -n "$status" ] || { echo "FAIL $f: no status"; bad=1; continue; } ;;
    *) echo "FAIL $f: unknown status '$status'"; bad=1; continue ;;
  esac
  if [ "$status" = done ]; then
    sha=$(sed -n 's/^landed:[[:space:]]*\([0-9a-f]\{7,40\}\).*/\1/p' "$f" | head -1)
    if [ -z "$sha" ]; then echo "FAIL $f: status done without a landed: sha"; bad=1; continue; fi
    if ! git merge-base --is-ancestor "$sha" "$BASE" 2>/dev/null; then
      echo "FAIL $f: landed sha $sha is not on $BASE"; bad=1
    fi
  fi
done
# Every task file (T*.yml and F*-fix.yml) carries release_note: the word internal, or one plain
# sentence for users. A sentence never holds a task id, a hash or a branch name: the release notes
# print it as written.
for f in tasks/*.yml; do
  note=$(sed -n 's/^release_note:[[:space:]]*//p' "$f" | head -1 | sed 's/^"\(.*\)"$/\1/')
  if [ -z "$note" ]; then echo "FAIL $f: no release_note (a user sentence, or internal)"; bad=1; continue; fi
  [ "$note" = internal ] && continue
  case "$note" in *.) ;; *) echo "FAIL $f: release_note is not a sentence ending in a full stop"; bad=1 ;; esac
  if printf '%s' "$note" | grep -qE '(^|[^A-Za-z0-9])([TFQ][0-9]{1,3}|[0-9a-f]{7,40})([^A-Za-z0-9]|$)'; then
    echo "FAIL $f: release_note holds a task id or a hash"; bad=1
  fi
done
[ "$n" -gt 0 ] || { echo "FAIL no tasks/T*.yml"; exit 1; }
[ "$bad" -eq 0 ] && echo "ok   $n task files say the truth about $BASE"
exit "$bad"
