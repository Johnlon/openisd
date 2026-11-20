# BUG_20261120_gate-approval-check-skipped-when-questions-file-missing

**Status:** OPEN

## Symptom
A change to a protected gate file (the `GATE_FILES` list in `land.conf`) passes the task contract check with any
`gates_approved: QO<n>`, even one John never answered, on this machine and on GitHub. The check that the board item names
the task and has an answer by John never runs there.

## Evidence
- `land.conf:46`: `QUESTIONS_FILE=/home/john/work/winisd/questions.yml`, an absolute path on one machine. On the `johnl`
  machine the inbox is `/home/johnl/work/winisd/questions.yml`; GitHub's runner has neither.
- `scripts/land/check-task-contract.sh:156`: `if [ -f "${QUESTIONS_FILE:-/nonexistent}" ]; then` ... the John-answered check ...
  `fi`. With no file, only the `QO<n>` format is checked, and the script passes with no message.
- `scripts/ship.sh:163` runs the same check with `QUESTIONS_FILE=/nonexistent` on purpose, so `ship.sh` never checks it either.
- Seen 20 Nov 2026 on T939 (the driver-array physics rules test): the check in pull-request mode passed (exit 0) before
  QO961 existed in any file it could read. Pointed at `/home/johnl/work/winisd/questions.yml` by hand it ran and passed
  against the real QO961.

## What should happen
- The check fails closed: no readable questions file means a gate-file change is refused, with a message naming the path
  it looked for. It is never skipped without saying so.
- The file is found by a path relative to the repositories (the workspace root that holds `openisd/`, e.g.
  `$(git rev-parse --show-toplevel)/../questions.yml`), never an absolute home path, so every machine finds its own copy.
- Where the inbox cannot be reached (GitHub's runner, which checks out `openisd` alone), the check needs a source it can
  read there, chosen by John: for example the workspace repository checked out beside it, or the approval carried in a
  form the runner can verify. Until then CI says out loud that the John-answered check was not run.

## Tests
None yet. A test in `scripts/land/test/land-gates.test.sh` should refuse a gate-file change when `QUESTIONS_FILE` is missing.
Not fixed in T939.
