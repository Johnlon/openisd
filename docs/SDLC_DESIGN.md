# SDLC design — tools run the process, agents only do work

John, 11 Oct 2026: "I prefer tools to agents, and automatically scripted timers and reminders
direct into the face of agents rather than prose that suggests doing that"; "maximise throughput
and still accommodate discovery, and if facts change then change the work".

The root causes, the ranked solutions (S1–S8) and the evidence are in [SDLC.md](SDLC.md). This
file is the system those solutions add up to once they are all live. Nothing below asks an agent to
remember anything. Verified against the transcripts on 11 Oct 2026 (maryu's report); numbers below
corrected from `zoo/DELEGATION_LOG.md` and `zoo/ASK.md`.

## Numbers, 8–11 Oct 2026

| Measure | Value |
|---|---|
| Delegated jobs (DELEGATION_LOG) | 40 lines, 25 real jobs, 1 failed; 12 results never delivered (ASK.md) |
| Rounds per job | up to 4 (T032: 164 min); never recorded as rounds |
| Landings blocked | ~11 h on 11 Oct (F7–F9 from one fault); T038 alone ~8 h |
| Full post-land runs overlapping | up to 4 at once; each then took 2 h 16 m to 3 h 43 m |
| Open F files at the freeze | 3 (F7, F8, F9); 9 opened in 4 days |

## One principle

Every rule lives in exactly one place, and that place is a script that refuses, kills or alerts.
Prose in CLAUDE.md and skills tells agents what the scripts will do to them; it never asks for
behaviour.

## The six systems

| System | Replaces | Script | SDLC.md solution |
|---|---|---|---|
| 1. Ticket state machine | agents' chat about what is going on | `task.sh` | S7 |
| 2. Work queue and dispatch | the leader remembering the order | `queue.sh`, `dispatch` timer | S7 |
| 3. Resource scheduler | 4 separate queues that fought | `admit` (one) | S2 |
| 4. Watchdog | agents checking in | `watchdog` timer | S3 |
| 5. Event log and STATUS | reports written by hand | `events.log`, `status.sh` | S7 |
| 6. Discovery and replan | "if facts change" left to memory | `finding.sh`, `assumptions:` | — (after S1–S7) |

The gates themselves (unit half at landing S1, `integrate.sh` S4, `zoo-run.sh` proof S6, the
environment self-checks S5) are in SDLC.md; they come before systems 1, 2, 5 and 6 because they
stop the costliest failures (R1, R5) on their own.

### 1. Ticket state machine — `task.sh`

Every unit of work is `tasks/T<nnn>.yml`, created only by `task.sh new` (id under a lock, pushed at
once; the only T counter for every repo in the workspace). State moves only by `task.sh`:

```
open → claimed → working → review → landing → landed
                    ↓          ↓
                 blocked    replan
```

| Transition | Who | Script does |
|---|---|---|
| `new` | leader or any session | id, `goal`, `cause` (observed fault, required), `done_test`, `files`, `budget` (minutes, rounds, tokens), `assumptions` |
| `claim` | a worker | writes owner, pid and start time; refuses if the owner already holds a `working` task |
| `delegate` | the owner | refuses if `critical: true` or an open F names the task; writes brief path and round n |
| `review` | `zoo-run.sh` at job end | attaches the result, the test outcome ("proven"/"unproven"), minutes and tokens |
| `land` | `land.sh` | only from `review` or `working` with `done_test` green; refuses if not queue head |
| `block` | any | one sentence; the watchdog alerts the leader |
| `replan` | `finding.sh` (6) | automatic when a finding contradicts an assumption |

Hooks refuse a commit in a worktree whose task is not `working`, and a push from anything but
`land.sh`. The YAML is the record; no agent writes it by hand (L1 refuses `tasks/*.yml` edits).

### 2. Work queue and dispatch — `queue.sh`, `dispatch` timer

`tasks/QUEUE.yml` is one ordered list, written only by the leader with `queue.sh` (`add`,
`move`, `drop`). Rules the scripts enforce:

- `land.sh` lands only the queue head, or any task labelled `fixes`/`infra`. No other order exists.
- An open F file is inserted at the head automatically, owner = author of the first red commit.
- The `dispatch` timer (every 2 min) matches the head of `open` tasks to a free worker (a session
  with no `working` task and a heartbeat under 10 min) and types the claim into its tmux window.
  Nobody waits to be told; nobody picks their own work.
- Tasks carry `needs:` (`chromium`, `post-land`, `agy`, …); dispatch never starts a task whose
  needs are saturated (3).

### 3. Resource scheduler — one `admit`

Today four schedulers fight: heavy lanes, admit slots, Playwright worker reservation, zoo leases.
One `admit` owns every scarce resource:

| Resource | Budget (this box) | Who asks |
|---|---|---|
| `cpu-lane` | 4 | full suites, builds, corpus runs |
| `chromium` | 4 workers, 1.4 GB each | every Playwright run, by worker count |
| `post-land` | 1, coalescing (newer sha cancels older) | post-land run |
| `agy`, `opencode` | 2 each (quota, not CPU) | `zoo-run.sh` |
| `ram` | 10 GB of 15 | derived from the above; `heavy.slice` MemoryMax |

Rules: a light command (lint, typecheck, one unit spec, one browser spec) never asks and never
waits. A heavy command asks `admit <needs> -- cmd`; the wait is printed every 30 s with what it is
behind, and recorded in `events.log` with duration. Holders are recorded by pid and start time;
a dead holder frees its grant at the next scan. The lock dir is outside `/tmp`. `gates.py`
refuses a heavy command that did not go through `admit`.

### 4. Watchdog — a systemd user timer, every 5 min

Replaces every "I will check" in any agent. Each tick:

| Check | Action |
|---|---|
| post-land run whose sha is an ancestor of a newer one | kill its group, free its grant |
| any run with no log growth and ~0 % CPU for 20 min | kill, log, open or append an F |
| grant held by a dead pid | free |
| `review` result not acknowledged in 15 min | alert the briefer, repeat every 30 min |
| task `working` with no commit and no heartbeat for 45 min | alert the owner; at 90 min set `blocked` and alert the leader |
| task over its `budget` (minutes or rounds) | set `blocked`, alert the leader |
| open F older than 30 min with no `working` owner | alert the leader every 30 min |
| gate refused twice in an hour for the same cause | open an `infra` F, head of queue |
| agent heartbeat (a PreToolUse hook touches `~/.local/state/agents/<name>`) silent 30 min while it owns work | alert; at 60 min release its tasks to `open` |
| clean worktree whose branch is merged | remove |
| SDLC.md row `to build` with no task | alert the leader daily |

Alerts are **typed into the owner's tmux window** (`tmux send-keys`, session `agents`, John's
choice, 11 Oct 2026), prefixed `WATCHDOG:` with the task id and the one action wanted. An
agent with no window gets a line in `ASK.md` and the leader is told. The watchdog never asks John
to run anything; it writes what it did.

Agents are started only by `agents-into-tmux.sh <name>` (resumed, one live session per name,
heartbeat hook installed). L1 refuses `systemctl --user stop|disable|mask` on the timers.

### 5. Event log and STATUS

Every script appends one line to `zoo/events.log` (time, actor, task, event, duration, cost):
task transitions, grants and waits, landings and refusals with cause, post-land results with
failing spec names, kills, reroutes, rounds with tokens and minutes, alerts sent.

`status.sh` (on the watchdog tick) renders `STATUS.html` from the log only: the queue with
owners and ages, every grant and wait, open Fs, agents with last heartbeat, jobs with round and
budget, and the day's numbers: landings, block minutes, kills, tokens by task. No agent edits it.

Tokens: `zoo-run.sh` records each round's tokens from the CLI's own count; Claude sessions
record theirs via the `/cost` hook per task. A task past its token budget goes `blocked`.

### 6. Discovery and replan — `finding.sh`

Discovery is expected; forgetting it is not. Any agent or script records a fact with
`finding.sh "<fact>" --task T<nnn> --contradicts <assumption-id>`. It writes
`findings/<date>-<n>.yml`, appends to the log, and:

- if it names an assumption of a task in `working`/`review`, that task goes `replan`: its
  owner's window gets the finding; `land.sh` refuses it until the leader runs
  `task.sh replan T<nnn> --keep|--split|--drop` with one sentence;
- if it names a WinISD behaviour, it opens the bug file skeleton (`bugs/BUG_*.md`) with the
  evidence line, so the bug-reporting rule needs no memory;
- the leader's window gets every unresolved finding again every 2 h.

Rulings from John are recorded the same way (`finding.sh --ruling "..."`), dated and quoted,
so briefs can only cite a ruling that exists.

## What agents still decide

Only three things: what to write in a brief (the script checks it has a test command, a John
quote where rules change, and round N's findings), how to fix a failing test, and the leader's
queue order. Everything else is refused, killed or typed into their window by a script.

## Build order (each item: test first, scratch-repo proof, then switched on)

The order is the "Ready to brief now" table in [SDLC.md](SDLC.md): S1 unit half at landing, S3
watchdog, S2 coalesce kill, S4 `integrate.sh`, S6 `zoo-run.sh` proof, S7 counter/queue/log, S5
leftovers, S8 green-tag deploy. System 6 (findings and replan) comes after all of them. Every item
is `infra`: built by a Claude session, never a free model.

## Decisions for John

Listed once, at the end of [SDLC.md](SDLC.md). This file adds the timing numbers to confirm:
heartbeat silent 30 min alerts, 60 min releases the task; a `working` task with no commit for
45 min alerts, 90 min blocks; 4 h per task before `blocked`.
