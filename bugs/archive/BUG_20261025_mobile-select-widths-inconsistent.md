# BUG_20261025_mobile-select-widths-inconsistent

**Status:** RESOLVED in T581.

## Symptom

On the mobile Driver page, Connection was wider than the other controls. On the Box page, End Correction was wider than Shape in vented chambers.

## Expected

Connection matches the Driver page's standard select width. End Correction matches Shape in every vented chamber across Vented, Bandpass 4, Bandpass 6 and ABC boxes. The passive-radiator picker button uses the short label “Select PR”.

## Fix and verification

Both selects use the standard control width. Browser checks compare their measured widths across the relevant pages and box types, and verify the picker label.
