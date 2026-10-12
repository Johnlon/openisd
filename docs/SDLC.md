# SDLC — what went wrong 8–11 Oct 2026, and the tools that stop it

John, 11 Oct 2026: "write this up as an SDLC with tooling to enforce it as I have no trust in you,
review all your failures and make sure every one of them is impossible in future"; "I need solutions."
Later the same day, after the venv gate stopped two sessions again (R0): "this is a critical
fault, critical, keeps happening and cause total mess"; "totally unacceptable"; "your ai process
is a total waste of time and has to be fixed".

The verdict this report accepts: the process as run 8–11 Oct cost more than it produced. Every
hour of agent time below was spent on the process (queues, gates, stalls, re-planning, hand
repairs by John), not on the product. The fix is not more agents or more rules; it is S0–S8,
each a script with a test, built in the order given, starting with S0 today.

Solutions first. The register at the end is the evidence, nothing more. The system the solutions
add up to: [SDLC_DESIGN.md](SDLC_DESIGN.md). How work reaches main today: [DEV_PROCESS.md](DEV_PROCESS.md).

Evidence sources: git history (openisd, winisd_tools), `tasks/fixes/F*.yml`, `zoo/ASK.md`,
`zoo/DELEGATION_LOG.md`, `.postland/post-land.log`, the session transcripts (times below are local,
BST), and the written answers of bob, lots and openisd-c5 (tools did not answer in time; its
transcript was used instead).

## Root causes, ranked by cost

| # | Root cause | Cost seen | Fixed by |
|---|---|---|---|
| **R0 CRITICAL** | **A gate that stops every tool call in every session over one stale folder.** `gates.py` demands `<worktree>/.venv/bin/python` for worktrees the session is not even in. A stale worktree with no venv refuses every command, including the one that would delete it, and the agent ends by telling John to type `rm`. Happened 10 Oct (30+ refusals, John copied files by hand) and again 11 Oct ~14:30 (tools and maryu both dead; John ran the command; two parts of it failed). John: "keeps happening and cause total mess"; "totally unacceptable" | every session stopped until John acts, each time | **S0, do first** |
| R1 | The landing gate never ran the unit tests. Five landings pushed 14 unit failures in 7 files; post-land found them 2–4 h later and opened F7, F8, F9 | every landing refused 01:00–12:40 11 Oct (~11 h); 3 full runs of 2–4 h each wasted | S1 |
| R2 | One queue for everything. Lint, typecheck and single specs waited behind full suites in 4 lanes; the 300 s gate deadline ran out in the queue | T038 green at ~03:00, refused 6 times, landed 11:38 (~8 h); T040 refused; T034 typecheck stalled 600 s twice | S2 (live) |
| R3 | Nothing kills a superseded or hung run. Up to 4 full post-land runs at once; one at 0 % CPU for 1 h 31 m; the agent could not kill (classifier), handed John a `kill` twice, the second hit "no such process" | all lanes held ~3 h; John's time; wrong "hung" diagnosis | S2, S3 |
| R4 | Nothing watches. No timer, no heartbeat, no re-alert. 12 delegated results sat "NOT DELIVERED" (ASK.md); the coordinator's half-hourly check ran only when idle | agents idle ~1–3 h per result; stuck runs unseen for hours; John found every stall first | S3 |
| R5 | Integration by hand, without the branch's tests. "Main wins" in T036 threw away the Qicl move; a second Qicl drop at start-up lost values for good; the roles merge changed `driver_type` under every stored driver | saved projects refused in prod (John, 11 Oct 03:28); ~2 h recovery (T039, T041); 40 min for roles | S4 |
| R6 | Fragile environment: fixed `/tmp` paths wiped mid-run (two runs held ticket 1); a per-worktree `.venv` the gate demanded but no worktree had (30+ refusals in tools on 10 Oct; again 11 Oct ~14:30, two stale worktrees blocked tools' and maryu's sessions and John had to `rm` them); the hooks folder deleted; a test rewrote the real `core.hooksPath`; the main folder left on another agent's branch; `lap` not an allowed host | each stopped every tool call in a session until John fixed it by hand (10 Oct 18:50, 23:10; 11 Oct ~14:30) | S5, S3 |
| R7 | Delegated work counted as done on trust. No record of rounds (T032 4 rounds, 164 min; T035 3 rounds; T034 158 min); results overwritten (T041); briefs violated (polling loop in T035 r3); 196 runtime files swept into a WIP commit; task ids used twice (T035, T040–T043) | ~4 review rounds of 30–60 min each; a lost review; crossed reports | S6, S7 |
| R8 | Credit and tokens. Three Claude sessions cut off at the usage limit (8 Oct 23:58); "run out of credit again" (9 Oct); work moved to slow free models with no timebox | days of slow progress (John, 11 Oct 12:56: "token burning") | S7, S8 |

## Solutions, ranked by value per effort

Each is one task. "Proof" is the test that must pass before the row is live. State: **live** (commit
named) or **to build**.

### S0 — CRITICAL: a gate may refuse one command, never a session (R0) — **live 9dfe6d1** (workspace repo, 11 Oct)

- The mechanism found: the two stale worktrees were made before 10 Oct 19:40 and carried the
  old `winisd_tools/gates.py` that checks its own `.venv`. The runner ran that stale `gates.py`
  for every tool call that merely mentioned the worktree's name: a SendMessage, a Read, the
  `rm -rf` meant to delete it. So the sessions that tried to clean up were the ones stopped.
- What changed, in `_agent_files/bin/run_gates.py`:
  1. A repo other than the cwd's gates a call only when the call works in it: an Edit, Write or
     NotebookEdit of a file inside it, or a Bash command that runs inside it (`git -C`, `cd`, a
     file of it). SendMessage, Read, Grep and every other tool never gate another repo by name.
  2. A command that removes a repo (`rm -rf`, `git worktree remove|prune`, `git branch -D`) is
     not work in it and is never gated by it. An agent can always delete a stale worktree.
  3. The missing-hooksPath check covers only the repos in scope of the call.
  4. `new-worktree.sh` bases on the newer of local main and origin/main and refuses when they
     have diverged, so a worktree is not born behind main with an old `gates.py`.
- Proof: `tests/test_run_gates_stale_worktree.py` (12 cases: a message, a Read, five removal
  commands pass; edits and `git -C` inside still gated; a stale hooksPath blocks only sessions in
  it); two new cases in `tests/test_new_worktree.py`; all 54 workspace tests and
  `test_githooks.sh` green. Live check: a SendMessage naming a stale folder passes the real gate.
- Still open (S3): the watchdog prunes merged clean worktrees so nobody has to delete them.

### S1 — the landing gate runs the unit tests (R1) — to build, effort S

- What: `land.sh` runs the unit half of every package the change touches, plus every existing spec
  that imports a changed file (import graph), before the push. `done_test` may not name a
  `*.browser.spec.ts`; browser specs run post-land with their own deadline.
- Where: `scripts/land.sh`, `scripts/land/core/`, `scripts/land/test/land.e2e.test.sh`.
- Stops: a unit failure reaching main (F2, F7–F9); a task passing its own spec and breaking a
  neighbour (F5); a browser spec overrunning the 300 s gate (T036, ~30 min of retries).
- Proof: land e2e cases "unit failure in a touched package is refused", "shared-component change
  runs its dependants", "browser spec in done_test is refused".
- Brief-ready: yes. Owner: a Claude session (gate code is never delegated to a free model).

### S2 — one scheduler, light commands never wait, newer run cancels older (R2, R3)

- Live: gates and targeted runs enter `heavy.slice` with no lane (T044, 33ff0645, proof
  `heavy-no-lane.test.sh`); admission holder checked by pid and start time (T042, a02d6d78);
  every lock and queue under `$XDG_RUNTIME_DIR/openisd`, never `/tmp` (T035, a4f9b60a).
- To build, effort S: post-land coalesce with a kill. When a newer sha starts, the older run's
  process group is killed by recorded pgid and its grant freed. `admit` prints what it is waiting
  behind every 30 s and logs the wait.
- Where: `scripts/land/post-land/run.sh`, `scripts/admit.sh`, `scripts/land/test/post-land-coalesce.test.sh`.
- Proof: scratch-repo e2e, two runs started 10 s apart, the first is dead within 30 s.

### S3 — a watchdog on a systemd timer, alerts typed into the agent's window (R3, R4) — to build, effort M

- What: `scripts/watchdog.sh` every 5 min: kills a run with no log growth and ~0 % CPU for
  20 min (by recorded pid and start time); frees grants held by dead pids; re-alerts an
  unacknowledged `zoo-run.sh` result every 30 min; alerts on an open F older than 30 min with no
  owner; opens an `infra` F when the same gate is refused twice in an hour; prunes merged clean
  worktrees. Alerts go by `tmux send-keys` into the owner's window in session `agents` (John's
  choice); no window, a line in `zoo/ASK.md`. The watchdog never asks John to run a command.
- Where: `scripts/watchdog.sh`, `~/.config/systemd/user/openisd-watchdog.{service,timer}`,
  `scripts/agents-into-tmux.sh` (one live session per name; refuses a duplicate name — two
  maryus ran at once on 10 Oct 20:39).
- Stops: hung runs holding lanes for hours; results nobody reads; "I will check every 30 min"
  promises; an agent diagnosing "hung" by eye.
- Proof: scratch-repo e2e with a stub run at 0 % CPU and an unacked result; both produce a
  kill and a typed alert.
- Brief-ready: yes. Depends on nothing. `gates.py` refuses `systemctl --user stop|disable|mask`
  on the timer.

### S4 — `integrate.sh`: merges run the branch's tests and the stored-data corpus (R5) — to build, effort M

- What: the only merge path. Squash-merge in a fresh worktree; conflicts are listed in the task
  file for an edit-by-hand resolution (no `--ours`/`--theirs`); refuses if any test file the branch
  added or changed is deleted or fails after the merge; runs the unit half (S1); on any change to
  `openisdSchema.ts`, `projectRepo.ts`, a loader or `driver_type`, runs the corpus check: every
  bundled driver, every stored-project fixture (`packages/persistence/test/fixtures/stored-pre-t036`,
  82851e82) and the sample projects must still parse.
- Where: `scripts/integrate.sh`, `scripts/land/test/integrate.e2e.test.sh`; the schema generator's
  test (`scripts/schemagen`) runs in the same gate so an unhandled construct refuses the landing.
- Stops: "main wins" data loss; a schema change refusing every saved project or driver; a merge
  freeze with no gates (11 Oct 11:40: four branches merged, one 4-file conflict, one typecheck
  error fixed by hand on main).
- Proof: e2e: an integration that drops a branch test is refused; a breaking schema change is refused.

### S5 — environment is self-checking (R6) — mostly live, effort S each

| Fault | Tool | State |
|---|---|---|
| fixed `/tmp` names | `scripts/paths.sh`, one runtime root | live a4f9b60a |
| per-worktree `.venv` demanded; a stale worktree blocks every session | **S0 (critical)** | shared venv live 43cf2b76; gate scope live 9dfe6d1 |
| hooks folder deleted | `run_gates.py` fails on a missing `core.hooksPath`; hooks in `_agent_files/githooks` | live 0fd70dd |
| a test rewrote the real `core.hooksPath` | tests that touch git config run with `HOME` and `GIT_CONFIG_GLOBAL` in a temp dir; `gates.py` refuses `git config --global` from any test | to build |
| main folder on another branch; :4000 served the wrong tree | keep-alive as a systemd unit, `cd` into the main folder, fast-forward each minute; `gates.py` refuses edit, commit or `git switch` with cwd = main folder | daemon live; gate to build |
| worktree born red (based on origin/main behind local main); nested node_modules | `new-worktree.sh` bases on the newer of local and origin main, refuses if diverged, links node_modules once | to build |
| `lap` refused by Vite | `allowedHosts` in `vite.config.js` | live a4f9b60a |

### S6 — delegated work is proven, recorded and lint-checked before it is delivered (R7) — live in part (workspace 6497dc1, 11 Oct 16:00), effort M

- What, in `zoo-run.sh`: marks a result "tests unproven" unless the log shows the brief's test
  command exiting 0; lints the job's diff for banned patterns (sleep/polling loops, `!` assertions,
  `console.log`, casts) and sends the findings with the result; records every round (model, minutes,
  tokens, findings) in `zoo/DELEGATION_LOG.md`; a brief for round N+1 must list round N's findings;
  refuses a brief whose task is `label: fixes`, `critical: true` or blocks an open F; timebox per
  brief (default 45 min: commits WIP, stops, alerts the briefer); logs every reroute (agy at its cap
  moved T035 r3 to opencode unseen); runtime folders (`zoo/state/*`) gitignored and refused by
  `git add`.
- Live (tools, workspace 6497dc1): `zoo-run.sh` refuses a brief or task marked `label: fixes` or
  `critical: true`; a result is "tests unproven" when the log does not show the brief's TEST command
  ran; a 45-min timebox commits WIP and alerts in ASK.md at the limit; 45 checks pass in
  `test_zoo_run.sh`. Not live: refusing while an F is open. `test_zoo_lease.sh` fails 4–5 checks under
  load, as before the change.
- Live already: summary to `<job>.summary.md`, never over the report (39f976d); `land.sh` runs
  `done_test` itself.
- Where: `_agent_files/bin/zoo-run.sh`, its tests.
- Stops: 158 min jobs on a small task; four rounds on one defect; a blocker on a free model;
  WIP sweeps of 196 files.
- Proof: zoo tests for each refusal; a stub job with a polling loop is reported.

### S7 — one task counter, one queue, one event log (R7, R8) — to build, effort S

- What: `scripts/new-task.sh` takes the next id under a lock across both repos and pushes the
  task file at once; `land.sh` refuses an id already on main from another branch. `tasks/QUEUE.yml`
  is the one ordered list, written by the leader only; `land.sh` lands the head or a
  `fixes`/`infra` task. Every script appends to `zoo/events.log` (actor, task, event, duration,
  tokens); `gates.py` and `land.sh` log every refusal with cause and duration; `status.sh` renders
  STATUS from the log only.
- Stops: id clashes (5 in one night); orders changed four times in an hour; failures that cannot be
  costed; token burn nobody measured.
- Proof: concurrency test on the counter; land e2e "not queue head is refused"; log test.

### S8 — deploy only from a green run (R1, R8) — John's decision, effort S

- What: post-land tags `green/<sha>` on green; `deploy.yml` runs on that tag, never on a push to
  main; the GitHub ruleset lets only that workflow deploy.
- Stops: broken code on openisd.app minutes after a landing (the data-loss bug reached prod).
- John ruled on 10 Oct "release is the Pages deploy on main". This row needs him to change that.

### Not a tool: credit

R8 has no gate. The policy already stands (Claude sessions brief, review, land; free models do the
work). S6's timebox and S7's token log make the cost visible per task; a token budget per task
(`budget:` in the task file, `blocked` when exceeded) is in SDLC_DESIGN.md and needs John's numbers.

### S9 — unit tests load their unit once, and the runner stops paying npx (John, 11 Oct: "unit tests should take milliseconds") — live in part (12 Oct), effort S

- Facts (11 Oct, box at load 20): the full unit run is 2280 s for 373 files, vitest's split import
  69 %, tests 22 %, transform 8 % (maryu). One 5-test file: 5.5–9.6 s inside vitest, 16.6 s wall
  through `scripts/test.sh`. `npx vitest --version` 7.9 s; `node_modules/.bin/vitest --version`
  2.3 s. 438 test-file imports name a barrel (`engine/index.js` 164, `@openisd/design/engine` 115,
  `domain/index.js` 105, `@openisd/design` 54) and `domain/index.ts` re-exports the engine, so every
  isolated worker reloads and re-transforms the whole graph per file.
- Not done: tests importing leaf modules. John's ruling of 27 Aug 2026 (engine has one door, tests
  are not an exception) and `architecture-engine-boundary.test.ts` forbid it.
- What, A: `isolate: false` for the `design` and `persistence` projects in `vitest.config.ts`
  (pure node, no DOM); a worker loads the graph once. With it `unstubGlobals: true` and
  `restoreMocks: true`: 13 files use `vi.stubGlobal`, two never unstub. Proof: one full unit run
  green, and its duration against 2280 s.
- What, B: a script already inside heavy.slice (`unit-changed.sh`, `lint-changed.sh`,
  `post-land/suite.sh`, `quiet-test.sh`, `test.sh`) calls `node_modules/.bin/<tool>` instead of
  `npx <tool>`: the funnel has already admitted it, npx adds ~5 s and resolves nothing. 18 call
  sites. Proof: the land e2e and the one-file timing.
- Stops: 38 min unit runs; a landing gate that waits 15 min for the unit half; "unit" tests that
  are integration runs by cost.
- Owner: fable. After maryu's green push (no sweeps before it).
- Done (12 Oct, fable): A and B are in (df939bfb, b87ffdb6, 0acf42d2 leaf imports under QO179),
  and the real cost was a third thing: the `blocked-at` setup file hooked every async resource in
  every worker and captured a stack for each; with isolate off it was installed again per file, so
  a run slowed as it went (63,000 traces, 85 MB log). One 85-test file: 30.0 s with it, 9.5 s
  without. Off by default now, installs once per worker (c41621a5).
  Full unit run: 43.5 min and 381,715 memory-cap hits (8 workers, 11 Oct) → 5.5 min, 0 hits
  (3 workers, 12 Oct, 4486 tests). The 5 GB heavy.slice cap stays as it is.
- Left: 5 tests in 2 ui files red only when sharing a worker, because `appState.ts` holds the live
  state at module level. Fix is S10.

### S10 — appState and presentationState are built by the composition root (John, 12 Oct: "one of my rules was no global state"; "ok injected it") — in progress, effort M

- Plan: `docs/plans/PLAN_20261012_APPSTATE_INJECTED.md`. Sonnet worker in `openisd-t047`
  (branch `t047-appstate-injected`), fable reviews and lands.
- Stops: cross-file state leaks in unit runs; 51 files importing one live instance; `hmrSingleton.ts`.

## Ready to brief now

| Order | Task | Effort | Unblocks |
|---|---|---|---|
| 0 | **S0 gates.py: a stale worktree never stops another session; its removal is never gated** — **done, 9dfe6d1** | S | every session, every time a worktree goes stale |
| 1 | S1 unit half + dependants in the landing gate — **done, 23e50856 on t046-sdlc-enforcement, not yet on main** | S | every F of the R1 kind |
| 2 | S3 watchdog timer + tmux alerts + one-session-per-name | M | every stall and undelivered result |
| 3 | S2 post-land coalesce with kill — **done, d4f1d555 on t046-sdlc-enforcement, not yet on main** | S | lanes held by dead runs |
| 4 | S4 `integrate.sh` with branch tests and corpus check | M | merge data loss |
| 5 | S6 `zoo-run.sh` proof, lint, rounds, timebox, refusals — **refusals, proof, timebox live, 6497dc1**; lint, rounds, open-F refusal to do | M | wasted delegation rounds |
| 6 | S7 counter, queue, event log | S | id clashes, order churn, measurement |
| 7 | S5 remaining rows: config sandbox; main-folder gate; `new-worktree.sh` based on local main | S each | per-session stops; John typing `rm` |
| 8 | S8 green tag deploy | S | needs John's ruling |
| 9 | S9 unit tests load once, no npx in the funnel | S, done | 38 min unit runs; slow landing gate |
| 10 | S10 appState built by the composition root | M | state leaks across unit files; 51 importers of one instance |

## Register — evidence only

Merged by root cause. Times local. "Evidence" names a commit, file or transcript (session prefix,
time).

| # | When | Who | Failure | Cost | Evidence | Fix |
|---|---|---|---|---|---|---|
| 1 | 11 Oct 01:00–12:40 | all | 14 unit failures in 7 files reached main from 5 landings; F7, F8, F9 opened for one fault | every landing refused ~11 h | F7–F9 (`tasks/fixes`), 2a9df7be, post-land.log "RED at dffbd0b881/2d44861caa/a02d6d7895" | S1, S3 |
| 2 | 11 Oct 03:00–11:38 | bob | lint gate "no result within its 300 s deadline; all 4 lanes busy", T038 refused 6×, T040 1× | T038 ~8 h unlanded | 5656885f 02:35, 03:06, 04:07; bob.md item 1 | S2 live 33ff0645 |
| 3 | 11 Oct 02:20–05:10 | lots | four full post-land runs at once (de5a277b 1 h 56 m, dffbd0b8, 2d44861c, a02d6d78); one at 0 % CPU 1 h 31 m; `kill` denied by the classifier; John handed `! kill -KILL …` twice; "no such process" | lanes held ~3 h; John's time | 450fcd94 04:07, 04:33, 05:01; 11:25 John "no such process"; post-land.log F7–F9 runs 2 h 16 m–3 h 43 m | S2, S3 |
| 4 | 11 Oct 02:00 | lots | `/tmp` admission queue reset mid-run, two runs held ticket 1 | a second full run let in | 450fcd94 04:04; T042 a02d6d78 | S2 live |
| 5 | 10 Oct 19:00–11 Oct 13:44 | tools | 12 delegated results "NOT DELIVERED" (T031 r2 ~3 h, T034 ~1 h, T035 r1–r3, T040, T041, T017 r2) | sessions idle on finished work | `zoo/ASK.md` | S3, S6 |
| 6 | 11 Oct 05:00–11:30 | lots | stalls unseen; half-hourly check promised in-session, fires only when idle | John found every stall first; "you are not monitoring" 11:27 | 450fcd94 11:30, 11:32 | S3 |
| 7 | 11 Oct ~02:17 | lots, maryu | T036 conflicts resolved "main wins"; the Qicl move lost; a second Qicl drop at start-up lost values; branch deleted | saved projects refused in prod; ~2 h recovery | John 03:17 "mistake", 03:28 "this can never happen"; T039 dffbd0b8, T041 82851e82 | S4 |
| 8 | 11 Oct 12:40–13:00 | maryu | roles merge turned `driver_type` into a list; every bundled driver and saved project still held the string | ~40 min; caught by the post-merge unit run | 85de7771 | S4 |
| 9 | 11 Oct 11:40 | maryu | merge freeze: four branches merged with no gates; a 4-file conflict and a typecheck error fixed by hand on main | unverified code on main | cd987973, 814ab391, 5fbf617c, 7ec635c5 | S4, S1 |
| 10 | 10 Oct 13:00–19:30 | tools | gate demanded `<worktree>/.venv/bin/python`; no worktree had one; 30+ refusals; John copied scripts by hand | tools stopped ~1 h; John's time | 4118f56b, f4ee80a8 gate errors; John 19:23 "stop why does it need a venv", 19:50 "I've done the cp" | S5 live 43cf2b76 |
| 11 | 10 Oct 23:00–00:10 | tools, bob | a tools test rewrote the real `core.hooksPath`; "git hooks are missing" blocked every tool call in three repos until John repaired it | all sessions stopped ~1 h | f4ee80a8 00:10 "GATE FAILED: git hooks are missing"; John 00:11 "fragile shit like /tmp", 00:13 snapshot rule; 0fd70dd | S5 |
| 12 | 10 Oct all day | lots | main `openisd` folder on `fix/move-qiclfr`; :4000 served it, then `/tmp`, then a stale tree; a separate `openisd-lap` branch | wrong code shown to John; ~1 h | HANDOVER_lots.md "Known loose ends"; John 03:07–03:10 "why do we have a separate branch for lap4000"; lots.md row 1 | S5 |
| 13 | 10 Oct 21:00–11 Oct 02:37 | bob, lots | stuck "new version" notice, reload loop on :4000; T032 took 4 rounds (21+77+36+30 min) | app unusable; 164 min of jobs | John 21:00, 22:16, 23:00 "wtf !!"; DELEGATION_LOG; 98452289 | S6 |
| 14 | 11 Oct 03:19–05:40 | bob | T034 ran 158 min on a free model for a small task; T035 three rounds, r3 still had the polling loop the brief forbade; r2 loosened assertions | ~4 review rounds | DELEGATION_LOG; bob.md item 12 | S6 |
| 15 | 11 Oct 05:04 | tools | `zoo-run.sh` summary overwrote the T041 review report | review redone | lots.md; 39f976d | S6 live |
| 16 | 11 Oct 12:34 | tools | WIP commit swept 196 runtime files (`zoo/state/*`) | noise | lots.md row 14 | S6 |
| 17 | 11 Oct 04:30–11:30 | lots, tools | task ids used twice: T035, T040, T041, T042, T043 | crossed reports, renames | lots.md; `tasks/` (no T043–T045 files on main) | S7 |
| 18 | 11 Oct 11:00–11:30 | lots | orders changed repeatedly: T038 hold→finish; order T038/T034/T035 reversed; delegate→do it yourself; then the freeze | re-planning; T034 never ran its browser specs | bob.md item 13; 450fcd94 11:29–11:36 | S7 |
| 19 | 10 Oct 20:39 | lots | two `maryu` sessions under one name; John asked lots to find the right one and kill the other | risk to a session's work | John 20:39; 5656885f 20:33 "There are two maryus" | S3 |
| 20 | 11 Oct 02:16–02:51 | lots | 43 stale worktrees and 30+ junk branches; deletion blocked by the classifier; John deleted them by hand | John's time | John 02:16 "remove the 23", 02:31 `git branch -D …`; 450fcd94 02:28 | S3 |
| 21 | 10 Oct 20:47, 21:46 | bob | T030 overlay caught other specs' clicks (F5); F2 a fixture typing error | two fix landings, ~2 h | F5, F2; e4f26ba8 | S1 |
| 22 | 8 Oct 19:00–21:30 | all | commit hooks ran full test runs; five commits queued at 30 min each; load 37; tools' commit refused twice by a 60 s duplicate-code test | ~3 h; "we have been stuck for 2 days" (John 22:06) | John 21:25; 450fcd94 19:29, 20:08; T004 fast hooks 20:26 | fixed (fast hooks, T004) |
| 23 | 8 Oct 02:00–02:30 | all | attribution guard waited on stdin, two stuck processes; sessions could not message or spawn (gate) | ~30 min | 450fcd94 02:23, 03:14; BUG_20261008_attribution-guard-* | fixed |
| 24 | 8 Oct 23:58; 9 Oct 01:40 | 3 sessions | usage limit cut-offs; "run out of credit again" | work moved to free models; slow rounds | transcript system notes 23:58 (5656885f, d9bb959c, ee0f8a32); John 9 Oct 01:40 | policy; S6, S7 |
| 25 | 11 Oct 03:00 | lots | a slow run reported as "hung"; a later kill hit nothing | wrong report to John | 450fcd94 04:03; John 04:02 "why test hung", 11:25 | S3 (only the watchdog says "hung") |
| 26 | 11 Oct ~14:30 | tools, maryu | two stale worktrees from `new-worktree.sh` (`winisd_tools-t036`, `winisd_ws-t037`) had no `.venv`; `gates.py` refused every tool call in tools' session and then in maryu's ("…t036/.venv/bin/python is missing"), including the call that would delete them; tools handed John a `! rm -rf …` command; its `worktree remove` and `branch -D` parts failed (already gone; stale record) until maryu pruned by hand | both sessions stopped; John ran the command; John: "another ai mess I have to fix" | maryu's report 11 Oct; John's pasted text; row 10 (same gate, 10 Oct) | **S0 critical**, S3 (prune on the timer) |

## Agent answers

| Agent | Answered | Used |
|---|---|---|
| bob | yes, 15 items with times and costs | rows 2, 3, 5, 11, 13, 14, 18, 21 |
| lots | yes, 16 rows | rows 3–7, 12, 15–20 |
| openisd-c5 | yes: no failures hit (one Vite edit) | row 12 (branch observation) |
| tools | no answer within the window | its transcript: rows 10, 11, 15, 16 |

## Decisions for John

1. S8: deploy openisd.app only from a green tag, not on every push to main.
2. Budgets: default 45 min and 2 rounds per delegated job; a token budget per task.
3. Confirm the enforcement files (`gates.py`, `scripts/land.sh`, `scripts/land/**`, `scripts/admit*`,
   the watchdog units, `zoo-run.sh`, `.github/workflows/**`) change only by an `infra` task you approve.
