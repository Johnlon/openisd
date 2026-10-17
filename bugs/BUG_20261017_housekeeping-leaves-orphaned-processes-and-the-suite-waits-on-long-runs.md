# BUG_20261017_housekeeping-leaves-orphaned-processes-and-the-suite-waits-on-long-runs

**Status:** OPEN

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
