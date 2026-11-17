# BUG_20261115_calculated-value-with-uncertainty-as-large-as-itself-is-shown

**Status:** OPEN (not scheduled; a broad change, written up for the lead)

## Symptom
A calculated field whose propagated half-width is as large as the value, or larger, is shown as a value. Purifi's MagDepth was
`{"state": "C", "value": 3.9836, "precision": 3.9295}` (T821 stops that one by refusing the geometry; the rule below would also
have stopped it).

## Steps to reproduce
1. Count, over `winisd_drivers/snapshot/datasheets/*/*/openisd.json`, every `{"state": "C"}` entry with a `precision`, and
   compare precision with |value|.
2. Observed (21,860 calculated entries with a precision, 2001 records): precision >= 0.25 x value in 441 entries (200 records),
   >= 0.5 x value in 154 (75 records), >= 1 x value in 43 (22 records).
   By field at >= 0.5: Mcost 32, Hc 26, Hg 16, Vd 24, Gloss 24, no 10, Rme 5, gamma 5, Cms 4, Rms 4, Mpow 1, EBP 1 (Hc and Hg are
   the calculated overhangs; Mcost values reach precision 1.9e6 for value 1.9). Examples at >= 1: wavecor/fr055om01 Hc 0.004 +-
   3.9995 and Mcost 1.91 +- 1.9e6; tang-band/w2-1625sa Hc 0.008 +- 7.9995.
3. Expected: a value that its own uncertainty swamps is not presented as a value.

## Cause
`DriverEngine.calculatedWidths` propagates the half-width first-order and `writeDriverBack` stores value and width side by side
with no test that the width is small against the value. The same holds for the other engines (vent, passive radiator, box).

## Fix (proposed, not done)
One rule at the single write-back point per engine (`writeDriverBack` and its siblings): a derived value whose half-width is >= a
set fraction of |value| is written not-available with a reason ("cannot be calculated from the stated precision"). The fraction is
a decision (0.5 would remove 154 values in 75 records, 1.0 would remove 43 in 22). It changes the snapshot and any golden that
carries those fields, and Hc/Hg/Mcost/Gloss feed charts, so it needs its own review of which of them a chart reads.

## Verification
Re-scan the snapshot: no `C` entry with precision >= the chosen fraction of its value; run the goldens and name the check for
each value that moves.
