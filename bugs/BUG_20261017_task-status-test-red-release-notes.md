# BUG_20261017_task-status-test-red-release-notes

**Status:** FIXED (T544)

## Symptom
`scripts/land/test/task-status.test.sh` is red on main and on t254 with 25 failures. It is the
done_test of T049, T062, T063 and T069, all landed, so it runs only when one of those is landed again,
which never happens. It is red and runs nowhere.

## Evidence
17 Oct 2026, `bash scripts/quiet-test.sh bash scripts/land/test/task-status.test.sh`, exit 1:
- `tasks/T084.yml: release_note holds a task id or a hash`
- 24 lines `release_note is not a sentence ending in a full stop` (T111, T113, T133, T141, T144, T178, T180, T181, ...)
- on origin/main 7f0989b9 also `tasks/T262.yml: status done without a landed: sha and no 'T262:' commit on origin/main`

## Cause
Task files that break the release_note and status rules this test checks were landed. No gate on
landing runs the test, so nothing refused them.

## Fix
Correct those task files' release_note and status lines, and run the test in a gate that every
landing passes (land.sh, or the post-land suite).

## Verification
The test passes on main, and a landing that adds a bad release_note is refused.

## Resolution (21 Oct 2026, T544)
- The release-note and T262 reds were fixed in the task files since; the test runs on every landing's
  candidate through `scripts/test-shell.sh` (T400).
- A new red came on main with T542: since T536, land.sh writes landing subjects as
  "(auto) <id>: ...", and the test looked only for "<id>:". A done task waiting for the next landing to
  fill its `landed:` sha was reported red. The test now takes the subject with or without "(auto) ".
- `bash scripts/land/test/task-status.test.sh` on main 436be50c0: red (T542) before, green after.
