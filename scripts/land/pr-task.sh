#!/usr/bin/env bash
# Which task a pull request carries (T749): the one tasks/T*.yml file the range adds or changes.
#
#   bash scripts/land/pr-task.sh <base> <head>      prints the task id; run from the repo root
#
# A task file whose only change is the sha256 of a locked file this change edits is not counted (T757).
# Exit 1, saying why on stderr, when the range touches no task file or more than one.
set -uo pipefail
base="${1:?usage: pr-task.sh <base> <head>}"; head="${2:?}"
cd "$(git rev-parse --show-toplevel)" || exit 2
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/core/task.sh"
changed="$(git diff --name-only "$base" "$head")"

# hash_only <task-id>: true when that task file exists on <base> and its only change is the `sha256:` of locked
# entries whose path this change edits (check-task-contract.sh asks for exactly that update in the same landing, T757).
hash_only() {
  local id="$1" file="tasks/$1.yml" path hash old
  git cat-file -e "$base:$file" 2> /dev/null || return 1
  git diff -U0 "$base" "$head" -- "$file" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' | grep -vqE '^[+-][[:space:]]+sha256: [0-9a-f]+$' && return 1
  old="$(mktemp)"; git show "$base:$file" > "$old"
  while read -r path hash; do
    [ "$(task_locked "$old" | awk -v p="$path" '$1 == p { print $2 }')" = "$hash" ] && continue
    grep -qxF "$path" <<< "$changed" || { rm -f "$old"; return 1; }
  done < <(task_locked "$file")
  rm -f "$old"
}

mapfile -t all < <(git diff --name-only --diff-filter=ACMR "$base" "$head" -- ':(glob)tasks/*.yml' | sed -n 's#^tasks/\([^/]*\)\.yml$#\1#p')
files=()
for id in "${all[@]}"; do hash_only "$id" || files+=("$id"); done
case "${#files[@]}" in
  1) printf '%s\n' "${files[0]}" ;;
  0) echo "pr-task: this change touches no tasks/<id>.yml; a pull request carries exactly one task (scripts/new-task.sh)" >&2; exit 1 ;;
  *) echo "pr-task: this change touches ${#files[@]} task files (${files[*]}); a pull request carries exactly one task" >&2; exit 1 ;;
esac
