# BUG_20261007_browser-processes-die-mid-suite

**Status:** OPEN. Chrome aborts itself in launch bursts (see Cause); a launch wait is PROVISIONAL (below).

## Symptom
During a full browser suite (the pre-push hook), Chrome processes die and a large block of tests fails at once with
`browserType.launch: Target page, context or browser has been closed` or `page.goto: Target page, context or
browser has been closed`. A rerun of the same tests passes. Twice on 2026-10-07.

## Evidence
1. bob's push, about 05:30 (reported by lots): 24 browsers died within 5-30 ms. Logs holding the error, in
   `build/test-logs/` of the shared tree: `20261007-054724-3101336.log.filtered`,
   `20261007-055133-3123415.log.filtered`, `20261007-055351-3132117.log.filtered`.
2. The `reads-schema` branch push, started 07:54: 180 of 342 browser tests failed (162 passed, 5.3 min instead of
   about 10), 94 of them `browserType.launch`. Log:
   `/home/john/work/winisd/openisd-reads/build/test-logs/20261007-075423-3405614.log.filtered`. Lint, typecheck and
   unit tests passed in the same run.
2b. The same push rerun at 08:06: again 180 failed, 56 passed (3.3 min), 108 `browserType.launch`, with
   `exception while trying to kill process: Error: kill ESRCH`. Log:
   `/home/john/work/winisd/openisd-reads/build/test-logs/20261007-080620-3446326.log.filtered`. The failed count is
   180 both times, which a random death would not repeat. Both runs were from the `openisd-reads` worktree; the
   health checks from `openisd-hc2` (573 passed twice) were not hit. Not yet shown whether the worktree, the
   branch tree or the pre-push copy is the difference.
3. Machine at the time of the check (08:00:45): 16 GB total, 7 GB used, 9 GB available; nothing else running.
   lots reports: load_guard not running, no `pkill` on chrome in the repos, cgroup `oom_kill` 0, /tmp 37 % full.
4. `dmesg` has WSL lines `WSL (152) ERROR: CheckConnection: getaddrinfo() failed: -5` and `connect() failed: 101`,
   at uptime 629039 and 629060 s, which is about 07:32:36 and 07:32:57 by the clock (uptime 630728 s = 08:00:45).
   Earlier groups at uptime 612364 to 613477 s (about 03:11 to 03:13). None of them falls inside either failing
   run (about 05:30 and 07:54 to 07:59), so the WSL lines are not shown to be the cause.

5. Leak: `scripts/health-check.sh` "Verify Preview" leaves its Vite server running. After the 07:50 health check in
   `openisd-hc2`, `vite --port 4102 --strictPort` was still running 25 min later (stopped by hand 08:14). A
   separate `vite --port 4101` from the shared tree had run for 7 h (not this run's). Unproven whether leaked
   servers contribute to the Chrome deaths.

6. Caught in the act (reads-schema push, 09:09:58 to 09:16, a 1 s sampler of Chrome count, MemAvailable, load, `ps`,
   `dmesg`): Chrome count was steady at 18-20 for 3 min; at 09:13:06 every Chrome process died inside one second
   (MemAvailable +750 MB), then for 40 s (to 09:13:46) the count flipped between 0 and 5-20 every 1-3 s: launch, die,
   launch, die. The 180 failures happened inside that burst, 4-30 ms each, and `maxFailures: 180` ended the run. The
   Playwright runner stayed alive; no `kill`/`pkill`, no new process, load 9-10, 7-8 GB free. `dmesg` holds one crash
   today: `chrome: potentially unexpected fatal signal 6` at 08:39:11 (pid 9185), inside the 08:33 failed run.
7. The 180 counts match: every bulk death hit `maxFailures: 180` (playwright.config.js). 5 of 8 pre-push and
   health-check runs died on 2026-10-07 (05:30, 07:54, 08:06, 08:33, 09:09); 3 passed (two health checks, 08:49).

## Cause
Chrome aborts itself (SIGABRT) in a burst of about 40 s during launches under WSL2; why is not known. Not another
process, load, memory or the shell environment: the hook's environment matches the shell's. The failure cap turns
the burst into a failed run.

## Fix
Catch it in the act: when a run starts to fail, record `ps` for chrome, `dmesg` and `journalctl`/WSL state at that
moment. Until then a broad `has been closed` failure is rerun whole, never read as a code failure.

## Verification
A full browser suite run 5 times without a mass browser death, or a captured cause.
