# Development process — how work reaches main

John, 2026-10-08. Judgement lives in task files and gates, not in a coordinator's head. A worker

Enforcement of every rule here, and the failure each one prevents: [SDLC.md](SDLC.md).
loops until a command passes; it never decides.

## Roles

| Who         | Does                                                          | Does not                         |
|-------------|---------------------------------------------------------------|----------------------------------|
| worker      | claims a task, edits only its listed files, ships it          | edit `scripts/`, hooks, other tasks |
| coordinator | writes task files, re-splits blocked ones, records rulings    | implement, approve code          |
| John        | task order, domain rulings, db swap, deploys, any gate bypass | —                                |

## A task

`tasks/T<nnn>.yml`, written by its author, never by the worker.

| Key         | Meaning                                                                  |
|-------------|--------------------------------------------------------------------------|
| `id`, `owner`, `status` | `status`: open, claimed, blocked, done                     |
| `goal`      | one sentence                                                             |
| `done_test` | a command that must exit 0; `pr-gate` refuses a branch that edits its own |
| `locked`    | files the `done_test` depends on, each with a sha256; any change fails `pr-gate` |
| `files`     | glob allowlist (`:(glob)` semantics: `**` crosses directories, `*` does not) |
| `label`     | optional; `fixes` puts the pull request first in the queue (red main only)    |
| `gates_approved` | optional; `QO<n>`: board item John has answered, lets a pull request change a `GATE_FILES` file |

Open tasks may overlap; claimed tasks may not (checked at claim).

## The loop

| Step | Command                                         | Result                                          |
|------|-------------------------------------------------|-------------------------------------------------|
| 0    | `bash scripts/new-task.sh <owner> "<goal>"`     | prints `T<nnn> <worktree>`: the id is claimed, never typed |
| 1    | `bash scripts/land/task-gates/claim.sh T<nnn>`  | status claimed; `.task` written                 |
| 2    | edit only the listed files                      | pre-commit refuses anything else                |
| 3    | run `done_test` until it exits 0                | —                                               |
| 4    | `bash scripts/ship.sh T<nnn>`                   | exit 0 shipped (PR open, auto-merge on, worktree deleted), 1 refused, 3 blocked by a rebase conflict |

Chain what follows step 0 with `&&` (`bash scripts/new-task.sh … && cd <worktree> && …`), or check its exit
code. A refused `new-task.sh` or `_agent_files/bin/new-worktree.sh` makes no worktree, and a folder of that
name that already exists is another session's: commands run there land in its task (17 Oct 2026). A task's
id is its own: `pr-gate` fails a branch whose `tasks/<id>.yml` would replace another owner's on main.

The main folder (`openisd`, the main checkout) and the lap:4000 preview copy follow main
(`scripts/land/sync-main-folder.sh`, run by the watchdog every tick). Nobody works or writes there:
`claim.sh`, `integrate.sh`, `sync-driver-snapshot.sh` and `inbox.py` refuse to. Stray edits found there are
committed as a WIP commit and the folder is rebased; edits already on main drop out.

### Preview isolation

The protected main checkout is previewed on `lap:4000`. A task worktree that needs a live preview uses the
reserved port `4XXX`, where `XXX` is the task number: T578 uses `lap:4578`. This keeps an agent's WIP
isolated from the last-green main preview and makes the task owning a preview unambiguous. Do not use an
arbitrary port, and do not run the main-checkout preview script from a task worktree; start the dev server
from the task worktree on its reserved task port.

Every finished task is a GitHub pull request into main, merged by the merge queue (QO481, John 10 Nov 2026).
`ship.sh` pushes `t<nnn>`, opens the pull request titled "(auto) T<n>: <goal>" with the release note as body,
turns on auto-merge (squash) and deletes the worktree at once; the branch on GitHub holds the work. The one
required check, `pr-gate`, runs on the pull request and again in the queue on the merged result, so main only
ever gets green commits. A red pull request stops only itself: its owner reads the failing job, makes a fresh
worktree from the branch, fixes and pushes. Nothing else waits.

Landed and abandoned work is removed by `scripts/land/tidy-branches.sh`, run by the watchdog every tick (T334,
John 17 Oct 2026): a worktree goes when it is clean, nothing runs inside it and its commits are on origin/main;
task branches, local and on origin, and landed `land/<task>` branches go on the same terms; leftover `openisd-*`
folders holding only generated folders go. A decision to drop a task is `bash scripts/abandon.sh T<n> --by
<who> "<why>"`: it lands nothing on main (John, 17 Oct 2026: "don't commit abandoned") and deletes the worktree, even with
uncommitted work, and the branch, local and on origin, even with later commits; the decision is the authority.
Nothing is archived: the record is one line in `build/test-logs/tidy-branches.log` (who, why, tip, task goal).

Cannot proceed: set `status: blocked` with one plain sentence, and stop.

## `scripts/ship.sh <id>` — the only path to main

A task merges as one squash commit, subject "(auto) <id>: <goal>", body the release note.

`ship.sh`, in order:

1. Commit everything in the worktree; set status done.
2. Rebase onto origin/main. A conflict aborts the rebase, marks the task blocked, exits 3; nothing is removed.
3. The task contract, as the pull request's `task` job runs it (`scripts/land/check-task-contract.sh --pr`: locked
   hashes, `files` allowlist, status, gate files), then, optionally, lint and typecheck on the changed files. A
   file outside the allowlist exits 1 naming it, before anything is pushed.
4. Push `t<nnn>` (never forced), open or reuse the pull request, `gh pr merge --auto --squash`.
5. Delete the worktree.

`pr-gate` (`.github/workflows/pr.yml`), on the pull request and in the merge queue:

- task contract: locked files unchanged; `done_test` and `locked` as on origin/main; `files` allowlist; task id
  and owner; status valid; model-ruling gate (driver model files `openisdSchema.ts`, `openIsdDriverSpec.ts`,
  `driverSpecFieldName.ts` change only when the task file has `ruling: QO<n>`, QO392); `gates_approved` for a
  `GATE_FILES` change; attribution guard on every commit message;
- lint on the changed files, typecheck, the unit tests the change reaches, every architecture unit test
  (`scripts/land/unit-architecture.sh`, whatever changed: they read the source tree), `done_test`, the visual
  `SOURCES.sha256` check;
- that is all: 6 jobs, about 5 minutes. The full suite does not run on a pull request (John, QO501, 10 Nov 2026,
  "pick A": GitHub's free plan runs 20 jobs at once for the whole account, so 22-job pull requests queued one
  after another).

The full suite (`.github/workflows/suite.yml`: unit tests in two halves, typecheck, shell tests, the browser specs
in 10 shards) runs once on main after each merge. No rerun: a flaky spec is a red. A red opens a GitHub issue
labelled `main-red` naming the commit and the run (job `report`). The fix is a pull request labelled `fixes`,
first in the queue (`docs/SDLC_POLICY.md` §1), whose body says "Fixes #<issue>".

`GATE_FILES` (`land.conf`): `pr-gate` fails when the diff touches one of these globs (coverage scripts, vitest, eslint, tsconfig, suite.yml) unless the task has `gates_approved: QO<n>` and board item QO<n> (`QUESTIONS_FILE`) has a thread entry `by: John`.

Runtime directories (`OPENISD_HEAVY_GATE_DIR`, `OPENISD_RESERVATION_DIR`, admit slots) are derived from
`$OPENISD_RUNTIME_DIR` (default `$XDG_RUNTIME_DIR/openisd` or `/run/user/<uid>/openisd`), set in
`scripts/paths.sh` and sourced by every script. The old `/tmp/openisd-*` paths are no longer used.

`land.sh` remains only to print "use scripts/ship.sh".

## Integrating a branch

A branch that did not go through `ship.sh` (agy, opencode) is shipped by someone running `ship.sh` from a
worktree of that branch. There is no other way onto main.

## Hooks

| Hook       | Runs                                              |
|------------|---------------------------------------------------|
| pre-commit | `check-commit.sh`: staged files inside the claimed task's `files` |
| commit-msg | attribution guard                                 |
| pre-push   | attribution guard on every commit being pushed    |

No hook runs a test suite. `--no-verify` only on John's word, per commit.

## Driver snapshot

- Tests and builds never read the live driver db (`../winisd_drivers`). The committed bundle (`packages/ui/public/drivers/**`, `drivers-index.json`, `passive-radiators-index.json`) and the three fixtures in `packages/design/test/fixtures/driver-snapshot/` are the pinned snapshot.
- `scripts/driver-snapshot.pin` records the winisd_drivers snapshot commit and the sha256 of every fixture and of the bundle; `packages/design/test/scripts/driver-snapshot-pin.test.ts` fails on drift.
- `scripts/sync-driver-snapshot.sh` reads only committed `winisd_drivers/snapshot/datasheets`. Scraper work elsewhere in that repository does not affect the OpenISD bundle; edits or untracked files inside the snapshot are refused until committed. Pass repeated `--only-record brand/sku` options for a narrow refresh; omit them for a full snapshot rebuild.
- Bump the pin: commit the intended snapshot in winisd_drivers, then run the sync script and commit the resulting OpenISD bundle and pin.
