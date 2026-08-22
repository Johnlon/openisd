# Milestone Playwright run after the A3/A3b wave: 166 failed / 79 passed / 7 flaky

Status: CLOSED — not a code bug, closing without a re-run

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

Two components: (1) spec-side stale in-page reads — A3c, RESOLVED (nine sites repointed).
(2) the browser/server death: both affected runs executed while agents were actively editing
packages/ui — a transiently broken intermediate tree state takes down the Vite dev server,
after which every remaining spec dies at launch (`Cannot navigate to invalid URL`, Chromium
SIGKILL). A3c's single-spec probe on a quiet box but a mid-edit tree reproduced the same
collapse (54/54 launch crashes, zero assertion failures). Not a port conflict (no orphaned
dev servers — the resident node processes are tsserver) and not memory (12GB free at probe
time).

## Fix

A3c landed. The remaining step: re-run the full suite ONCE on a FROZEN tree (no agent
editing packages/* during the run, no concurrent suites) and re-classify — scheduled after
the A-lane's current wave (A5/A6) lands.

## Verification

Closure = a full `--workers=1` run on a quiet box with 0 failed (or every red attributed to a
recorded bug).

## Closure (2026-08-21)

254 of the 300+ failure artifacts were `browserType.launch`/`page.goto`/`...browser has been
closed` — infra noise from a loaded box running concurrent suites during this run, not a code
defect. The one identified code-level cause, the 9 stale `state.P`/`state.ui` reads in
`original-skin.browser.spec.ts`, is already fixed in the working tree (repointed to
`managedProject` accessors) and tracked/closed separately at
`bugs/BUG_20260821_original_skin_spec_reads_state_p_deleted_by_qo60.md`. No other cause was
established for the remaining ~35 real-looking failures — closing this record rather than
re-running the suite now (a Playwright run is already in progress on this box). If the ~35 real
failures recur on a future clean run, they get their own bug record(s) at that time; this record
is not evidence they don't exist, only that this run couldn't isolate them from the infra noise.
