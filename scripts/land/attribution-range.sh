#!/usr/bin/env bash
# The attribution gate over a range, shared by scripts/land.sh and the pull request check (T749):
#
#   bash scripts/land/attribution-range.sh <base> <head>      run from the repo root
#
# Feeds every commit message in <base>..<head> to the attribution guard on stdin (ATTRIBUTION_CMD from the
# environment, else scripts/hooks-local/no-ai-attribution.sh). Exit 1 names the commit whose message was refused.
set -uo pipefail
base="${1:?usage: attribution-range.sh <base> <head>}"; head="${2:?}"
cd "$(git rev-parse --show-toplevel)" || exit 2
cmd="${ATTRIBUTION_CMD:-bash scripts/hooks-local/no-ai-attribution.sh}"
work="$(mktemp)"; trap 'rm -f "$work"' EXIT
rc=0
for sha in $(git rev-list "$base..$head"); do
  git log -1 --format=%B "$sha" > "$work"
  if ! bash -c "$cmd" < "$work"; then echo "attribution: commit $sha refused"; rc=1; fi
done
exit "$rc"
