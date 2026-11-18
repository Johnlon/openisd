# BUG_20261118_wizard-rounds-the-picked-sealed-volume

**Status:** FIXED in T902

## Symptom
Picking sealed Qtc 0.707 for the W5 driver: the New-project wizard stored 4.803 L (the Box tab then reads Qtc 0.70699); the
Box tab's alignment picker stored 4.802824 L (reads 0.70700). Two pickers, one choice, two volumes. Found by the
duplicate-logic scan (`_agent_files/dupscan/REPORT.md`, finding 5).

## Cause
`OriginalNewProject-hooks.ts` `recomputeSealedVolume` passed the engine's volume through the volume field's display format
(`toSI(Number(format(v)))`): rounding in the UI. `SealedAlignment-hooks.ts` `selectQtc` stored it as the engine gave it.

## Fix
The wizard stores the engine's volume as given, as the Box tab picker does; the volume field rounds only what it shows.

## Verification
`packages/ui/test/hooks/sealed-pick-same-volume.test.ts` (Qtc 0.6, 0.707, 0.8: the wizard's stored volume equals the Box tab
picker's for the same project): failed before (0.004803 against 0.004802823791328864), passes after.
