# PLAN 2026-10-08 — SDLC cleanup: multiagent that finishes things

Coordinator: lots (John, 2026-10-08, late: "lots takes control now" — all work stops, lots
documents everything half-finished as a written task list and hands out tasks one at a time
until the build is green; fab's rulings and decisions stand unless lots' list changes them).
Status: APPROVED by John 2026-10-08. Target ~4 hours for T000–T006 (the machinery live) —
urgency, not a cutoff (John); T007–T010 run through the new process after. Supersedes the ad-hoc
queue/marker fixes-in-flight. Decisions with the approval: glob folds into lots; CI fixtures
by checking out winisd_drivers in the workflow.

## Goal

1. A clean test suite, locally and in CI.
2. Work lands on main without collisions, lost hours or orphaned processes.
3. Workers of any model (Sonnet/Haiku) can run the process — judgement lives in files and
   gates, not in a smart coordinator.
4. The three finish lines reached: bp6/ABC complete, the tools rebuild + report + db swap,
   infra frozen.

## Principles (each removes a class of failure permanently)

1. **Process in scripts, files and gates — never prose or judgement.** A worker loops until a
   command passes; it never decides.
2. **Isolation.** Every agent works in its own worktree outside the shared tree. The shared
   tree is read-only and serves John's preview from committed main only.
3. **One path to main.** `scripts/land.sh` is the only thing that moves main. Serial, minutes
   not hours.
4. **Gates fail closed** on their own deadline, set well under the harness's 600 s hook limit.
5. **Finish lines.** A finding off the task is a new task file in the backlog, never code.
6. **Replacement before deletion.** Old machinery (queue, marker, tested-tree skip, watchdog)
   is deleted only after `land.sh` has landed real traffic.
7. **A status claim names its evidence** — the exit code, the log path, the count. A claim
   without evidence is not a status. (Added after two reports had to be corrected after the
   fact: a suite "returned success" whose pytest had exited 1, and a baseline "match" with
   428 records never rebuilt.)

## Operating model

| Who | Does | Does not |
|---|---|---|
| bob | bp6/ABC steps 6–13, own worktree | infra, other agents' files |
| maryu | the 4 infra tasks below, then frozen | feature work |
| tools | the final rebuild + better/worse report | new scrapers scope |
| lots | writes task files, re-splits blocked ones, transcribes John's rulings | implementation, approving code, watching runs |
| fab | this plan, arbitration while the cleanup runs | implementation |
| John | task order, domain rulings, db swap, deploys, any gate bypass or limit change | — |

glob's relay/ledger duties fold into lots.

### Task file (`tasks/T<nnn>.yml`) — the whole worker contract

- `id`, `owner`, `status: open | claimed | blocked | landed`
- `goal`: one sentence
- `done_test`: a command that must exit 0. Written by the task author, never the worker —
  `land.sh` refuses a branch that edited its own task's `done_test`.
- `locked`: the files the done_test depends on (the acceptance spec, fixtures), author-written
  and hash-locked in the task file; `land.sh` refuses if any changed. A worker may add new
  specs for its code, but cannot touch the acceptance spec. For TDD work the author writes the
  failing spec as part of the task.
- `files`: glob allowlist; the pre-commit gate rejects a commit touching anything else.
  Open claimed tasks must have disjoint allowlists (checked at claim).

Both repos use this: openisd and winisd_tools each get their own `land.sh` (shared
implementation, per-repo config) and their own flock — a tools landing never waits behind an
openisd one (John, 2026-10-07: no queueing across repos). Machine-wide heavy contention ends
when openisd's suites move to CI (P2/P3).

Worker loop: claim → edit only listed files → run `done_test` until green →
`bash scripts/land.sh T<nnn>`. Can't proceed → `status: blocked` + one plain sentence, stop.

### `scripts/land.sh <id>` — the only path to main (flock-serialized)

1. Commit everything in the worktree (COMMIT-FIRST rule).
2. Rebase onto origin/main; conflict → abort, mark blocked, exit.
3. Fast gates, each fail-closed on its own deadline: lint, typecheck, `done_test`,
   attribution guard. Minutes total.
4. Refuse while a red-main fixes task is open (later: while CI is red), unless this task is
   labelled `fixes-ci`.
5. ff-push main; push triggers CI and the post-land run.

### Hard limits (gates, not prose)

- File allowlist enforced at pre-commit; allowlist disjointness at claim.
- One local heavy job machine-wide (flock). Heavy suites never run pre-commit.
- Workers may not edit `scripts/`, hooks, or another task's file. Infra changes are
  themselves tasks, built in scratch, end-to-end tested (processes.md rule 7).
- Housekeeper (already approved): tagged pids, dead owner → kill, systemd timer.

## Phases

### P0 — today: stop the bleeding

- Freeze all new scope. Every open finding becomes a backlog task file.
- lots writes the task files for P1–P3 and the finish lines (done-tests included). This is
  the one Fable-effort sitting; after it, any model runs the system.
- Close QO174 before the bootstrap landing: confirm the 6 reverted test/hook scripts and
  heavy.sh match their tested versions, and the tools baseline runs were restarted. The
  bootstrap builds on those scripts.

### P1 — this week: land.sh (owner: maryu). Does NOT wait on CI.

- `land.sh` + task files + allowlist gates, scratch-built, end-to-end tested with two
  concurrent fake runs before wiring in.
- **Interim test authority**: one post-land full run (unit + browser) on the committed sha,
  serialized by the land flock. Red → auto-opens a top-priority fixes task; next land refuses
  while it is open. Post-land holds no tree, so collisions cost nothing even while suites are
  local. No auto-rerun of flaky specs: a flake is a red, it opens a fixes task naming the spec.
- **Deploy stops tracking main**: `deploy.yml` triggers on the `release` branch;
  the post-land run fast-forwards `release` on green. A red build never deploys, pushes are
  never blocked, and nothing waits on CI being green. P2 replaces this with a `needs:` gate.
- Rules docs change in the same landing as the scripts: verify.md and processes.md stop
  describing the queue, the pre-commit unit run and "announce slow runs", and describe
  land.sh and the post-land run instead. Two live rule sets is how agents follow both.
- maryu's committed openisd-queue worktree (narrowed queue, tested-tree skip, commit marker,
  land.sh draft) is not wired in: harvest the land.sh draft for P1, the rest dies in P4.
- Done-test: two scripted concurrent landings in a scratch repo both land serially, with the
  gates run and nothing orphaned.

### P2 — parallel: CI stage A + deploy gate (owner: maryu)

- CI has never been green: 389 runs since 2026-07-06, 0 green. So: stage A = lint +
  typecheck + unit on GitHub runners, fixtures fixed (check out winisd_drivers or vendor
  them). No browser.
- Deploy: as soon as stage A exists, `deploy.yml` gains `needs:` on those jobs. Until then
  deploy stays as it is — a gate that blocks every release before CI can pass breeds
  `--no-verify` culture.
- Done-test: one push → a fully green stage-A run, and a deliberately red unit test blocks
  the deploy job.

### P3 — time-boxed spike: browser tests on CI (owner: maryu, last infra item)

- Browser on GH runners has never executed green (last attempt 2026-07-20, failed). This is a
  hypothesis, not a plan line. Time box: 2 days.
- Fallbacks, either acceptable permanently: a self-hosted runner in its own container, or the
  browser suite stays the local post-land run from P1 forever (already collision-free).

### P4 — delete the old machinery

- After land.sh has carried ~a dozen real landings: delete the commit-in-progress marker,
  the tested-tree skip, the vite-watchdog, the flaky auto-rerun (rerun.mjs) and maryu's
  unwired queue worktree. Hooks shrink to the fast gates. The rule docs lose the deleted
  machinery in the same landing.
- The slow-run queue is not deleted, it is REPLACED: T011's admission gate (one machine-wide
  heavy slot, gates.py-enforced, housekeeper-freed) is the queue widened to every heavy job
  in every repo. heavy.sh's 4 lanes become 1. The queue's scripts retire when T011 is live
  and has arbitrated real contention, not before.

### P5 — make every loop cheap (backlog until P1–P2 land)

- The unit suite spends ~70 % of its 8–9 min importing 436 modules through the engine's
  single entry point. Fix the entry point; the suite drops to minutes locally and in CI.

### Finish lines (run through the new process as soon as P1 is live)

- bob: bp6/ABC steps 6–13, one task file per step.
- tools: final rebuild + better/worse report → John approves the db swap. Two ledger items
  land inside this finish line, not beside it:
  - QT73 (deferred): the four unresolved record classes (seas old-code dirs, grs face-plate
    relics, visaton w-100-x-2-x-4-ohm, eminence odeum-8n) will turn the live-drop guard red
    at the rebuild unless John rules on them. The rebuild task puts those four rulings in
    front of John once, before it starts. Until ruled, the records are carried forward live
    and flagged — never dropped. expected_drops.yml holds only John's verbatim, dated
    rulings; a class he rules dropped goes in with his words then.
  - QT75 (deferred): the per-driver census John asked for IS the better/worse report —
    every record added, removed or changed, by cause. One report closes both.
- maryu: P1, P2, P3, P5 — then infra frozen.

## What John decides, nothing else reaches him

- Approve this plan and the task order.
- Domain rulings (questions.yml, as now).
- The db swap, driver releases, anything user-visible shipping.
- Any gate bypass, any discard of work, any change to a limit or a done_test after the fact.

## Named risk

The intelligence moves into task decomposition. One vague done_test or over-wide allowlist
recreates the spiral. Hence P0: the initial task set is written carefully once, then cheap
models execute it.

## Task list — 2026-10-08 (lots, in control; John's order)

All work stopped. Tasks are handed out one at a time; the next starts only when the previous
one's proof is in. Status: `todo` · `doing` · `done (proof)`.

### Half-finished work, as found

| Where | Owner | What | State |
|---|---|---|---|
| `openisd` (shared) | lots, bob | this plan; bob's plan steps 6–8 marked done; `questions.yml` QO174 closed | uncommitted |
| `openisd-land` (`land-t001`) | maryu | T001–T004: land.sh, task gates, post-land run, rule docs, fast hooks | uncommitted (16 paths); all four locked specs pass |
| `openisd-queue` | maryu | old queue changes (ticket narrowing, tested-trees, commit marker); attribution-guard bug file | staged, uncommitted; superseded by T001–T004 |
| `openisd-ci-a` (`ci-stage-a`) | T006 worker (stopped) | CI fixtures vendored (3 files) + sync script; ci.yml/deploy.yml edits | staged, uncommitted, never pushed |
| `openisd-ci-b` (`ci-browser`) | T007 worker (stopped) | `ci-browser.yml` | staged, uncommitted, never pushed |
| `winisd_tools-land` (`land-t005`) | maryu | T005 worktree, venv now present | empty |
| winisd_tools | tools | QT73 rulings: none executed; title-line reader + pymupdf bump have no full-suite result | committed (0d256b6e) |

### Order to a green build

| # | Task | Owner | Proof | Status |
|---|---|---|---|---|
| 1 | Commit the shared tree's 3 paths (plan, bob's plan, questions.yml) | lots | commit sha | done (1ae9f933) |
| 2 | Commit `openisd-queue`, `openisd-ci-a`, `openisd-ci-b`, `openisd-land` as WIP on their own branches (nothing lost; not landed) | maryu | 4 shas | done (bc9ece80, 8cd6d447, 405c1cda, e81e0e9c) |
| 3 | Gate bug: `run_gates.py` checks only the repo a command touches; a worktree without a venv never blocks other sessions (still fails closed for its own repo) | maryu | locked test + commit | done (workspace 6b26fbf1, 9/9 new tests; land.sh lint refuses without node_modules 4f77672b) |
| 4 | tools full suite on 0d256b6e, box quiet | tools | pytest exit code + summary + log path | doing |
| 5 | T000: `openisd-land` rebased on main, verify.md T011 interim bullet added, committed through the full old hook once, ff to main, pushed | maryu | sha on origin/main | todo |
| 6 | Post-land full run on that sha (unit + browser), no rerun | maryu | log path, exit 0 → `release` moved | todo |
| 7 | CI stage A: push `ci-stage-a` branch, iterate to green lint+typecheck+unit | maryu | run URL at the pushed sha | todo |
| 8 | Land CI stage A + deploy `needs:` via land.sh | maryu | sha + green run | todo |
| 9 | T011 admission control (one slot, gates.py enforced) | maryu | admit.e2e + test_gates_admission green | todo |
| 10 | T005 winisd_tools land.sh copy | maryu | tools land.e2e green | todo |
| 11 | bob: bp6/ABC steps 9–13, one landing each via land.sh | bob | sha per step | todo (after 6) |
| 12 | tools: final rebuild + report (T010) | tools | live-drop guard green + report path | todo (after 4) |

Green build = step 6 passes on origin/main and step 8's CI run is green.

### Backlog (not on the path to green)

- `~/.claude/bin/heavy.sh` under version control.
- Workspace repo: add `.gitattributes` (`*.sh eol=lf`); `core.autocrlf=true` turns fresh `.sh` checkouts CRLF.
- A worktree's hardlinked winisd_tools `.venv` resolves project imports to the main checkout: T005 fixes it before its tests count.
- `run_gates.py` was edited live (6b26fbf1) — proven by temp-workspace tests and use since.
- QT73 items 1, 3, 5 executed by tools after step 12's prerequisites: item 1 conditions pass (73/73), item 3 = W8 woofer by SEAS menu, item 5: visaton k-28-40-h-8-ohm is live → regenerate; GRS pages inconclusive.

### Rulings recorded

- QT73 item 2: John 2026-10-08 "keep" — `exotic-f8` (X1-04) and `exotic-f8-8` (X1-08) both stay (e474ba67).
