# BUG_20261031_pr-pick-leaves-values-blank

**Status:** RESOLVED

## Symptom
In the New project wizard, passive radiator step, picking "E150HE-PR 5.5" Carbon Fiber Cone Passive
Radiator" fills the name but leaves Vas, Qms, Fs, Sd and Xmax blank, with a red "not a number" box.
The project made afterwards shows the radiator's values correctly on its PR page.

## Evidence
Bisect by Playwright script on the live sites, same steps (new project, any driver, box type passive
radiator, Select passive radiator, pick E150HE-PR), 31 Oct 2026:

| Build | Vas / Qms / Fs / Sd / Xmax after the pick |
|---|---|
| https://openisd.app (25 Oct production) | all blank |
| https://snapshots.openisd.app/snap/20261031T1411Z/ (before T622/T626) | all blank |
| https://test.openisd.app (1555Z) | all blank |

It is NOT a regression of T628 or T622: it was blank in production already. The wizard view held
the numbers (Vas 0.00481 m3, Fs 30, entered); the boxes did not show them.

The bundled record (`packages/ui/public/drivers/dayton-audio/e150he-pr.json`) states Vas, Qms, Fs, Sd
but no Xmax, so Xmax stays blank by data (the PR page shows its own 16 mm for it).

## Cause
`packages/ui/src/hooks/NumInput-hooks.ts`, the `refusal` computed: a blank box on a field that
refuses blanks (`blankRefused`, every UIFixedField) was refused whenever its text was empty, even
when the box simply had no value yet. The watcher that copies a new model value into the box skips
the copy while a refusal is showing ("a refused entry stays as typed"). The wizard's radiator step
starts with no value, so the box was refused from the start and never took the picked value.

## Fix
`NumInput-hooks.ts`: a blank is refused only when the person emptied the box (`emptied` flag, set by
a typed blank, cleared by typing, Esc and leaving the box). A box that never had a value is unset, not
refused, so a value that arrives later is shown.

## Verification
- `packages/ui/test/hooks/NumInput-hooks.test.ts`: "a box that starts with no value and refuses blanks shows the value that arrives later".
- `packages/ui/test/ui/new-project-wizard.browser.spec.ts`: "picking the bundled E150HE-PR fills every figure the step shows from its catalogue record, and the project shows the same" (expected numbers read from the record).

## Not done
An emptied box (person cleared it) still blocks a later pick from filling it. Same cause family; not
what John reported.
