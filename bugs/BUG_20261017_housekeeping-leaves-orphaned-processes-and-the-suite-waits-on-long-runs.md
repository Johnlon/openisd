# BUG_20261017_housekeeping-leaves-orphaned-processes-and-the-suite-waits-on-long-runs

**Status:** FIXED (T297, orphans); the browser-lock wait report and the busy-loop test cleanup are split out below

## Symptom
17 Oct 2026, 04:20. The post-land suite on 96acf25250 started at 03:33 and had run no test after 46 minutes. fable's guess was the orphaned vite servers or dead budget claims. Neither is the cause.

## What waits behind what (read-only, 04:20)
There are two things, the post-land suite and three long browser runs. The suite holds the exclusive browser lock request (`suite-lock.sh exclusive`, pid 4041714) and waits for every shared holder to end. Holders of `suite-run.lock`:
- t271 `test-browser.sh` quiet-test, pid 3922215, 91 min old, owner shell alive.
- t271 `test-browser.sh` quiet-test, pid 3958640, 86 min old, owner shell alive.
- t282 `test-browser.sh` quiet-test, pid 4036076, 54 min old, owner shell alive.
- t268 `suite-lock.sh shared`, pid 4063195, waits on the gate (the suite holds it); 31 min.
No admission slot is the cause: `admit.sh` already holds its slot (pid 4041672). The budget claims are not the cause.

## Orphans found (rule 4 of `.claude/rules/processes.md`: tagged, owner dead, never cleaned)
- vite preview on 4103, pgid 2766014, 5.6 h, cwd `.postland/2757994-fce7d5af51` deleted, 196 MB.
- vite preview on 4104, pgid 3154114, 4.5 h, cwd `.postland/3141624-2ad11c79a6` deleted, 161 MB.
- vite preview on 4102, pgid 774652, per fable.
- Three `bash -c 'while :; do :; done'` busy loops, each at 99% CPU for 4.5 h, parent `/init`: pids 3148079 and 3300848 (cwd `openisd-t254`), 3307428 (cwd a deleted scratch `mainwt`). They look like leaked test helpers (admit tests).

## What we need
- `scripts/housekeeping.sh` kills a tagged process whose owner is dead and removes its port claim, including a vite preview started by a post-land clean copy that no longer exists. Today it reports "0 slots freed, 1 live".
- A busy loop in a test helper is killed by the test that starts it, by its recorded pid.
- A post-land suite waiting for the browser lock tells which holder it waits for, with its age, every 5 minutes. A run that holds the lock for more than 30 minutes is alerted to its owner.

## Verification
Scratch-repo e2e: kill a run's owner, run housekeeping, no process of that run survives and its port is free.

## Cause (maryu, T297)
Housekeeping judged only by record files: admission slots, browser-run records and post-land copies. It
never looked at the processes themselves. The vite previews' browser-run records were gone, and so were
their post-land run and clean copy, so nothing named them. The previews were in their own process group,
reparented to init, so the run's own group kill missed them too. Each one still carried
`OPENISD_BROWSER_OWNER="<pid> <start>"`, naming its dead owner.

## Fix (T297)
- `scripts/housekeeping.sh` has a new tick step. It reads `OPENISD_BROWSER_OWNER` from `/proc/<pid>/environ`
  for every process it can read. A process whose owner pid is gone, or was reused (another start time), is
  stopped: TERM, then KILL after 5 s.
- The process is stopped with its group when the group leader carries the same tag; otherwise only the
  process itself. The scan's own group is never touched.
- A pid that was reused between the scan and the kill is skipped.
- If `admit_starttime` fails to load, the scan stops loudly, since then every owner would look dead.
- `OPENISD_RUN_ID` is not used to judge a process: a post-land run started by land.sh carries land.sh's
  run id and outlives it.
- Dry list on the live machine before landing: exactly the 4103 (pgid 2766014) and 4104 (pgid 3154114)
  previews. 4102 and the three busy loops had already gone.
- Proof (rule 7), `scripts/land/test/housekeeping.test.sh` case 9 on real processes, with a scratch tag
  name so no real process is seen:
  - the owner is killed and its clean copy deleted: the tagged group is stopped and the stop is logged;
  - a tagged child under an untagged leader: only the child is stopped;
  - a live owner's tagged process is left alone.

## Not in T297
- The busy loops (`while :; do :; done`) came from T254's admit tests and carry no tag. That test's
  cleanup is with the agent fixing ts-log-kill (fable).
- "A suite waiting for the browser lock names the holder every 5 minutes, and a holder over 30 minutes is
  alerted": no longer needed while the suite runs on GitHub Actions (T266), because the laptop post-land
  run takes no browser lock. It returns only with the laptop rollback.
