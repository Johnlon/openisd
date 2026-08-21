# fLe's registry limit is written in kHz but enforced in Hz, so any real fLe is rejected

# Status
FIXED

## Symptom

Typing a realistic fLe into the driver editor clears the field instead of accepting it. A
`.wdr`'s fLe is a few hundred Hz to tens of kHz; anything above 100 Hz is refused.

## Evidence

`driver-editor-provenance-and-units.browser.spec.ts` fills 100 into fLe (displayed in kHz) and
reads it back after a unit rotation:

    Error: fLe 100 kHz → Hz: shown , expected 100000 at 0 dp

The field is empty — the entry never reached the model.

## Cause

`packages/ui/src/logic/fields/fieldRegistry.ts:397`

    { id: 'fLe', … unit: 'kHz', … min: 0, max: 100, … description: '… STORED IN HERTZ …' }

`NumInput` enforces the registry bounds in **SI/model space**, not display space
(`packages/ui/src/ui/components/NumInput.vue`, `valid(si)` — "bounds are SI-space … validation
therefore always tests the SI value"). fLe is stored in hertz, so `max: 100` means 100 Hz while
the row's own `unit: 'kHz'` and description say the number was meant as 100 kHz.

Every other row in the registry follows the SI convention correctly — `Dd` is `unit: 'mm'` with
`max: 2` (2 m), `dimThick` `unit: 'mm'` with `max: 0.3` (0.3 m), `dimDvol` `unit: 'cm³'` with
`max: 1` (1 m³). fLe is the one row whose bound was written in its display unit.

The bound was inert until the editor's fLe input was bound to the registry: with no `field`
prop, `NumInput` falls back to min 0 / no ceiling, so nothing enforced it.

## Fix

`max: 100` → `max: 100000` (100 kHz expressed in the stored unit, hertz).

## Verification

The `every convertible field opens in its own default unit and carries a working toggle` test
fills 100 kHz into fLe, rotates kHz → Hz, and asserts 100000 is shown.
