# `original-skin.browser.spec.ts` bandpass4 Frc/Ffc readout test fails on a fresh default project — pre-existing, not caused by the frcHz fix

Status: OPEN — found incidentally while verifying BUG_20260823's frcHz persistence fix; confirmed
NOT caused by that fix (bisected below). Not investigated further — out of scope for that task.

## Symptom

`packages/ui/test/ui/original-skin.browser.spec.ts` → `'the bandpass Box tab shows calculated
Frc + Tuning-freq readouts (real values)'` (line 174) fails:

    Locator: .field { Frc } input.calculated
    Expected pattern: /^\d+\.\d{2}$/
    Received: "—"

## Evidence

- Reproduced standalone, `--workers=1` (rules out concurrent-worker false-failures):
  `npx playwright test packages/ui/test/ui/original-skin.browser.spec.ts -g "shows calculated Frc" --workers=1`
  — fails identically on two separate runs.
- Bisected: `git stash push -- <every file this session touched>` back to plain `dev` HEAD
  (`0db966a`), re-ran the same spec — still fails identically with none of this session's
  changes present. Not a regression from the frcHz work.
- Root cause probe (`page.evaluate` reading `managedProject.projectCell('Vb').value` and
  `managedProject.errors()` right after selecting `bandpass4` on a freshly-cleared-localStorage
  load):

      {"Vb":0,"errors":[
        {"field":"Fs","message":"Resonant frequency (Fs) is required..."},
        {"field":"Re","message":"DC resistance (Re) is required..."},
        {"field":"Sd","message":"Piston area (Sd) is required..."},
        {"field":"Vas","message":"Acoustic compliance volume (Vas) is required..."},
        {"field":"Qts","message":"At least two Q parameters..."}
      ]}

## Cause

The app's default/fresh project carries an EMPTY driver (no Fs/Re/Sd/Vas/Qts) and an unset
rear-chamber volume (`Vb=0` — `prototypeBox()`'s bandpass4 volumes are `0` until a box wizard
sets them, per `bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md`).
`OriginalShell.vue`'s `sealedRes` computed (`managedProject.sealedResonance(...)`) correctly
returns `null` with no real driver and no real volume, so the Frc/Ffc readouts correctly show
"—". The test asserts a real numeric readout appears on a bare fresh load, which requires a
real driver and a real Vb/Vf that nothing in the fresh-load path currently supplies. The test's
assumption predates whatever change stopped seeding a default driver/volume on fresh load (or
never held once the box-wizard-less "unset until chosen" model landed) and was not updated.

## Fix

Not fixed — out of scope for the frcHz persistence task this was found during. Needs either:
(a) the test to select a real driver and set a real Vb/Vf before asserting the readout, or
(b) confirmation that a fresh default project is SUPPOSED to ship with a real driver preloaded
(in which case the real bug is that it currently doesn't).

## Verification

- `npx playwright test packages/ui/test/ui/original-skin.browser.spec.ts -g "shows calculated Frc" --workers=1`
  fails both on `dev` HEAD (`0db966a`) unmodified and with BUG_20260823's frcHz fix applied —
  confirming the fix is not the cause.
