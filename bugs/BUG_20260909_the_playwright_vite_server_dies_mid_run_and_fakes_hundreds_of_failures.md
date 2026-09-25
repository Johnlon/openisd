# The Playwright vite server dies mid-run and fakes hundreds of failures

Status: PARTIAL — the server guard and worker throttling are fixed, but mid-run resource
pressure and cross-process coordination remain unresolved.

## Symptom

A full `npx playwright test --workers=1` reported:

```
210 failed
53 passed (1.3h)
```

Of the 420 result directories that run left behind, **314 carry the same error**, and it is not
a test failure:

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4100/
Call log:
  - navigating to "http://localhost:4100/", waiting until "load"
```

```
$ for d in test-results/*/; do ... done
dirs with error-context: 420
connection-refused:     314
```

Port 4100 is Playwright's own vite server (`playwright.config.js:49-54`). It was not running
when the run ended, and no vite process survives.

## Impact

**Every full-suite count from a run that hit this is meaningless.** Once the server dies, every
remaining test fails identically regardless of its own correctness, so the totals measure how
far the run got before the server went down, not how much of the app works.

This has already produced wrong reporting in-session: a run was described as improving from
"161 failed" to "3 failed" and "33 failed" on the basis of partial mid-run counts, then landed
at "210 failed" — a number that reflects the dead server, not a regression in the code. Any
comparison of two full-suite totals is unsound unless both runs are confirmed server-clean.

It also makes the health check unable to answer its one question. `AGENTS.md` requires
`bash scripts/health-check.sh` green, and the browser half currently cannot produce a
trustworthy figure at all.

## Cause

NOT established. What is known:

- The run lasts ~1.3 hours of continuous vite serving with `--workers=1`.
- Machine memory at the time: 15 GB total, ~8 GB used, ~2 GB free.
- `reuseExistingServer: true`, so Playwright does not restart a server that dies underneath it;
  it keeps navigating to a dead port for the remainder of the run.

Memory exhaustion during a long run is the leading candidate and matches the timing, but no
OOM record has been read and no controlled repro has been done, so it is NOT confirmed.

## Fix

Two parts, and the first is needed before any browser-suite number can be believed again:

1. **Make a dead server fail loudly, not silently.** A run where the base URL stops answering
   should abort, not convert every remaining test into a fake failure. Otherwise the suite
   reports a number that looks like a code result and is not one.
2. **Establish why vite dies**, then address that — memory, a leak in the long run, or the
   server being killed by something else on the machine.

Interim: read `connection-refused` counts alongside any full-suite total, and treat a run with
a non-zero count as void rather than as a result.

Part 1 is DONE; part 2 (why vite dies) is still OPEN.

### Part 1 — a dead server can no longer look like test failures

`packages/ui/test/fixtures.ts` raises a distinct error, before the diagnostics categories, the
moment any request is refused:

```
DEV SERVER UNREACHABLE — this is NOT a test failure.
The vite server on 4100 has died, so every test after this point fails the same way
regardless of the code. TREAT THIS RUN AS VOID and restart the suite — do not read its
pass/fail totals as a result.
```

`playwright.config.js` also sets `maxFailures: 180`, above the suite's worst honest run (161),
so a collapsed run aborts in minutes instead of spending an hour manufacturing a total. It is
deliberately set high enough never to truncate a genuine red.

### Part 2 — why vite dies: STILL NOT ESTABLISHED

Memory remains the leading candidate and is consistent with `playwright.config.js`'s own
recorded history of `chrome-headless-shell` being SIGKILLed on this machine under WSL2, where
`dmesg` is restricted and the Windows-side memory budget is not what `free` measures. No OOM
record has been read and no controlled repro has been done, so this is NOT confirmed.

## Verification

```
$ tail -3 <run output>
  210 failed
  53 passed (1.3h)
$ grep -l ERR_CONNECTION_REFUSED test-results/*/error-context.md | wc -l
314
```

Made to fail on purpose: killed vite 8 seconds into a running spec and watched the guard fire
with the message above, then confirmed a healthy run is unaffected.

```
npx playwright test packages/ui/test/ui/empty-state-open-file.browser.spec.ts --workers=1
  1 passed
npx eslint packages/ui/test/fixtures.ts    clean
npx vue-tsc -p packages/ui --noEmit        0 errors
```
