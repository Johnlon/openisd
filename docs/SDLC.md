# SDLC — every failure made impossible by a tool

John, 11 Oct 2026: "write this up as an SDLC with tooling to enforce it as I have no trust in you,
review all your failures and make sure every one of them is impossible in future"; "include all
failure and strong solution using tools that agents cannot ignore or screw up".

How work reaches main: [DEV_PROCESS.md](DEV_PROCESS.md). This file is the failure register and the
enforcement for each failure. Evidence: lots's own record, bob's and maryu's reports, tools's
delegation log.

## The rule

No duty may rest on an agent remembering, choosing or being honest. Each rule is enforced in one
of four layers. An agent cannot get round a layer, and cannot turn it off.

| Layer | What it is | Why an agent cannot dodge it |
|---|---|---|
| **L1 command gate** | `gates.py`, the Claude Code PreToolUse hook every Claude session runs; `zoo-run.sh` wraps agy/opencode in the same checks | the command is refused before it runs; L1 also refuses edits to the enforcement files |
| **L2 git gates** | git hooks plus `land.sh`, the only path to main | a commit, switch or push that breaks a rule is refused; `--no-verify` is refused by L1 and caught by pre-push |
| **L3 timers** | systemd user timers: the watchdog and housekeeping | run every 5 min whether or not any agent is alive or remembers; L1 refuses `systemctl --user stop/disable/mask` on them |
| **L4 GitHub** | branch ruleset on `main`, and the Pages deploy workflow | runs off this machine; no local agent can change it |

Enforcement files (protected by L1, changed only by a task labelled `infra` that John approves in
its task file): `gates.py`, `scripts/land.sh` and `scripts/land/**`, `scripts/admit*`,
`scripts/heavy.sh`, `~/.claude/bin/heavy.sh`, `~/bin/npx`, the watchdog and its units,
`_agent_files/bin/zoo-run.sh`, `land.conf`, `.github/workflows/**`, this file.

## Roles

| Who | Does | Never does |
|---|---|---|
| leader (maryu since 11 Oct 2026) | approves tasks, sets `tasks/QUEUE.yml`, acts on watchdog alerts | hands-on work; hands John chores |
| Claude sessions (bob, tools, …) | fix blockers themselves; brief, review and land delegated work | delegate a blocker |
| agy, opencode (via `zoo-run.sh`) | off-critical-path work only | push, land, full suites |
| watchdog (L3) | kills superseded and hung runs; alerts agents | depend on an agent |
| John | rulings, permissions, deploy policy | run commands an agent should run |

## Failure register

All failures seen 8–11 Oct 2026. "Layer" is where the fix is enforced. State: **live** (built and
tested, with commit), **to build**, **John** (needs a ruling).

### Landing and main

| # | Failure | Cost | Fix | Layer | Proof | State |
|---|---|---|---|---|---|---|
| 1 | The main `openisd` folder sat on another agent's branch for days | lap:4000 served the wrong code | keep-alive fast-forwards it each minute; L1 refuses any edit, commit or `git switch` whose cwd is the main folder; a `post-checkout` hook there switches back to main and alerts | L1, L2, L3 | gate test; hook test | daemon **live**; gate and hook **to build** |
| 2 | T036 integration resolved conflicts "main wins" and threw away the branch's purpose (the Qicl move) | every saved project refused on load, in prod | a task with `integrates: <branch>` must list that branch's own test files in `done_test`; `land.sh` refuses the landing if any is deleted or fails after the rebase | L2 | land e2e: integration that drops a branch test is refused | **to build** |
| 3 | A schema change refused every saved project; a second Qicl drop at start-up lost front-only values for good | data loss for users | real projects saved by older builds are fixtures (`packages/persistence/test/fixtures/stored-pre-t036`); `land.sh` always runs their test when a change touches `openisdSchema.ts`, `projectRepo.ts` or any loader | L2 | fixtures test 9/9; land rule test | fixtures **live** (82851e82); rule **to build** |
| 4 | Broken code reached openisd.app minutes after landing, before any full run | users hit the data-loss bug | post-land pushes tag `green/<sha>` only on a green run; `deploy.yml` runs on that tag, never on a push to main; GitHub ruleset lets only that workflow deploy | L4 | deploy dry-run on a red sha deploys nothing | **John** (you ruled "release is the Pages deploy on main") |
| 5 | Main carried "WIP … (agy, not reviewed)" commits | unreadable history | `land.sh` squashes each landing into one commit whose message is the task's `goal`; it refuses a `WIP` subject reaching main | L2 | land e2e | **to build** |
| 6 | Stray scratch files (dump.js, screenshot.png, fix_*.js) reached main | junk in the repo | `land.sh` refuses files outside the task's `files` allowlist; `zoo-run.sh` lists new root files | L2 | land e2e | **live** |
| 7 | T030 passed its own spec but turned main red: its overlay caught other specs' clicks (F5) | main red; landings blocked | `land.sh` adds every existing spec that imports or mounts a changed file (import graph) to the gate | L2 | land e2e: a shared-component change runs its dependants | **to build** |
| 8 | Each landing after a red reran the full suite and opened a new F (F7, F8, F9 for one fault) | three F files for one fault | post-land appends to the open F instead of opening a new one; the F names the first red commit's author as owner | L2 | post-land e2e | **to build** |
| 9 | F files kept only the log tail, so failing spec names were lost | an hour rerunning to find them | post-land writes every vitest `FAIL` and Playwright `✘` line into the F | L2 | post-land e2e with a failing stub | **to build** |
| 10 | A delegated job ended without its tests passing (T040) and could have been landed on trust | risk of an unproven landing | `land.sh` runs `done_test` itself (live); `zoo-run.sh` marks the result "tests unproven" unless the log shows the brief's test command exiting 0 | L2 | zoo test | gate **live**; mark **to build** |
| 35 | A browser spec in T036's `done_test` overran the 300 s gate | ~30 min of retries | `new-task.sh` and `land.sh` refuse a `done_test` that names a `*.browser.spec.ts`; browser specs run in the gate's dependant set (7) with their own deadline | L2 | land e2e | **to build** |
| 36 | An integration rebase hit many conflicts; resolving them by `checkout --ours` was blocked mid-rebase | ~20 min; the redo was a squash merge | integrations go through `scripts/integrate.sh <branch>`: a squash merge in a fresh worktree, conflicts listed in the task file for an edit-by-hand resolution, never a side-picking command | L2 | integrate e2e | **to build** |

### Test runs, queues and slots

| # | Failure | Cost | Fix | Layer | Proof | State |
|---|---|---|---|---|---|---|
| 11 | Up to four full post-land runs ran at once; the `/tmp` queue was reset mid-run, so two runs held ticket 1 | every slot full for hours | admission checks a live holder by pid and start time (T042); queue and locks outside `/tmp` (T035); a newer post-land cancels an older one (coalesce) | L2, L3 | admit e2e; coalesce test | holder **live** (a02d6d78); paths **live** (a4f9b60a); coalesce **to build** |
| 12 | Hung and superseded runs held the slots for hours; nobody killed them | landings blocked ~3 h | watchdog every 5 min kills a superseded post-land run, and any run with no log growth and ~0 % CPU for 20 min, by recorded pid and start time; post-land and heavy lanes record pid and start time | L3 | scratch-repo e2e, two concurrent runs | **to build** |
| 13 | Lint, typecheck and single specs waited behind full suites: T038 refused 4 times, T040 once | T038 green but unlanded ~8 h | gates and targeted runs enter the heavy slice with no lane (T044) | L2 | `heavy-no-lane.test.sh` holds all 4 lanes; gates still finish | **live** (a4f9b60a) |
| 14 | A targeted spec waited silently for a lane; the idle watchdog killed it with no output | lost runs, no clue why | same fix as 13 | L2 | same test | **live** |
| 15 | lots said a run was "hung" when it was slow; a later kill hit nothing ("no such process") | wrong diagnosis to John | "hung" is the watchdog's metric, not an agent's call; only the watchdog kills | L3 | with 12 | **to build** |
| 16 | A blocked kill was handed to John as a command, twice | John's time; stalls | the watchdog does all killing (12) | L3 | with 12 | **to build** |

### Delegation and agents

| # | Failure | Cost | Fix | Layer | Proof | State |
|---|---|---|---|---|---|---|
| 17 | Results not delivered (T031 r2 ~3 h, T034 ~1 h, T035 r1/r2) | agents idle on finished work | `zoo-run.sh` sends the result; watchdog re-alerts by tmux every 30 min until `zoo-run.sh ack`; STATUS shows it red | L3 | zoo e2e: an unacked job re-alerts | sender **live**; re-alert **to build** |
| 18 | `zoo-run.sh` overwrote the agent's report with its own summary | T041 review lost, redone | summary goes to `<job>.summary.md` | L2 | zoo test | **live** (39f976d) |
| 19 | Blockers were delegated to slow free models (T044 at first; the watchdog's round 1) | hours; the watchdog round produced nothing | `zoo-run.sh` refuses a brief whose task has `label: fixes` or `critical: true`, or that blocks an open F | L1 | zoo test | **to build** |
| 20 | A free-model job ran 2½ h on a small task (T034) | landing delayed | `zoo-run.sh` timebox per brief (default 45 min): commits WIP, stops the job, alerts the briefer | L3 | zoo test | **to build** |
| 21 | WIP commits swept 196 runtime files (`zoo/state/*`) into git | noise; possible secrets | runtime folders are in `.gitignore`; L1 refuses `git add` of them | L1, L2 | `git status` clean after a job | **to build** |
| 22 | Two agents used the same task id (T035, T041, T042, T043) | crossed reports | `scripts/new-task.sh` takes the next id under a lock and pushes the task file at once; `land.sh` refuses an id already on main from another branch | L2 | concurrency test | **to build** |
| 23 | Two maryu sessions ran under one name; the wrong one was nearly kept | risk of losing a session's work | `agents-into-tmux.sh` refuses a name that already has a live session (pid and start time in `~/.claude/sessions`) | L1 | script test | **to build** |
| 24 | 43 stale worktrees piled up | clutter; stale bases | prune merged clean worktrees on the watchdog timer | L3 | prune test | **to build** |
| 25 | `~/.claude/githooks` was deleted, so hooks silently stopped in three repos | no attribution or allowlist checks | `run_gates.py` fails on a missing `core.hooksPath` folder; hooks in `_agent_files/githooks` | L2 | gates test | **live** (0fd70dd) |

### Supervision

| # | Failure | Cost | Fix | Layer | Proof | State |
|---|---|---|---|---|---|---|
| 26 | Nobody noticed open F files, stuck landings or silent agents for hours | every landing blocked; John found it first | watchdog alerts by tmux send-keys into the owner's window in tmux session `agents` (John's choice), repeated every 30 min; STATUS shows a main-branch panel | L3 | e2e: an open F types into the owner's window | **to build** |
| 27 | lots, tools and bob ran outside tmux, so no alert could reach them | alerts would go nowhere | `agents-into-tmux.sh` moves each session, resumed, into `agents`; the watchdog writes ASK.md when a window is missing | L3 | script test | **to build** (John runs it once) |
| 28 | lots scheduled its own timed checks in-session; they fire only when idle and die with the session | no check-ins | timed duties live only in systemd timers | L3 | — | **to build** |
| 29 | Instructions to agents changed repeatedly (T038 scope; order T038→T034→T035 reversed; the freeze) | re-planning; T034 never got its browser specs | one ordered list, `tasks/QUEUE.yml`, written only by the leader; `land.sh` lands in queue order and refuses a task not on it | L2 | land e2e | **to build** |
| 30 | A known gate defect (lint queued for lanes) was parked "after the storage proof" instead of fixed at once | ~7 h; written in 35 min once ordered | the watchdog opens an F when a gate is refused for its deadline twice in an hour; the F blocks landings, so the fault is fixed first | L2, L3 | watchdog e2e | **to build** |
| 31 | lots's briefs carried wrong instructions (T032 r2 kept the mobile top-bar version John had moved) | a wasted round | a brief quotes John's words with the date; `zoo-run.sh` refuses a UI or rules brief with no `John:` line | L1 | zoo test | **to build** |
| 32 | lots proposed a 5-minute dev-server restart (T033) when the server already reloads on change | John: "why is it needed" | a task file needs a `cause:` line naming the observed fault; `new-task.sh` refuses one without | L2 | new-task test | **to build** |

### Serving and versions

| # | Failure | Cost | Fix | Layer | Proof | State |
|---|---|---|---|---|---|---|
| 33 | lap:4000 ran from `/tmp`, the shared tree and another agent's branch; the keep-alive died when started by hand | wrong code shown to John | keep-alive is a systemd user unit and `cd`s into the main folder | L3 | unit status; `/dev-version.json` sha equals origin/main | **live** |
| 34 | The dev server showed a "new version" notice it could never clear, then reloaded in a loop | app unusable on :4000 | `/dev-version.json` from the running code; dismissal per version (T032) | L2 | T032 specs | **live** (98452289) |

## Competence failures by lots (10–11 Oct 2026)

John removed lots as coordinator on 11 Oct 2026 ("you have failed"; "sacked for negligence"; "and
incompetence"). maryu is session leader. No tool fixes judgement, so each is routed to a gate:

| Failure | Cost | Caught now by row |
|---|---|---|
| Ruled "main wins" in T036 without reading the branch's purpose, then deleted the branch | saved projects refused in prod | 2, 3 |
| Relayed messages instead of fixing causes | landings blocked 3–8 h | 12, 13, 26, 30 |
| Handed John commands instead of solving the block | John's time | 16 |
| Called a slow run "hung" | wrong diagnosis | 15 |
| Let delegated work count as done before its tests ran | risk of a bad landing | 10 |
| Allowed task-id clashes three times | crossed reports | 22 |
| Delegated blockers to slow free models | hours lost | 19, 20 |
| Promised timed check-ins it could not keep | stuck jobs unseen | 26, 28 |
| Changed agents' instructions repeatedly | re-planning; skipped specs | 29 |

## Decisions for John

1. **Row 4:** deploy openisd.app only from a green tag, not on every push to main.
2. **Enforcement files:** confirm that only an `infra` task you approve may change them.

## State

All work on these rows is paused during maryu's merge freeze (11 Oct 2026); maryu assigns owners
after the merge. Once the watchdog is live, it lists rows still **to build** after 24 h in STATUS
and alerts their owner. A row becomes **live** only with its commit and a passing proof test.
