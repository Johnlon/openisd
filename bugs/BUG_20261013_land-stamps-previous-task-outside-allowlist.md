# BUG_20261013_land-stamps-previous-task-outside-allowlist

**Status:** OPEN

## Symptom
Landing a task right after another task landed fails with
"check-commit: task T<new> may not touch: tasks/T<previous>.yml" and "land: squash commit failed"
(exit 2). The worker's task never touched that file. Seen 13 Oct 2026 three times in a row:
T086 refused over tasks/T085.yml, T079 over tasks/T086.yml; T080 needed tasks/T079.yml allowed; T089 (this record) was refused over tasks/T084.yml.

## Evidence
After the refusal, `git diff --cached tasks/T085.yml` in the T086 worktree showed one added line,
`landed: fd5965c5…`, which no person or worker wrote: land.sh adds it to the previously landed task's
file inside the next landing's squash commit, and the pre-commit allowlist check (check-commit.sh)
then refuses the commit.

## Cause
land.sh writes the `landed:` sha of a task into that task's file in a later landing, where the file
is outside the new task's `files` allowlist. ⚠ The exact spot in land.sh that writes it is not yet
located.

## Fix
Write `landed:` in the same landing's own commit (the task being landed is in its own allowlist),
or exempt land.sh's own `landed:` stamp from check-commit. Per .claude/rules/processes.md rule 7,
prove the change end to end in a scratch repo before wiring it in.

## Verification
Two tasks landed back to back from separate worktrees: both land with exit 0 and no allowlist
edits; the first task's file carries its `landed:` sha on main.
