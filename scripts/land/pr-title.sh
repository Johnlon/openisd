#!/usr/bin/env bash
# The pull request title for a landing: "<id>: <goal>", at most 256 characters, which GitHub refuses to exceed
# ("Title is too long"). A longer goal is cut at a word and ends in "…"; the whole goal goes in the PR body.
#
#   . scripts/land/pr-title.sh; pr_title T398 "$goal"
#
# Sourced by scripts/land.sh. A goal over 250 characters refused every landing of its task (T410).
PR_TITLE_MAX=256

pr_title() {
  local id="$1" goal="${2:-}" head cut
  [ -n "$goal" ] || { printf '%s\n' "$id"; return 0; }
  local LC_ALL=C.UTF-8                                  # count characters, as GitHub does, not bytes
  goal="$(printf '%s' "$goal" | tr '\n\t' '  ' | sed 's/  */ /g; s/^ //; s/ $//')"   # one line
  head="$id: "
  if [ $(( ${#head} + ${#goal} )) -le "$PR_TITLE_MAX" ]; then
    printf '%s%s\n' "$head" "$goal"; return 0
  fi
  cut="${goal:0:$(( PR_TITLE_MAX - ${#head} - 1 ))}"    # room for the ellipsis
  case "$cut" in *" "*) cut="${cut% *}" ;; esac         # back to a word boundary
  printf '%s%s…\n' "$head" "$cut"
}
