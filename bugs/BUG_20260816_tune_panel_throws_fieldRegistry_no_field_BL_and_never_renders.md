# The Tune panel throws `fieldRegistry: no field "BL"` and never renders

## Symptom

Clicking **Tune** on the Driver tab renders nothing. The page throws:

    fieldRegistry: no field "BL" — add it to fieldRegistry.ts

`.tune-panel` never appears, so the docked what-if editor is unusable.

## Evidence

- `packages/ui/src/logic/fields/fieldRegistry.ts:376` declares the field with id **`Bl`**:

      { id: 'Bl', label: 'BL', pane: 'Driver: Parameters', kind: 'number', unit: 'Tm', precision: 3, ... }

- `packages/ui/src/ui/shells/original/OgTune.vue:45` builds its row with key **`BL`**:

      { key: 'BL',  label: 'Bl',  scale: 1,    unit: 'T·m' },

  and `disp()` (`:57`) calls `fieldDp(key)`, `scaledLimits()` (`:76`) calls `limits(key)`.
  Both are registry lookups, and both throw on `'BL'`.

- Present at HEAD, not introduced by the working tree:

      git show HEAD:packages/ui/src/logic/fields/fieldRegistry.ts | grep "id: 'BL'\|id: 'Bl'"
      376:    id: 'Bl', ...

  and the working-tree diff of `fieldRegistry.ts` touches no `Bl`/`BL` line.

- Reproduced by `packages/ui/test/logic/whatif-panel-fields.browser.spec.ts` — 4 tests
  (`QO11.1`–`QO11.4`) fail on the auto diagnostics fixture with this uncaught page error,
  then on `expect(page.locator('.tune-panel')).toBeVisible()`.

## Cause

Two spellings for one quantity across a module boundary. The driver record's field is `BL`
(`OpenISDDriver`); the field registry's id for the same quantity is `Bl`. `OgTune` indexes
the record with `BL` and hands that same string to the registry, which does not have it and
throws by design rather than silently defaulting.

## Why it was invisible

The four tests that cover the Tune panel never reached their assertions: every browser spec
was failing earlier, in `beforeEach`, waiting on a `.skin-picker` that had been deleted (see
`BUG_20260816_browser_suite_red_14_specs_wait_for_a_skin_picker_that_no_longer_exists.md`).
Fixing that exposed this.

## Fix

Make the two names one. Either the registry id becomes `BL` to match the record, or `OgTune`
translates at the single point where it crosses into the registry. The first is preferable —
one name for one quantity — but it requires checking every consumer of the id string `'Bl'`,
including `dependsOn: ['Bl', 'Mms']` on the `gamma` entry.

## Verification

`whatif-panel-fields.browser.spec.ts` QO11.1–QO11.4 pass, and no uncaught page error is
reported by the diagnostics fixture.
