# Tune panel marks Mms `N` and Qms `N` where the model should mark them `C` and `E`

# Status
OPEN

## Symptom

With a driver loaded and the Tune panel open, cells that carry a value are marked **Not in
play** instead of Calculated / Entered:

- `Mms`, derived from the T/S set, reports state `N`; expected `C`.
- `Qms`, one of three entered Q values, reports state `N` and renders
  `st-n de-input-mandatory de-input-empty`; expected `st-e`.

## Evidence

`packages/ui/test/logic/whatif-panel-fields.browser.spec.ts`, run with `--workers=1`:

    QO11.1 Tune: Mms and Bl are editable and override the calculation
      whatif-panel-fields.browser.spec.ts:55
      expect((await cell(page, 'Mms')).state).toBe('C')
      Expected: "C"   Received: "N"

    QO11.3 Tune: a blank Q autocalculates from the other two
      whatif-panel-fields.browser.spec.ts:106
      expect(qms).toHaveClass(/st-e/)
      Received string: "st-n de-input-mandatory de-input-empty"

The other 4 tests in the file pass, so the panel itself renders and its plumbing works — the
marks are wrong, not the component.

## Cause

**Established 2026-08-19, re-investigated from scratch rather than trusting the "not
established" note above.** This is not a marking-logic defect in the app at all — the test's
own `openTune()` helper (`whatif-panel-fields.browser.spec.ts:29-38`) never loads a driver. It
does `page.goto('/')`, `localStorage.clear()`, `page.goto('/')` again, then clicks the "Driver"
nav tab — which is a pure `activeTab = 'driver'` UI tab switch
(`OriginalShell.vue:930`), nothing more. `App.vue:30-42`'s `onMounted` only restores from a URL
hash or `localStorage`; with both cleared/absent, the project boots at
`_prototypeProject()` — `driver: undefined`. With no driver chosen,
`ManagedOpenISDProject.cell()` (`managedProject.ts`) unconditionally returns
`{ value: null, state: 'N' }` for every field, `hasDriver()` false. So `Mms`/`Qms`/`Bl` read
`N` not because their C/E marking is wrong, but because there is nothing to mark — no T/S set
exists to derive or enter against.

**Confirms this is a test gap, not an app defect:** the 4 PASSING tests in the same file never
depend on driver state — `QO11.2`/`QO11.5` check layout/`NumInput` validation only, `QO11.4`
exercises `Vb` (box state, independent of any driver). Only `QO11.1`/`QO11.3` — the two that
fail — assert values that require a driver's T/S set to exist. `openTune()` was written
assuming a driver would already be present (its own comment: "Untouched, Mms is derived from
the T/S set → Calculated") but nothing in the file ever loads one.

The stale three-file working-tree-diff note above no longer describes the current tree (this
session's `git status` shows none of those three files dirty) — it was accurate for whichever
session filed this, not now.

## Why it was invisible

Both tests were failing earlier in `beforeEach` on the deleted `.skin-picker`, and then on
the Tune panel throwing `fieldRegistry: no field "BL"`. With both fixed, the assertions run
for the first time and these are what they report.

## Fix

Not applied — this is a test-fixture gap, needing a real driver record with a known-good T/S
set (an entered Qts/Qes/Qms triangle, and enough of the rest for Mms to solve to `C`), not a
fabricated one guessed to make the assertion pass. `openTune()` (or `QO11.1`/`QO11.3`
themselves) needs to load an actual sample driver — via `page.evaluate` calling
`managedProject.loadDriverRecord(record)`/`setDriverFromWdr(text)` from `store.ts`, the same
technique the test file's own `cell()` helper already uses to reach the store — before opening
Tune. Picking which existing fixture record to use, or constructing one, needs care this report
does not attempt to guess.

## Verification

`whatif-panel-fields.browser.spec.ts` QO11.1 and QO11.3 pass.

Re-run 2026-08-19: still red, same two tests, same shape (`Mms` state `N` not `C`; `Qms` class
`value-n de-input-mandatory de-input-empty` not `value-e`) — confirms the symptom is
reproducible and unchanged, and the new Cause section above is the actual explanation.
