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

# task_missing_fields <file> [--why]: the required keys the file lacks, space separated; empty when well formed.
# With --why (pull request mode, a task file the PR adds or really changes) `why` is required too.
task_missing_fields() {
  local key missing="" keys="id owner status goal done_test"
  [ "${2:-}" = --why ] && keys="$keys why"
  for key in $keys; do
    [ -n "$(task_field "$1" "$key")" ] || missing="$missing $key"
  done
  [ -n "$(task_files "$1")" ] || missing="$missing files"
  echo "${missing# }"
}

# task_why_problem <file>: empty when the `why:` line is a real reason, else what is wrong (T767, QO528).
# At least 20 characters, not the goal, and it names who decided and when ("John, 10 Nov 2026") or an id (QO<n>, BUG, F<n>).
task_why_problem() {
  local why goal
  why="$(task_field "$1" why)"; goal="$(task_field "$1" goal)"
  [ "${#why}" -ge 20 ] || { echo "why is under 20 characters"; return; }
  [ "$why" != "$goal" ] || { echo "why repeats the goal"; return; }
  printf '%s' "$why" | grep -Eq '[A-Z][a-z]+, [0-9]{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* 20[0-9]{2}|(^|[^A-Za-z0-9])(QO[0-9]+|F[0-9]+|BUG[-_A-Za-z0-9]*)' \
    || echo "why names no person with a date (John, 10 Nov 2026) and no QO, F or BUG id"
}

# task_old_edit_exempt <base> <head> <file>: true when <file> exists on <base> and its diff is only sha256 lines or the
# status/blocked_reason lines (a locked-hash update, or abandon.sh closing a task): such an edit needs no `why:` (T767).
task_old_edit_exempt() {
  git cat-file -e "$1:$3" 2> /dev/null || return 1
  ! git diff -U0 "$1" "$2" -- "$3" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' \
    | grep -vE '^[+-]([[:space:]]+sha256: [0-9a-f]+|status: .*|blocked_reason: .*)$' | grep -q .
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

# task_mark_done <file>: status open, claimed, todo or blocked becomes done (blocked_reason dropped); any other status is left alone.
task_mark_done() {
  sed -i -e 's/^status: *\(open\|claimed\|todo\|blocked\) *$/status: done/' -e '/^blocked_reason:/d' "$1"
}

# task_mark_landed <file> <sha>: add `landed: <sha>` after the status line.
task_mark_landed() {
  sed -i "/^status:/a landed: $2" "$1"
}

# task_first_sentence <goal>: up to the first sentence end followed by a space.
task_first_sentence() {
  printf '%s' "$1" | sed 's/\([.!?]\) .*/\1/'
}

# task_commit_subject <id> <goal>: "(auto) <id>: <first sentence of goal>", the sentence cut to 72 chars.
task_commit_subject() {
  local sentence
  sentence="$(task_first_sentence "$2")"
  [ -n "$sentence" ] || { printf '(auto) %s' "$1"; return; }
  printf '(auto) %s: %s' "$1" "${sentence:0:72}"
}

# task_commit_message <id> <goal> <release_note>: subject, then the full goal when the subject cut
# the first sentence short, then the release note (omitted when `internal` or empty).
task_commit_message() {
  printf '%s\n' "$(task_commit_subject "$1" "$2")"
  if [ "$(task_first_sentence "$2" | wc -c)" -gt 72 ]; then printf '\n%s\n' "$2"; fi
  if [ -n "$3" ] && [ "$3" != internal ]; then printf '\n%s\n' "$3"; fi
}
