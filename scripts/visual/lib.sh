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

# visual_note <task.yml>: the plain sentence(s) on what the user sees change; empty when the task has none.
visual_note() { sed -n 's/^visual_note: *//p' "$1" 2> /dev/null | head -n 1; }

# visual_changed_ids <base> <head>: the screens whose baseline picture differs between the commits.
visual_changed_ids() {
  git diff --no-renames --name-only "$1" "$2" -- "$VISUAL_SNAPSHOT_DIR" | sed -n 's#.*/\([^/]*\)\.png$#\1#p' | sort -u
}

# The file holding the hash of the sources the committed baselines were taken on.
VISUAL_SOURCES_HASH_FILE="${VISUAL_SOURCES_HASH_FILE:-packages/ui/test/visual/SOURCES.sha256}"
VISUAL_SOURCES_LIST="$VISUAL_SCRIPTS/sources.txt"

# visual_source_paths: the pathspecs of sources.txt, one per line.
visual_source_paths() { sed -e '/^#/d' -e '/^[[:space:]]*$/d' "$VISUAL_SOURCES_LIST"; }

# visual_sources_hash: one hash of every source file (tracked or new, not ignored)'s content and path, from the working tree.
visual_sources_hash() {
  local paths; mapfile -t paths < <(visual_source_paths)
  git ls-files -z --cached --others --exclude-standard -- "${paths[@]}" | sort -z | while IFS= read -r -d '' f; do
    printf '%s  %s\n' "$(git hash-object -- "$f")" "$f"
  done | sha256sum | cut -d' ' -f1
}

# visual_sources_changed <base> <head>: the changed files under the sources, one per line.
visual_sources_changed() {
  local paths; mapfile -t paths < <(visual_source_paths)
  git diff --no-renames --name-only "$1" "$2" -- "${paths[@]}"
}
