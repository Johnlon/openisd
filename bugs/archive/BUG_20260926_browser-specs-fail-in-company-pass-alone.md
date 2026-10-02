# BUG_20260926_browser-specs-fail-in-company-pass-alone

**Status:** RESOLVED 2026-09-26 — an uncoordinated run no longer takes a coordinated run's port.

## Symptom

Browser specs fail when run alongside other spec files and pass when run alone, with a
different set failing each time. The pre-push hook runs the whole browser suite, so this
blocks every push at random. Seven commits are stacked local because of it.

## Evidence

Three runs of the same working tree, 2026-09-26, nothing changed between them:

| Run | Scope | Result |
|---|---|---|
| pre-push hook | whole suite | 8 failed, 320 passed |
| targeted | 3 spec files, default workers | 3 failed, 66 passed |
| targeted | 2 spec files, `--workers=1` | 5 failed, 10 passed |
| targeted | `original-layout.browser.spec.ts:9` alone | passed, 8.8 s |

The sets overlap but do not match. `original-layout.browser.spec.ts:9` ("Tune is below the
right-edge legend") passed in the first two runs, failed in the third, and passes alone.
`original-skin.browser.spec.ts` contributed five failures to the hook's run and none to the
next. `--workers=1` made it worse, not better, so this is not workers competing for CPU.

## Cause

Two browser runs shared one vite and each shot the other's down. `scripts/test-concurrency.sh`
hands out ports 4100-4107 under a lock so coordinated gate runs never collide, but
`playwright.config.js` defaulted an UNCOORDINATED run — a bare `npx playwright test <file>`,
which is what `.claude/rules/test-diagnosis.md` tells every agent to run — to 4100, the first
port in that pool. Its `webServer.command` opens with `kill-http.sh <PORT>`, so starting a
targeted run killed the server a full gate was using, and that gate then failed on whatever it
happened to be doing. Hence a different set each time, and green when nothing else ran.

## Fix

Done 2026-09-26, `playwright.config.js`: an uncoordinated run takes a free port from 4200-4399,
found by reading the kernel's own listening-port tables, and never touches the coordinated pool.
The chosen port is written back into `process.env.OPENISD_TEST_PORT` because the runner
re-imports this config in every worker it forks — without that, the second call skipped the port
the server had just taken and handed the workers a port nothing was serving.

Measured on the two worst files, same tree: 5 failed / 10 passed in 2.7 min before, 1 failed /
14 passed in 25 s after. The one remaining failure is a real defect, recorded separately in
`BUG_20260926_drag-select-draws-one-level-line-not-two.md`.

## Verification

Run the whole browser suite three times with no changes between runs: the same set passes each
time. Then run any single spec file alone and in company and get the same result both ways.
