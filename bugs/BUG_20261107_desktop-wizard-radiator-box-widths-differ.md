# BUG_20261107_desktop-wizard-radiator-box-widths-differ

**Status:** RESOLVED

## Symptom
On the desktop New Project wizard's passive radiator step, the Cms and Rms boxes are 26 px wider than the other number boxes, so their up and down arrows and the Cms difference cue sit out of line.

## Evidence
- Live test site, build v20261107T0432Z, 1440x900: Vas, Qms, Fs, Sd, Mms, Xmax 124 px; Cms, Rms 150 px.
- Breaks rule 4 of `.claude/rules/field-layout.md`.

## Cause
T703 added Cms and Rms, whose wider unit cap widens the box. The project page sets one width for its group; the wizard step did not. The field layout gate did not walk this step, and the agy picture check was not asked about widths.

## Fix
- The desktop step sets one 150 px box width, as the project page does.
- The field layout gate walks the radiator step on both skins. Its free-text name box is outside the rules, which cover number boxes, counts and dropdowns.
