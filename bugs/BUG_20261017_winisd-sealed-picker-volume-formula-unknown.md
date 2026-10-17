# BUG_20261017_winisd-sealed-picker-volume-formula-unknown

**Status:** OPEN

## Symptom
WinISD's New Project wizard sealed alignment picker gives a volume whose Box tab Qtc is not the picked one: picking
Qtc 0.800 for the W5-1138SMF (Qts 0.49, Vas 4.85 L) gives Vb 3.134 L, and the Box tab then shows Qtc 0.787 (Ql 10).
The lossless formula gives 2.912 L. OpenISD's picker now gives the volume that shows the picked Qtc.

## Kind
A WinISD calculation bug (a value that contradicts WinISD's own Box tab). Per CLAUDE.md OpenISD does the correct thing
by default, with a yellow switch under "Enable WinISD bugs" that brings WinISD's picker volume back.

## Not yet known
WinISD's picker formula. Lead (unverified): 3.134 L is the lossless volume for a Qts of 0.501, not the driver's 0.49,
which fits a Qts corrected for Rg with no box losses.

## Fix
Find the formula first (debugger, not exe patching). Then add the switch, the ≠W cue, the
`docs/research/ACCURACY_IMPROVEMENTS.md` row and the `docs/research/WINISD_PARITY.md` row.

## Verification
A unit test of the switch against the wine capture: Vb 3.134 L for Qtc 0.800 on the W5-1138SMF.
