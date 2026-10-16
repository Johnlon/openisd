# BUG_20261016_sealed-alignment-picker-qtc-disagrees-with-box-tab-qtc

**Status:** OPEN

## Symptom
Pick Qtc 0.707 in the sealed alignment picker (New Project wizard or the Box tab alignment
dialog) and accept. The Box tab then shows a different Qtc for that volume.

## Evidence (code read 16 Oct 2026, not yet run)
- The picker gets its volume from `volumeForQtc`, the lossless formula
  Vb = Vas / ((Qtc / Qts)² − 1) (`packages/ui/src/hooks/SealedAlignment-hooks.ts:76-80`, and in
  the wizard `packages/ui/src/hooks/OriginalNewProject-hooks.ts:295-311`).
- The Box tab Qtc is written by the project solve (`packages/design/engine/sealed/SealedEngine.ts`
  solve, via `packages/design/domain/project/projectResolve.ts:150-170`). With Fs known it is the
  lossy Qtc, which counts Ql and Rg.

## Cause
The picker and the Box tab use different Qtc formulas: lossless and lossy.

## Fix
Use one formula for both. The picker's volume should be the one the solve reads back as the
picked Qtc. Check which form WinISD uses for its alignment picker before choosing (⚠ unverified).

## Verification
Unit test: for a driver with Fs, Qts, Vas and Ql set, pick Qtc 0.707, accept, and read
`box.sealed.q_tc`: it is 0.707 to display precision.
