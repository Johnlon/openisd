#!/usr/bin/env bash
# Which task a pull request carries (T749): the one tasks/T*.yml file the range adds or changes.
#
#   bash scripts/land/pr-task.sh <base> <head>      prints the task id; run from the repo root
#
# Exit 1, saying why on stderr, when the range touches no task file or more than one.
set -uo pipefail
base="${1:?usage: pr-task.sh <base> <head>}"; head="${2:?}"
cd "$(git rev-parse --show-toplevel)" || exit 2
mapfile -t files < <(git diff --name-only --diff-filter=ACMR "$base" "$head" -- ':(glob)tasks/*.yml' | sed -n 's#^tasks/\([^/]*\)\.yml$#\1#p')
case "${#files[@]}" in
  1) printf '%s\n' "${files[0]}" ;;
  0) echo "pr-task: this change touches no tasks/<id>.yml; a pull request carries exactly one task (scripts/new-task.sh)" >&2; exit 1 ;;
  *) echo "pr-task: this change touches ${#files[@]} task files (${files[*]}); a pull request carries exactly one task" >&2; exit 1 ;;
esac
