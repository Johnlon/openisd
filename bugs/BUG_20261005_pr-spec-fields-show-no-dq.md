# BUG_20261005_pr-spec-fields-show-no-dq

**Status:** OPEN

## Symptom
The passive radiator's own fields (Vas, Qms, Fpr, Sd) never show a data-quality flag or reason, in either
shell. When the radiator's figures contradict each other, the user has no way to see it on those boxes.
Only Target tuning (Fp) and Added mass show DQ.

## Evidence
Checked 2026-10-05:
- The model carries DQ marks on these fields. `openIsdPassiveRadiatorSpec.ts:41-47` passes `marks(...)` (the
  `checkSpec` conflicts) into `prSpec` for Fs, Qms, Cms, Mms, Rms, Sd and Vas.
- The UI only builds DQ for two PR cells: `packages/ui/src/hooks/boxFields.ts:48-49` (`prAddedMassDq`, `prTuningDq`).
- `OriginalShell.vue` (og-pr-vas/qms/fs, Sd) and `MobileEnclosureTab.vue` PR spec `NumInput`s have no
  `v-bind="...Dq"`.

## Cause
No DQ readout is built for the radiator spec fields in `boxFields.ts`, and none is bound in the two shells.

## Fix
In `boxFields.ts`, build `dqOfCell` readouts for the radiator spec fields, the same way as `prTuningDq`.
Bind them on the Vas/Qms/Fpr/Sd `NumInput`s in both shells.

## Verification
Browser spec: load a radiator whose stated Fs/Qms/Vas/Sd contradict each other. The conflicting boxes must
carry a `dq-` class and a title that gives the reason. A consistent radiator must show no `dq-` class.
