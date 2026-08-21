# Milestone Playwright run after the A3/A3b wave: 166 failed / 79 passed / 7 flaky

Status: OPEN

## Symptom

Full suite, `--workers=1`, 37.2 min, 2026-08-21 (~11:30–12:10): `test-results/.last-run.json`
status `failed`, 166 failed tests across 340 artifacts. (The launching pipeline's `tail` exit
masked the failure; the JSON report is the authority.)

## Evidence

Error-line classification over every `error-context.md`:

- 145 × `browserType.launch: Target page, context or browser has been closed`
- 109 × `page.goto: Target page, context or browser has been closed`
- 10 × `locator.click: ...browser has been closed`, 8 × `browserContext.newPage: ...closed`
- ~35 real test-level failures: 11 × toHaveCount, 5 × toBeHidden, 4 ×
  `page.evaluate: TypeError: Cannot read properties of undefined (reading 'state')`,
  4 × toBe, 4 × toHaveValue, 4 × toBeVisible, misc.

The dominant class is an infrastructure collapse: from some point in the run the browser/dev
server was gone and every subsequent spec failed at launch/goto — the QO10 failure shape
(false failures manufactured by a dead server), though this run used one worker on a heavily
loaded box (concurrent pytest suites + pyright from parallel agents).

The `TypeError (reading 'state')` class is spec-side: in-page `page.evaluate` reads of the
pre-A3 state shape (`state.P.*`, `state.ui`), already recorded as
`BUG_20260821_original_skin_spec_reads_state_p_deleted_by_qo60.md` (9 sites) — task A3c.

## Cause

Not fully established. Two components: (1) spec-side stale in-page reads (A3c, recorded);
(2) the browser/server death mid-run — cause unknown (box overload vs an app-triggered
crash), needs a re-run on a quiet box to separate real failures from cascade.

## Fix

Not yet applied. Sequence: land A3c (spec repoints), fix the surviving real assertion
failures, then re-run the full suite ONCE on a quiet box (no concurrent suites) and
re-classify.

## Verification

Closure = a full `--workers=1` run on a quiet box with 0 failed (or every red attributed to a
recorded bug).
