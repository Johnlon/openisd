# SDLC — every failure made impossible by a tool

John, 11 Oct 2026: "write this up as an SDLC with tooling to enforce it as I have no trust in you,
review all your failures and make sure every one of them is impossible in future."

Rule: a duty no script enforces will be forgotten. Every rule here names the tool that enforces
it and the test that proves the tool works. A rule with no tool is marked **NOT ENFORCED** until it
has one. How work reaches main is in [DEV_PROCESS.md](DEV_PROCESS.md); this file adds the
enforcement for each failure seen so far.

## Roles

| Who | Does | Never does |
|---|---|---|
| lots (manager) | approves tasks, picks *do it yourself* or *delegate*, assigns owners, acts on watchdog alerts | hands-on work; hands John chores |
| bob, maryu, tools (Claude sessions) | fix blockers themselves; brief, review and land delegated work | delegate a blocker |
| agy, opencode (via tools and `zoo-run.sh`) | off-critical-path work only | push, land, full suites |
| watchdog (script on a systemd timer) | kills superseded and hung runs, alerts agents | depend on any agent remembering |
| John | rulings, permissions, deploys | run commands an agent should run |

## Delegate or do it yourself

If anyone is waiting on it, a Claude session does it now. Blockers: an open `tasks/fixes/F<n>.yml`,
a gate or queue fault, a stuck run, data loss, a broken prod, a delegated job that already stalled.
Everything else may be delegated. Enforced by `zoo-run.sh`: it refuses a brief whose task has
`label: fixes` or `critical: true` (**to build**, tools).

## Failure register

Each row: what went wrong on 10–11 Oct 2026, the tool that now makes it impossible, its state.

| # | Failure | Enforcement (tool) | Proof | State |
|---|---|---|---|---|
| 1 | The main `openisd` folder sat on another agent's branch for days | keep-alive daemon fast-forwards it to origin/main each minute; a `pre-commit` and `post-checkout` hook in the main folder refuses any commit and any branch other than `main` | hook test: commit and `git switch` in the main folder both refused | daemon live; **hook to build** (bob) |
| 2 | Integration resolved conflicts with "main wins" and threw away the branch's purpose (the Qicl move) | `land.sh` integration rule: a task with `integrates: <branch>` must keep the branch's own tests in `done_test`, and must pass them after the rebase | land e2e: integration that drops a branch test is refused | **to build** (maryu) |
| 3 | A schema change refused every saved project in prod | real stored projects from an older build are fixtures (`packages/persistence/test/fixtures/stored-pre-t036`); `land.sh` adds their test to `done_test` of any task that edits `openisdSchema.ts` or `projectRepo.ts` | fixtures test 9/9; land rule test | fixtures live (T041); **land rule to build** (maryu) |
| 4 | Broken code reached openisd.app minutes after landing, before any full run | deploy only the last green sha: `deploy.yml` deploys `${POST_LAND_LOCK}.green`, not every push | deploy dry-run on a red sha deploys nothing | **John to decide** (you ruled "release is the Pages deploy on main") |
| 5 | Up to four full post-land runs ran at once | admission checks a live holder by pid and start time beside the queue (T042); post-land coalesces: a newer sha cancels an older waiting or running run | admit e2e: second run waits; coalesce test | holder live (T042 a02d6d78); **coalesce to build** (tools, watchdog) |
| 6 | Hung or superseded runs held the test slots for hours | watchdog every 5 min: kills a superseded post-land run and any run with no log growth and ~0 % CPU for 20 min, by recorded pid and start time | scratch-repo e2e with two concurrent runs | **building** (tools, ETA ~2 h) |
| 7 | Lint, typecheck and single specs waited behind full suites and timed out | gates and targeted runs enter the heavy slice with no lane (T044) | `heavy-no-lane.test.sh` holds all 4 lanes; gates still finish | done, landing now (bob) |
| 8 | A targeted spec waited silently and the idle watchdog killed it with no output | same as 7: no lane wait for targeted runs | same test | done with 7 |
| 9 | Delegated results were not delivered three times | `zoo-run.sh` sends the result; watchdog re-alerts every 30 min until `zoo-run.sh ack`; STATUS shows it red | zoo-run test: undelivered job re-alerts | sender live; **re-alert building** (tools) |
| 10 | `zoo-run.sh` overwrote the agent's report with its own summary | summary goes to `<job>.summary.md` only | zoo test | done (39f976d) |
| 11 | Nobody noticed open F files, stuck landings or silent agents | watchdog alerts by tmux send-keys into each agent's window in tmux session `agents`; STATUS main-branch panel | e2e: an open F produces a keystroke in the owner's window | **building** (tools); alert path chosen by John |
| 12 | lots, tools and bob ran outside tmux, so no alert could reach them | `agents-into-tmux.sh` restarts each session, resumed, in `agents`; watchdog alerts in ASK.md when a target window is missing | script test | **building** (tools); John runs it once |
| 13 | Two agents used the same task id (T035, T041, T042, T043) | `scripts/new-task.sh` takes the next id under a lock and pushes the task file to main at once; `land.sh` refuses a task id already on main from another branch | concurrency test: two calls get two ids | **to build** (bob) |
| 14 | The F file kept only the log tail, so failing spec names were lost | post-land writes vitest `FAIL` and Playwright `✘` lines into the F file | post-land e2e with a failing stub | **in the F7–F9 fix** (maryu) |
| 15 | Main carried "WIP … (agy, not reviewed)" commits | `land.sh` refuses a landing whose new commits include a `WIP` subject; the squash message is the task's `goal` | land e2e | **to build** (bob) |
| 16 | A delegated job ended without its tests passing (T040) | `land.sh` runs `done_test` (exists); `zoo-run.sh` marks a job "tests unproven" unless its log shows the brief's test command exiting 0 | zoo test | land gate live; **zoo mark to build** (tools) |
| 17 | A free-model job ran 2½ hours on a small task | `zoo-run.sh` timebox per brief (`timebox_min`, default 45): on expiry it commits WIP, stops the job and alerts the briefer | zoo test | **to build** (tools) |
| 18 | WIP commits swept 196 runtime state files into git | runtime folders (`zoo/state/`, logs, leases) are in `.gitignore` | `git status` clean after a job | **to build** (tools) |
| 19 | 43 stale worktrees piled up | `prune_landed_worktrees.sh` on the watchdog timer: removes a clean worktree whose branch is merged | prune test | **building** (tools) |
| 20 | lap:4000 served a stale tree or another agent's branch | keep-alive serves the main folder only, fast-forwarded each minute (see 1) | `/dev-version.json` sha equals origin/main | live |
| 21 | lots handed John kill commands because the safety check blocked it | the watchdog does the killing (6); agents never ask John to run commands | — | with 6 |
| 22 | lots claimed a run was hung when it was only slow | "hung" is the watchdog's metric (no log growth, ~0 % CPU, 20 min), not an agent's judgement | with 6 | with 6 |

## Decisions for John

1. **Row 4:** deploy openisd.app only from the last green sha, not on every push to main. Today
   a landing reaches users before the full suite has run.
2. **Permission:** none needed once the watchdog does the killing.

## Status of this file

Every **to build** row has an owner. The watchdog lists rows still **to build** after 24 h in
STATUS and alerts their owner (**to build**, tools). When a row's tool and test land, its State becomes **live** with the commit.
