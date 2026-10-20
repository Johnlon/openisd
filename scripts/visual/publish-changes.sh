#!/usr/bin/env bash
# After a landing that changed baselines: a before/after page of each changed screen, for John to approve.
#   bash scripts/visual/publish-changes.sh <task-id> <base> <head>
# Prints "visual changes: <url>", or nothing when no baseline changed. Pictures come from the two commits.
set -euo pipefail
task="${1:?usage: publish-changes.sh <task-id> <base> <head>}"; base="${2:?}"; head="${3:?}"
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ids="$(visual_changed_ids "$base" "$head")"
[ -n "$ids" ] || exit 0
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
entries="$work/entries.json"; printf '[' > "$entries"; first=1
while IFS= read -r id; do
  path="$VISUAL_SNAPSHOT_DIR/$id.png"
  before="null"; after="null"
  if git cat-file -e "$base:$path" 2> /dev/null; then git show "$base:$path" > "$work/$id.before.png"; before="\"$work/$id.before.png\""; fi
  if git cat-file -e "$head:$path" 2> /dev/null; then git show "$head:$path" > "$work/$id.after.png"; after="\"$work/$id.after.png\""; fi
  [ "$first" = 1 ] || printf ',' >> "$entries"; first=0
  printf '{"name":"%s","before":%s,"after":%s,"diff":null}' "$id" "$before" "$after" >> "$entries"
done <<< "$ids"
printf ']' >> "$entries"
out="$VISUAL_PAGES_DIR/${task}-$(git rev-parse --short=10 "$head")"
node "$VISUAL_SCRIPTS/diff-page.mjs" "$out" "$task: screens whose baseline changed" "$entries" "$task" > /dev/null
printf 'visual changes: %s/%s/index.html\n' "$VISUAL_PAGES_URL" "$(basename "$out")"
