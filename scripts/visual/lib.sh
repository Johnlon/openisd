#!/usr/bin/env bash
# Shared by the visual-baseline scripts. Source it.
#   VISUAL_SNAPSHOT_DIR  where the baselines live, relative to the repo root
#   VISUAL_PAGES_DIR     where before/after pages are written; it is served by the httpd on lap:8000
#   VISUAL_PAGES_URL     the URL of VISUAL_PAGES_DIR
VISUAL_SNAPSHOT_DIR="${VISUAL_SNAPSHOT_DIR:-packages/ui/test/visual/visual.browser.spec.ts-snapshots}"
VISUAL_PAGES_DIR="${VISUAL_PAGES_DIR:-/home/john/work/winisd/visual-pages}"
VISUAL_PAGES_URL="${VISUAL_PAGES_URL:-http://lap:8000/winisd/visual-pages}"
VISUAL_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# visual_screen_ids <task.yml>: the screens a task lists under `visual:`, one per line, sorted.
visual_screen_ids() {
  awk '/^visual:/ {on=1; next} on && /^  - / {sub(/^  - /, ""); print; next} on {on=0}' "$1" | sort -u
}

# visual_changed_ids <base> <head>: the screens whose baseline picture differs between the commits.
visual_changed_ids() {
  git diff --no-renames --name-only "$1" "$2" -- "$VISUAL_SNAPSHOT_DIR" | sed -n 's#.*/\([^/]*\)\.png$#\1#p' | sort -u
}
