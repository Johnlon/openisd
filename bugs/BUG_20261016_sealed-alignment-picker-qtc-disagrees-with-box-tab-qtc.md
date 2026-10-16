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

- WinISD 0.7 under wine, 16 Oct 2026 (W5-1138SMF, Qts 0.49, Vas 4.85 L): picking Qtc 0.800 in
  the New Project wizard gives Vb 3.134 L, and the Box tab then shows Qtc 0.787 (Ql 10). The
  lossless formula gives 2.912 L. So WinISD's picker is not lossless either, and its Box tab
  disagrees with its own picker. How WinISD's picker works out Vb is not established.

## Kind (John, 16 Oct 2026: match WinISD "unless you found a WinISD bug or lack of conventional")
- WinISD's picker volume contradicts WinISD's own Box tab: Qtc 0.800 picked, 0.787 shown. By the
  CLAUDE.md test ("a value that contradicts WinISD's own other charts") that is a WinISD
  calculation bug.
- Lead, ⚠ unverified: 3.134 L is the lossless volume for a Qts of 0.501, not the driver's 0.49.
  That fits a Qts corrected for Rg, with no box losses, while the Box tab counts Ql.
- So: OpenISD by default gives the volume that shows the picked Qtc on the Box tab. A yellow
  "Enable WinISD bugs" switch gives WinISD's picker volume. Record it as a WinISD bug
  (`bugs/BUG_*_winisd-*.md`, ACCURACY_IMPROVEMENTS.md, WINISD_PARITY.md) once its formula is confirmed.
- OpenISD's lossless picker today matches neither, so it is wrong either way.

## Cause
The picker and the Box tab use different Qtc formulas: lossless and lossy.

## Fix
Use one formula for both. The picker's volume should be the one the solve reads back as the
picked Qtc. WinISD's picker volume differs from both OpenISD's lossless volume and the volume that would give
the picked Qtc on its own Box tab. Find its formula first (debugger, not exe patching).

## Verification
Unit test: for a driver with Fs, Qts, Vas and Ql set, pick Qtc 0.707, accept, and read
`box.sealed.q_tc`: it is 0.707 to display precision.
