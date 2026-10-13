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

# task_self_check <tasks-dir>: check every locked sha256 in <tasks-dir>/*.yml against its file.
# Prints one line per problem or pending entry; returns 1 when any hash is wrong or a file with a
# real hash is missing. A hash of `pending` (the spec is not written yet) is reported, not failed.
task_self_check() {
  local file path hash actual bad=0 pending=0 checked=0
  for file in "$1"/*.yml; do
    [ -f "$file" ] || continue
    while read -r path hash; do
      [ -n "$path" ] || continue
      if [ "$hash" = "pending" ]; then
        echo "pending: $(task_field "$file" id) locks $path, hash not filled yet"
        pending=$((pending + 1))
        continue
      fi
      checked=$((checked + 1))
      if [ ! -f "$path" ]; then
        echo "FAIL: $(task_field "$file" id) locks $path, which does not exist"
        bad=$((bad + 1))
        continue
      fi
      actual="$(sha256sum "$path" | cut -d' ' -f1)"
      if [ "$actual" != "$hash" ]; then
        echo "FAIL: $(task_field "$file" id) locks $path, whose content has changed"
        bad=$((bad + 1))
      fi
    done < <(task_locked "$file")
  done
  echo "self-check: $checked locked file(s) checked, $bad wrong, $pending pending"
  [ "$bad" = 0 ]
}

# task_mark_done <file>: status open or claimed becomes done; any other status is left alone.
task_mark_done() {
  sed -i -e 's/^status: *\(open\|claimed\|todo\) *$/status: done/' "$1"
}

# task_mark_landed <file> <sha>: add `landed: <sha>` after the status line.
task_mark_landed() {
  sed -i "/^status:/a landed: $2" "$1"
}

# task_first_sentence <goal>: up to the first sentence end followed by a space.
task_first_sentence() {
  printf '%s' "$1" | sed 's/\([.!?]\) .*/\1/'
}

# task_commit_subject <id> <goal>: "<id>: <first sentence of goal>", the sentence cut to 72 chars.
task_commit_subject() {
  local sentence
  sentence="$(task_first_sentence "$2")"
  [ -n "$sentence" ] || { printf '%s' "$1"; return; }
  printf '%s: %s' "$1" "${sentence:0:72}"
}

# task_commit_message <id> <goal> <release_note>: subject, then the full goal when the subject cut
# the first sentence short, then the release note (omitted when `internal` or empty).
task_commit_message() {
  printf '%s\n' "$(task_commit_subject "$1" "$2")"
  if [ "$(task_first_sentence "$2" | wc -c)" -gt 72 ]; then printf '\n%s\n' "$2"; fi
  if [ -n "$3" ] && [ "$3" != internal ]; then printf '\n%s\n' "$3"; fi
}
