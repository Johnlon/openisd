# BUG_20261016_new-project-wizard-steps-inconsistent

**Status:** OPEN

## Symptom
John, 16 Oct 2026, New project wizard, steps 3–5, every box type:
- Sealed: volume is on step 4; that page has narrow input boxes and no step arrows.
- Vented: step 4 fills the volume from an alignment; the user cannot type a volume, and there are no step arrows.
- Passive radiator: volume on step 3, radiator on step 4; different number boxes from the other steps; no step arrows.
- 4th/6th order bandpass and ABC: volumes on step 3; narrow boxes, no step arrows; each chamber's volume and tuning are far apart instead of side by side; flat, poor layout.

## Cause
There are two wizards, one per skin (OriginalNewProject.vue and MobileNewProject.vue, plus NewProjectPassiveRadiatorStep.vue). Each skin hand-builds every step for every box type in its template. Neither uses the shared field row (UIField): 17 hand-built NumInput boxes, no stepper, and widths chosen per site. Nothing in packages/design says which steps a box type has or which fields each step holds. Box types were added one at a time by different tasks, so each one grew its own layout. No test checks the steps for layout or for the field component.

## Fix
- packages/design gets one wizard plan: for each box type, its steps and, per step, field groups (e.g. "Rear chamber: volume, tuning"; "Front chamber: volume, tuning"), exhaustive per box type.
- Both skins render that plan with UIField rows only, step arrows on, the same widths as the Box tab.
- Each chamber's volume and tuning sit together in one group.
- An alignment pick fills the volume (and tuning) but the field stays editable; typing a value is always allowed.
- Volume sits on the same step for every box type (the alignment/volume step).
- Architecture test: no NumInput outside UIFieldBody (covers the wizard). Browser spec per box type × skin: every number field on every step has arrows, no row overflows at 360 px.
