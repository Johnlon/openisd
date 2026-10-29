# BUG_20261017_laptop-suite-server-dies-mid-run

**Status:** FIXED (heavy.slice limits, bob, 17 Oct 2026; closed in T293)

## Symptom
Three laptop post-land runs went red the same way: 9a5062a2da (F49), 788a5c4ea3 (F49, then killed by the
watchdog as hung after 20 min of silence) and 96acf25250 (F50, heavy.slice over MemoryHigh during the run).
The laptop post-land run on 9a5062a2da went red (F49). Driver-editor specs failed in about 200 ms each,
then "529 did not run" and "1 error was not a part of any test". GitHub Actions ran the same sha green
(run 38991195452). The test server most likely died partway through the run.

## Evidence so far
The F file keeps only the last 40 lines of output, so the first error is lost. Part of the fix: keep the
whole output of a red run where the F can link to it.

## Cause
Not found yet.

## Cause
heavy.slice had MemoryHigh=5G, MemoryMax=6G and no swap. A full laptop suite peaks at about 8.2 GB in that
slice. Over MemoryHigh, the kernel does not kill: it throttles every process in the slice (memory.events
`high` counted 1.8 million throttles during the failing runs, `oom_kill` 0). The test server stalled under
the throttling, so every spec after it failed in 150–200 ms, and in the worst run the suite went silent
until the watchdog killed it as hung.

## Proof
Repro on 9a5062a2da (a commit that went red this way), 17 Oct 03:53–04:20Z, under heavy.slice
MemoryHigh=infinity, MemoryMax=13G:
- the full suite was green: 5507 unit tests, 837 browser specs;
- heavy.slice peaked at 8216 MB; `oom_kill` stayed 0;
- the test server stayed up for the whole run.

## Fix
heavy.slice is installed with MemoryMax=13G, MemorySwapMax=0 and no MemoryHigh
(`scripts/systemd/install-slices.sh`, bob, 17 Oct 2026). The laptop suite is no longer the gate (T266:
GitHub Actions is), but a local full run is still possible and now has room.
