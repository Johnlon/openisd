#!/usr/bin/env bash
# After a red post-land run: the screens whose picture differs from its baseline, and a page showing
# each one's baseline (before), the run's picture (after) and the difference.
#   bash scripts/visual/failures-page.sh <clean-copy-dir> <sha>
# Prints "visual screens: a, b" and "visual page: <url>", or nothing when no screenshot test failed.
# Reads <clean-copy-dir>/test-results/*/<screen>-{expected,actual,diff}.png, which Playwright writes.
set -euo pipefail
copy="${1:?usage: failures-page.sh <clean-copy-dir> <sha>}"; sha="${2:?}"
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

entries="$(mktemp)"; trap 'rm -f "$entries"' EXIT
printf '[' > "$entries"; names=(); first=1
for actual in "$copy"/test-results/*/*-actual.png; do
  [ -e "$actual" ] || continue
  base="${actual%-actual.png}"; name="$(basename "$base")"
  [ -e "$base-expected.png" ] || continue
  [ "$first" = 1 ] || printf ',' >> "$entries"; first=0
  diff="null"; [ -e "$base-diff.png" ] && diff="\"$base-diff.png\""
  printf '{"name":"%s","before":"%s","after":"%s","diff":%s}' "$name" "$base-expected.png" "$actual" "$diff" >> "$entries"
  names+=("$name")
done
printf ']' >> "$entries"
[ "${#names[@]}" -gt 0 ] || exit 0

out="$VISUAL_PAGES_DIR/red-${sha:0:10}"
node "$VISUAL_SCRIPTS/diff-page.mjs" "$out" "Screens that differ from their baseline at ${sha:0:10}" "$entries" > /dev/null
printf 'visual screens: %s\n' "$(IFS=,; echo "${names[*]}" | sed 's/,/, /g')"
printf 'visual page: %s/red-%s/index.html\n' "$VISUAL_PAGES_URL" "${sha:0:10}"
