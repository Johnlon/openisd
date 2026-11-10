#!/usr/bin/env bash
# Which tasks a pull request carries (T749, T762): the tasks/T*.yml files the range adds or changes.
#
#   bash scripts/land/pr-task.sh <base> <head>      prints the task ids, space separated, in file order; run from the repo root
#
# A task file whose only change is the sha256 of a locked file this change edits is not counted (T757).
# A pull request may carry several tasks (John, 10 Nov 2026: "go with A") when every changed file outside tasks/
# is in at least one of those tasks' `files:` allowlists. Exit 1, saying why on stderr, when the range touches
# no task file, or when a changed file is in none of the carried tasks' allowlists.
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

# Task files are the record of why each change was made (T767, QO528): none is deleted or renamed.
gone="$(git diff --no-renames --name-only --diff-filter=D "$base" "$head" -- ':(glob)tasks/T*.yml')"
[ -z "$gone" ] || { echo "pr-task: task files are never deleted or renamed: $(echo $gone)" >&2; exit 1; }
mapfile -t all < <(git diff --name-only --diff-filter=ACMR "$base" "$head" -- ':(glob)tasks/*.yml' | sed -n 's#^tasks/\([^/]*\)\.yml$#\1#p')
files=()
for id in "${all[@]}"; do hash_only "$id" || files+=("$id"); done
[ "${#files[@]}" -gt 0 ] || { echo "pr-task: this change touches no tasks/<id>.yml; a pull request carries at least one task (scripts/new-task.sh)" >&2; exit 1; }
if [ "${#files[@]}" -gt 1 ]; then
  # Several tasks: each changed file must be in some carried task's allowlist (git `:(glob)` semantics, as check-commit.sh).
  specs=()
  for id in "${files[@]}"; do
    while IFS= read -r glob; do specs+=(":(glob)$glob"); done < <(task_files "tasks/$id.yml")
  done
  [ "${#specs[@]}" -gt 0 ] || specs=(":(literal)/no-allowlist")   # an empty pathspec would match every file
  outside="$(comm -23 <(git diff --name-only "$base" "$head" | grep -v '^tasks/[^/]*\.yml$' | sort) \
    <(git diff --name-only "$base" "$head" -- "${specs[@]}" | sort))"
  if [ -n "$outside" ]; then
    echo "pr-task: this change carries ${files[*]}, but these files are in none of their allowlists:" >&2
    printf '  %s\n' $outside >&2
    exit 1
  fi
fi
echo "${files[*]}"
