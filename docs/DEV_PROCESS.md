# Development process — how work reaches main

John, 2026-10-08. Judgement lives in task files and gates, not in a coordinator's head. A worker
loops until a command passes; it never decides. Plan: `docs/plans/PLAN_20261008_SDLC_CLEANUP.md`.

## Roles

| Who         | Does                                                          | Does not                         |
|-------------|---------------------------------------------------------------|----------------------------------|
| worker      | claims a task, edits only its listed files, lands it          | edit `scripts/`, hooks, other tasks |
| coordinator | writes task files, re-splits blocked ones, records rulings    | implement, approve code          |
| John        | task order, domain rulings, db swap, deploys, any gate bypass | —                                |

## A task

`tasks/T<nnn>.yml`, written by its author, never by the worker.

| Key         | Meaning                                                                  |
|-------------|--------------------------------------------------------------------------|
| `id`, `owner`, `status` | `status`: open, claimed, blocked, landed                     |
| `goal`      | one sentence                                                             |
| `done_test` | a command that must exit 0; `land.sh` refuses a branch that edits its own |
| `locked`    | files the `done_test` depends on, each with a sha256; any change refuses the landing |
| `files`     | glob allowlist (`:(glob)` semantics: `**` crosses directories, `*` does not) |
| `label`     | optional; `fixes` lets a landing pass an open fixes task                 |

Open tasks may overlap; claimed tasks may not (checked at claim).

## The loop

| Step | Command                                         | Result                                          |
|------|-------------------------------------------------|-------------------------------------------------|
| 1    | `bash scripts/land/task-gates/claim.sh T<nnn>`  | status claimed; `.task` written                 |
| 2    | edit only the listed files                      | pre-commit refuses anything else                |
| 3    | run `done_test` until it exits 0                | —                                               |
| 4    | `bash scripts/land.sh T<nnn>`                   | exit 0 landed, 1 refused, 3 blocked             |

Cannot proceed: set `status: blocked` with one plain sentence, and stop.

## `scripts/land.sh <id>` — the only path to main

One landing at a time (flock `LAND_LOCK`). In order:

1. Commit everything in the worktree.
2. Rebase onto origin/main. A conflict aborts the rebase, marks the task blocked, exits 3.
3. Locked files unchanged; `done_test` and `locked` entries as on origin/main.
4. No open `tasks/fixes/*.yml`, unless this task has `label: fixes`.
5. Gates, each with its own deadline (`GATE_DEADLINE_S`): lint on the changed files, typecheck,
   `done_test`, attribution guard on each new commit message. A gate past its deadline is refused
   and killed.
6. Push to main, then start the post-land run, detached.

Config: `land.conf` at the repo root.

## Post-land run

`scripts/land/post-land/run.sh <sha>`, one at a time (flock `POST_LAND_LOCK`):

- checks the sha out as a clean copy outside every clone, runs the full suite once (unit and
  browser), removes the copy; no rerun, so a flaky spec is a red;
- green: records the sha as the last green and prints `post-land: green at <sha>`. A release is the
  GitHub Pages deploy on every push to main (`deploy.yml` triggers on main); post-land is the local
  full run;
- red: pushes `tasks/fixes/F<n>.yml` (`status: open`, the sha, the failing output, and every commit
  since the last green) to main. `land.sh` then refuses every landing except one labelled `fixes`.

## Hooks

| Hook       | Runs                                              |
|------------|---------------------------------------------------|
| pre-commit | `check-commit.sh`: staged files inside the claimed task's `files` |
| commit-msg | attribution guard                                 |
| pre-push   | attribution guard on every commit being pushed    |

No hook runs a test suite. `--no-verify` only on John's word, per commit.

## Driver snapshot

- Tests and builds never read the live driver db (`../winisd_drivers`). The committed bundle (`packages/ui/public/drivers/**`, `drivers-index.json`, `passive-radiators-index.json`) and the three fixtures in `packages/design/test/fixtures/driver-snapshot/` are the pinned snapshot.
- `scripts/driver-snapshot.pin` records the winisd_drivers commit and the sha256 of every fixture and of the bundle; `packages/design/test/scripts/driver-snapshot-pin.test.ts` fails on drift.
- `scripts/sync-driver-snapshot.sh` is the only reader of the live db. It refuses a dirty or non-git checkout.
- Bump the pin: run it on a clean winisd_drivers and commit everything it changed.
