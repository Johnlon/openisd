#!/usr/bin/env bash
# Reads and edits a task file (tasks/<id>.yml). Sourced by scripts/land.sh.
#
# A task file holds top-level `key: value` lines, plus `locked:` as a list of
#   - path: <file>
#     sha256: <hash>
# pairs. Nothing here needs a YAML parser.

# task_field <file> <key>: the value of a top-level scalar, empty when absent.
task_field() {
  sed -n "s/^$2: *//p" "$1" | head -n 1
}

# task_locked <file>: one `<path> <sha256>` line per locked entry.
task_locked() {
  awk '
    /^locked:/ { inside = 1; next }
    inside && /^[^ ]/ { inside = 0 }
    inside && $1 == "-" && $2 == "path:" { path = $3 }
    inside && $1 == "sha256:" { print path, $2 }
  ' "$1"
}

# task_contract <file>: what the task author fixed, done_test and locked entries, as comparable text.
task_contract() {
  printf 'done_test: %s\n' "$(task_field "$1" done_test)"
  task_locked "$1"
}

# task_mark_blocked <file> <one-line reason>
task_mark_blocked() {
  sed -i -e '/^blocked_reason:/d' -e 's/^status: .*/status: blocked/' "$1"
  printf 'blocked_reason: %s\n' "$2" >> "$1"
}

# task_files <file>: the `files:` globs, one per line.
task_files() {
  awk '
    /^files:/ { inside = 1; next }
    inside && /^[^ ]/ { inside = 0 }
    inside && $1 == "-" { sub(/^ *- */, ""); print }
  ' "$1"
}

# task_missing_fields <file>: the required keys the file lacks, space separated; empty when well formed.
task_missing_fields() {
  local key missing=""
  for key in id owner status goal done_test; do
    [ -n "$(task_field "$1" "$key")" ] || missing="$missing $key"
  done
  [ -n "$(task_files "$1")" ] || missing="$missing files"
  echo "${missing# }"
}
