# BUG_20261115_phone-alignment-sheet-label-clipped

**Status:** OPEN (found reviewing the T793 baselines; not fixed there)

## Symptom
Phone Choose sealed alignment sheet cuts the label to "Alignmen".

At 390x844 the sheet's first row prints "Alignmen" because the select beside it takes the width. Checked in the app at 390x844 through the real Closed box > Choose alignment steps: it is the real layout, not an artefact. The wizard's alignment row (mobile-wizard-vented-step4) has room.

## Evidence
Baseline picture(s): mobile-dialog-sealed-alignment.

## Fix
Not done in T793. Test first when taken.
