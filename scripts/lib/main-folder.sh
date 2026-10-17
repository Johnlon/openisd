#!/usr/bin/env bash
# The main folder (the main checkout) and the preview copy are kept at the last passed commit by
# scripts/land/sync-main-folder.sh (T328, John 17 Oct 2026). Nothing is written in them: agents work in worktrees
# of their own. sync-main-folder.sh lists the main folder as openisd.mainFolder in the repo's git config, and
# the preview is listed as openisd.syncedCopy. Every tool that writes into the checkout it runs in sources this
# file and calls refuse_in_main_folder first.

# refuse_in_main_folder <tool>: exit 2 when the current directory is inside the main folder or a synced copy.
refuse_in_main_folder() {
  local top
  top="$(git rev-parse --show-toplevel 2> /dev/null)" || return 0
  { git config --get openisd.mainFolder; git config --get-all openisd.syncedCopy; } 2> /dev/null | grep -qxF -- "$top" || return 0
  printf '%s: REFUSED: %s is kept at main by scripts/land/sync-main-folder.sh; nothing is written there.\nWork in a worktree of your own: bash scripts/new-task.sh <owner> "<goal>" && cd <worktree>\n' "$1" "$top" >&2
  exit 2
}
