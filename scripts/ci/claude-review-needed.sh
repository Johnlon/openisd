#!/usr/bin/env bash
# Does a pull request need Claude's code review? (T818, John 15 Nov 2026)
#
#   bash scripts/ci/claude-review-needed.sh <base> <head>
#
# Prints `run=true` or `run=false` and a `reason=` line (both are lines of KEY=VALUE, so a workflow can append the
# output to $GITHUB_OUTPUT). A change that only touches task files, bug files, documents or baseline pictures has no
# code for a code review to read (the pictures have their own review, claude-review-pictures.yml), so it costs nothing.
set -euo pipefail
base="${1:?usage: claude-review-needed.sh <base> <head>}"; head="${2:?usage: claude-review-needed.sh <base> <head>}"
files="$(git diff --name-only --no-renames "$base" "$head")"
if [ -z "$files" ]; then echo "run=false"; echo "reason=the change touches no file"; exit 0; fi
while IFS= read -r f; do
  case "$f" in
    tasks/*|bugs/*|docs/*|*.md|packages/ui/test/visual/visual.browser.spec.ts-snapshots/*.png) ;;
    *) echo "run=true"; echo "reason=$f is code or configuration"; exit 0 ;;
  esac
done <<< "$files"
echo "run=false"; echo "reason=only task files, bug files, documents and baseline pictures changed"
