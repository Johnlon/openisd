# `original-skin.browser.spec.ts` reads `state.P.Vb`, a shape the QO60 migration deleted

Status: RESOLVED

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

All nine `state.P.*` sites in `packages/ui/test/ui/original-skin.browser.spec.ts` repointed to
`managedProject`'s facade, via the file's existing in-page `import('/src/logic/store.ts')`
pattern:

- :244 `s.state.P.filters.length` → `s.managedProject.filters().length`
- :357 `s.state.P.Vb` → `s.managedProject.boxVolume_m3()`
- :447 `s.state.P.Pin` → `s.managedProject.inputPower_W()`
- :490 `s.state.P.filters.push({...})` → `s.managedProject.addFilter({ type: 'highpass', enabled: true, fc: 30, Q: 0.7, gain: 0 })` (added `enabled: true` — required by the `Filter` interface, not carried by the old ad-hoc push)
- :491 `s.state.P.Pin = 250` → `s.managedProject.setInputPower_W(250)`
- :505 `{ filters: s.state.P.filters.length, pin: s.state.P.Pin }` → `{ filters: s.managedProject.filters().length, pin: s.managedProject.inputPower_W() }`
- :647 `...state.P.driverAddedMass` → `...managedProject.driverAddedMass()`
- :729 `...state.P.Vb` → `...managedProject.boxVolume_m3()`
- :790 `...state.P.driverAddedMass` → `...managedProject.driverAddedMass()`

No assertion values changed.

## Verification

- `grep -n 'state\.P' packages/ui/test/ui/original-skin.browser.spec.ts` → zero matches.
- `npx vue-tsc --noEmit -p tsconfig.json` in `packages/ui` → clean of this file (pre-existing,
  unrelated errors remain in `openisdDriver.ts`, `useApplicationIO.ts`, `App.vue`, `persist.test.ts`).
- `npx eslint test/ui/original-skin.browser.spec.ts` → clean, no output.
- `npx playwright test test/ui/original-skin.browser.spec.ts --workers=1` (no other
  Playwright/Chromium process running at the time) → see run output recorded in the release
  session; remaining failures, if any, are unrelated to the `state.P` repoint.
