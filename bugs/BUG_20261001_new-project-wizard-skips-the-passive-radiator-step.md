# BUG_20261001_new-project-wizard-skips-the-passive-radiator-step

**Status:** FIXED 2026-10-01

## Symptom
Choosing "Passive Radiator" in the New Project wizard goes straight from box type to project
info. The project is created with a default radiator the user never chose (John, 2026-10-01:
"our wizard forgets to include the PR picker editor step").

## WinISD
The wizard has its own step for the passive radiator after the box type: its parameters
Vas / Qms / Fs / Sd / Xmax
([new_project_wizard_4_pr_params.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_pr_params.png)).

## Cause
[OriginalNewProject-hooks.ts](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OriginalNewProject-hooks.ts#L153-L157):
`hasAlignmentStep` is sealed or vented only, so every other type skips step 4;
`createProject` builds `b.passiveRadiator().volume_m3(...)` with no `.radiator(...)`.
Tracked as item 7 of
[FIX_WIZARD_VENTED-remains.md](http://localhost:8000/winisd/openisd/docs/plans/FIX_WIZARD_VENTED-remains.md?html).

## Fix
A passive-radiator step: pick from the PR picker (saved, bundled, define new) and edit
Vas/Qms/Fs/Sd/Xmax, and build the project with that radiator.

## Fixed
Step 4 for a passive-radiator box is the radiator: Select PR opens the PR picker (saved, bundled,
define new), the step shows Vas / Qms / Fs / Sd / Xmax, and Next waits until a radiator is
chosen. The project is built with it. Both skins show the same step component,
[NewProjectPassiveRadiatorStep.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/NewProjectPassiveRadiatorStep.vue).
Tests: `OriginalNewProject-hooks.test.ts` (passive-radiator step), `wizard-defaults.browser.spec.ts`,
`mobile-box-type-switch-defaults.browser.spec.ts`.
