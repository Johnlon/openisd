#!/usr/bin/env bash
# Prints true when the pull request (or the merge queue's merged result) can change a baseline picture, so pr.yml's
# `visual` job must run the visual spec on it; false otherwise (T810). Run from a checkout with history.
#   bash scripts/visual/pr-needs-visual.sh <pull_request|merge_group> <merge-group-base-sha>
# Can change a picture: a UI source (scripts/visual/sources.txt), a baseline picture, the visual spec or its screens,
# the fixtures the screens use, the Playwright config, the test machine's image, the lockfile.
set -euo pipefail
event="${1:?usage: pr-needs-visual.sh <pull_request|merge_group> <merge-group-base-sha>}"; group_base="${2:-}"
case "$event" in
  pull_request) base="$(git rev-parse HEAD^1)" ;;
  merge_group) base="${group_base:?merge_group event without a base sha}" ;;
  *) echo "pr-needs-visual: event '$event' is not pull_request or merge_group" >&2; exit 1 ;;
esac
git cat-file -e "$base^{commit}" 2> /dev/null || git fetch -q origin "$base"
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mapfile -t extra < <(printf '%s\n' packages/ui/test/visual packages/ui/test/fixtures packages/ui/test/fixtures.ts playwright.config.js .github/ci-image package-lock.json)
{ visual_sources_changed "$base" HEAD; git diff --no-renames --name-only "$base" HEAD -- "${extra[@]}"; } | grep -q . && echo true || echo false
