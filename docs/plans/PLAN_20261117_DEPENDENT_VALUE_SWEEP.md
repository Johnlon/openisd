# Plan: every dependent box follows its inputs (test sweep)

Status: APPROVED, option A (John, 17 Nov 2026 12:34 UTC, "yes" on board card topic-1117-084319). Slice 1 is task T863.
Asked by John, 17 Nov 2026 08:50 UTC: "add more aggressive testing for this style of bug across the app but do it after this fix".

## The bug class
The vented box's Vent length box stopped following Fb. Fb was lowered until the calculated vent length went past the box's limit (7646 cm), and the box then treated that calculated value as a refused typed entry. Raising Fb again did not move it until the box was cleared. The fix (pull request 174) means a calculated value always follows. Any number box could have latched like this.

## What the sweep checks
For every number input a user can type into, on desktop and phone, one journey runs these steps:
1. Change the input to a normal new value.
2. Change it to an absurdly high value (10 x its limit max).
3. Change it to an absurdly low value (0 or negative, by its floor).
4. Return it to the original value.

After every step it reads every box on the screen (`[data-field]`, one `evaluate` call) and checks:
- each calculated box shows the engine's value for the current inputs (no stale number);
- no calculated box is left in the refused-entry state (`inp-bad`) after step 4;
- after step 4 every box equals its value before step 1;
- the chart is redrawn (picture hash differs after step 1 and equals the start after step 4).

No dependency map is written by hand. The sweep compares each box on screen against the engine's answer, so a box that fails to follow is caught without a list of what depends on what.

## Built from data, not per-case code
- Inputs and limits: `NumberField.ALL` in `packages/design/fields/field.ts` (137 fields; `limits`, `floor`, `allowedEmpty`).
- Screens and how to reach them: the surface manifests (`test/fixtures/{mobile,desktop}SurfaceManifest.ts`).
- Typing: `typeInto` / `fillAndCommit` (`test/fixtures/numField.ts`), only as a user types (no backdoor).
- Model: the closest specs today are `mobile-vented-tab`, `original-bandpass-vents`, `original-signal-tab` and `ui-field-refusal`.

## Size
About 95 to 100 distinct inputs: Box and vent about 20 (repeated across 6 box types), Driver and Driver Editor about 30, Filters about 20, What-if 9, radiator 8, Signal 6, Advanced 3.
- One test per input, per box type, per viewport, with the four steps inside: about 200 to 350 tests.
- Run time: long (Playwright is capped at 2 workers). Run it as its own CI job, split into shards, and not in every pull request's gate until it is proven stable.

## Slices
1. Box and vent inputs, all 6 box types, both viewports. This covers the area where the bug was found. Any app bugs it finds get a bug file and a fix.
2. Signal, Advanced, radiator.
3. Driver tab and Driver Editor, then What-if (desktop).
4. Filters.
Each slice is one pull request. A box the sweep finds latched is an app bug, fixed at its source; the test is never weakened to pass.

## Cost and alternatives
- (A) Full sweep as above. Lead estimate: 1 to 2 days of agent work, plus a long CI job.
- (B) Slice 1 only (Box and vent). About half a day. It covers the bug's own area and leaves the rest of the app unchecked.
- (C) A unit-level sweep of the number-box component alone: about 2 hours and fast to run. It catches this exact latch but not a screen wiring a box wrongly.
Lead's recommendation: (A), slice 1 first.
