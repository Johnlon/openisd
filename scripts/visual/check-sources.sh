#!/usr/bin/env bash
# LEGACY (T810): only the retired land.sh path still runs this. Pull requests do not: the committed hash conflicted between
# every two UI pull requests, and pr.yml's `visual` job now runs the visual spec on the merged result instead.
# The land gate for source changes: a task that changes any file under scripts/visual/sources.txt must have
# re-taken the baselines on exactly the sources it lands with. The hash recorded by update.sh must match
# the sources in the working tree (after the rebase). No browser runs here.
#   bash scripts/visual/check-sources.sh <base> <head>
set -euo pipefail
base="${1:?usage: check-sources.sh <base> <head>}"; head="${2:?}"
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
changed="$(visual_sources_changed "$base" "$head")"
[ -n "$changed" ] || exit 0
recorded="$(cat "$VISUAL_SOURCES_HASH_FILE" 2> /dev/null || true)"
if [ "$recorded" != "$(visual_sources_hash)" ]; then
  printf 'visual: this task changes UI sources, and the baselines were not re-taken on them (after the rebase):\n%s\n' "$(printf '%s\n' "$changed" | sed 's/^/  /')"
  printf 'Run: bash scripts/visual/update.sh  (all screens), or with the screen ids that moved; then list the changed screens under visual: and add %s and the baseline pictures to files:.\n' "$VISUAL_SOURCES_HASH_FILE"
  exit 1
fi
