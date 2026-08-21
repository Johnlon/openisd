# `original-skin.browser.spec.ts` reads `state.P.Vb`, a shape the QO60 migration deleted

Status: OPEN

## Symptom

`packages/ui/test/ui/original-skin.browser.spec.ts` evaluates `state.P.*` in-page at NINE
sites (measured 2026-08-21): lines 244 (`filters.length`), 357 (`Vb`), 447 (`Pin`), 490-491
(`filters.push` + `Pin` writes), 505 (`filters.length` + `Pin`), 647 (`driverAddedMass`), 729
(`Vb`), 790 (`driverAddedMass`). `AppState` carries no `P` (deleted 2026-08-21, task A3, per
John's 2026-08-20 ruling), so the reads yield `undefined`/TypeError when those specs run.

## Evidence

The two spec lines (grep `state.P` in the file); `AppState` in `packages/ui/src/types.ts`
declares only `box` and `project`. Found during A3b's review; not covered by the ui vitest
project, so no unit run shows it.

## Cause

The browser specs were not in A3's repoint sweep (the sweep covered src + the ui vitest
project's tests).

## Fix

Not yet applied. Repoint the in-page reads to the domain facade (`managedProject`'s
accessors — box volume, input power, added mass — and the filter mutators/readers landed with
A3) or to the serialized snapshot the spec actually needs. The write sites (490-491) become
`managedProject.addFilter(...)`/`setInputPower_W(...)`.

## Verification

Closure = the spec's reads repointed, the full Playwright suite (single worker) green on that
file.
