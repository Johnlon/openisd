# Tune panel test asserts C/E marks against a page with no driver loaded

## Status
OPEN — test-fixture defect, not an app defect. Owner: the `packages/ui` test suite.

## Symptom

Two tests in `packages/ui/test/logic/whatif-panel-fields.browser.spec.ts` fail, run at
`--workers=1`:

    QO11.1 Tune: Mms and Bl are editable and override the calculation
      whatif-panel-fields.browser.spec.ts:55
      expect((await cell(page, 'Mms')).state).toBe('C')
      Expected: "C"   Received: "N"

    QO11.3 Tune: a blank Q autocalculates from the other two
      whatif-panel-fields.browser.spec.ts:106
      expect(qms).toHaveClass(/st-e/)
      Received string: "st-n de-input-mandatory de-input-empty"

## Cause

The app is behaving correctly and the fixture is wrong.

`openTune()` (`whatif-panel-fields.browser.spec.ts:31-43`) does `page.goto('/')`,
`localStorage.clear()`, `page.goto('/')`, then clicks the "Driver" nav tab and the "Tune" button.
The nav click is a pure `activeTab = 'driver'` UI tab switch (`OriginalShell.vue:930`) and loads
nothing. `App.vue:30-42`'s `onMounted` restores only from a URL hash or `localStorage`; with both
absent the project boots at `_prototypeProject()` with `driver: undefined`.

Grepping the whole spec for `loadDriver`, `setDriverFromWdr`, `driverRecord`,
`fromConformingRecord` and `selectDriver` returns nothing: no test in the file ever loads a driver.

With no driver chosen, `ManagedOpenISDProject.cell()` returns `{ value: null, state: 'N' }` for
every field and `hasDriver()` is false (`managedProject.ts:158`). `Mms` and `Qms` therefore read
`N` because no T/S set exists to derive or enter against — the marks are right and the assertions
are asking about a driver that was never loaded.

The four passing tests in the same file corroborate this: `QO11.2`/`QO11.5` check layout and
`NumInput` validation, `QO11.4` exercises `Vb`, which is box state. Only the two tests that need a
driver's T/S set fail.

## Fix

`openTune()`, or `QO11.1`/`QO11.3` individually, must load a real driver record before opening
Tune — via `page.evaluate` reaching the app state module, the same technique the file's own
`cell()` helper already uses.

The record must be a real sample carrying a known-good T/S set: an entered Qts/Qes/Qms triangle
and enough of the rest for `Mms` to solve to `C`. A fabricated record guessed to satisfy the
assertion would make the test pass without exercising the marking logic it exists to check.
Choosing which fixture record to use is the substance of this fix.

## Verification

`whatif-panel-fields.browser.spec.ts` QO11.1 and QO11.3 pass at `--workers=1`, with `Mms` marked
`C` and `Qms` carrying `st-e`.
