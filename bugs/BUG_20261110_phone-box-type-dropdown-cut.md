# BUG_20261110_phone-box-type-dropdown-cut

**Status:** RESOLVED

## Symptom
On the phone Box tab (374 x 705) the "Box type" dropdown cut its chosen name: "Passive Radiat..." on a passive-radiator project, and "4th/6th Order Bandpass" cut too. Before T742 it was 260 px wide and showed whole.

## Evidence
ui-gallery/QO526-phone-widths/box-pr-after.png and check.md (John, 10 Nov 2026, QO526).

## Cause
T742 made the dropdown end where the number boxes below it end (field-layout rule 4). On pages whose labels are long the number boxes are only 146 px (108 px on bandpass), too narrow for the name. The layout gate hid it: its text measure read the font shorthand, which is empty, so it measured at the default font.

## Fix
The phone Box type dropdown sizes to its chosen text (field-sizing: content), never narrower than where the number boxes end and never wider than the row. Sealed and vented are unchanged. The gate's measure now reads the font from its parts, and counts the gutter and arrow.

## Verification
phone-box-type-text-fits.browser.spec.ts (all six box types, red before, green after); field-layout-rules.browser.spec.ts stays green.
