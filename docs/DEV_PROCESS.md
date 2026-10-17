# Development process — how work reaches main

John, 2026-10-08. Judgement lives in task files and gates, not in a coordinator's head. A worker

Enforcement of every rule here, and the failure each one prevents: [SDLC.md](SDLC.md).
loops until a command passes; it never decides.

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
| 0    | `bash scripts/new-task.sh <owner> "<goal>"`     | prints `T<nnn> <worktree>`: the id is claimed, never typed |
| 1    | `bash scripts/land/task-gates/claim.sh T<nnn>`  | status claimed; `.task` written                 |
| 2    | edit only the listed files                      | pre-commit refuses anything else                |
| 3    | run `done_test` until it exits 0                | —                                               |
| 4    | `bash scripts/land.sh T<nnn>`                   | exit 0 landed, 1 refused, 3 blocked             |

Cannot proceed: set `status: blocked` with one plain sentence, and stop.

## `scripts/land.sh <id>` — the only path to main

A task lands as one commit, subject "<id>: <goal>", body the release note; land.sh writes status done and landed.

One landing at a time (flock `LAND_LOCK`). In order:

1. Commit everything in the worktree.
2. Rebase onto origin/main. A conflict aborts the rebase, marks the task blocked, exits 3. The one exception
   is a conflict only on generated visual files (baseline pictures, `SOURCES.sha256`): land.sh takes main's
   side, re-takes the baselines on the rebased sources (`VISUAL_RETAKE_CMD`), commits them, and the visual
   gates check the result (T313).
3. Locked files unchanged; `done_test` and `locked` entries as on origin/main.
4. No open `tasks/fixes/*.yml`, unless this task has `label: fixes`.
5. Gates, each with its own deadline (`GATE_DEADLINE_S`; lint and typecheck have none, `LINT_DEADLINE_S`/`TYPECHECK_DEADLINE_S`=0): lint on the changed files, typecheck,
   the unit tests the change reaches, every architecture unit test (`scripts/land/unit-architecture.sh`,
   whatever changed: they read the source tree, so the import graph never picks them), `done_test`,
   attribution guard on each new commit message. A gate past its deadline is refused
   and killed.
6. Candidate: the rebased commit is pushed to `land/<task>`, which starts the full suite on GitHub Actions
   (`.github/workflows/suite.yml`, about 4 min). `CANDIDATE_CMD` (`scripts/land/post-land/actions.sh`)
   waits for that run. Red, or no run: refused (gate `candidate`, with the failing specs and the run link),
   main untouched. The branch is removed whatever the result. The landing lock is held throughout, so
   no other landing moves main in between.
7. Push to main (only after a green candidate), then start the post-land run, detached.

Config: `land.conf` at the repo root. Lock paths (`LAND_LOCK`, `POST_LAND_LOCK`) and all other
runtime directories (`OPENISD_HEAVY_GATE_DIR`, `OPENISD_RESERVATION_DIR`,
admit slots, matt restore) are derived from a single runtime root
`$OPENISD_RUNTIME_DIR` (default `$XDG_RUNTIME_DIR/openisd` or `/run/user/<uid>/openisd`), set in
`scripts/paths.sh` and sourced by every script. The old `/tmp/openisd-*` paths are no longer used;
they must never both be live at once.
`POST_LAND_DEADLINE_S` (default 5400): a post-land run past it has its process group killed and is recorded red ("TIMED OUT").
`HEALTH_RED_MAX_MIN` (default 120): land.sh prints a health line and refuses `red-main` when main is red and the last green is older than this, unless the task has `label: fixes`.

## Integrating a branch

A branch that did not go through `land.sh` (agy, opencode) reaches main only by
`bash scripts/integrate.sh <task-id> <branch>`. Under the landing lock it squash-merges the branch
into a fresh worktree of origin/main, refuses if a test file the branch added or changed is deleted or
red (`branch-tests`), runs lint, typecheck and the unit half, runs the stored-data corpus and the
schemagen proof when the merge touches the schema, `projectRepo`, a loader or `driver_type`, then
pushes and starts post-land. Exit 0 integrated, 1 refused (names the gate), 2 cannot start, 3
conflict: the paths are in `tasks/<id>.yml` under `blocked:`, the worktree stays for a hand
resolution (never `--ours`/`--theirs`).

## Post-land run

`scripts/land/post-land/run.sh <sha>`, one at a time (flock `POST_LAND_LOCK`):

- checks the sha out as a clean copy outside every clone and runs `FULL_SUITE_CMD` there once; no
  rerun, so a flaky spec is a red;
- the full suite runs on GitHub Actions (John, 17 Oct 2026): every push to main starts
  `.github/workflows/suite.yml` (unit tests in two halves, typecheck, the browser specs in 10 shards,
  about 4 min). `FULL_SUITE_CMD` is `scripts/land/post-land/actions.sh`, which finds that run for the
  sha (`ACTIONS_REPO`, up to `ACTIONS_FIND_S`), waits for it, and passes on its result. No run found,
  or GitHub unreadable, is a red, never a green. `scripts/land/post-land/suite.sh` is the laptop run,
  kept for going back (one line in `land.conf`);
- green: records the sha as the last green and prints `post-land: green at <sha>`. It closes every open
  F whose red commits are all in that sha's history (an infra F, with no sha, is left alone) and pushes
  the close to main. A release is the GitHub Pages deploy on every push to main (`deploy.yml` triggers on main);
- red: pushes `tasks/fixes/F<n>.yml` (`status: open`, the sha, the failing specs from the run's failed
  jobs, the failing screens' before/after page, the run link, and every commit since the last green)
  to main. `land.sh` then refuses every landing except one labelled `fixes`.

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
