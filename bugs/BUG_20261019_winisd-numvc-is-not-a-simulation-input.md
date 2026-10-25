# BUG_20261019_winisd-numvc-is-not-a-simulation-input

**Status:** RECORDED — an input WinISD ignores (no switch). OpenISD honours it by design (John, 2026-08-28, QO96).

Supersedes the 19 Oct record "winisd-typed-numvc-does-not-recalculate", which claimed a typed numVC and a
loaded numVC=2 give different charts. They do not.

## Symptom
Set the voice-coil count to 2 in WinISD, typed in the Driver editor or stated in the file. Every chart
(SPL, transfer, group delay, excursion, impedance, impedance phase, max power, max SPL) and the editor's USPL
stay at the one-coil figures. In WinISD `numVC` and `VCCon` are not inputs to any calculation: `Re` and `BL`
are the terminal values, and the coil count only drives the wiring combo's one-shot rewrite of them
(winisd_research PROBE_FINDINGS FINDING-009, GHIDRA_FINDINGS `0x461242`).

OpenISD stores `Re` and `BL` per coil, so a coil-count edit changes the terminal values the sweep runs on:
two coils in parallel halve the terminal Re (USPL +3.01 dB), two in series double Re and BL (USPL −3.01 dB).

## Evidence (winisd_research run records)
- E150HE-44 sealed 4 L, `VCCon=1`: typed numVC 1→2 (sweep-t429-e150-sealed-edit-numvc) equals the file-stated
  numVC=2 (sweep-t393a-sealed-e150he44-numvc2) point for point on every chart, and both equal the one-coil base
  (sweep-t429-e150-sealed-edit-pe, allowing for its Pe edit). Editor USPL 83.24 before and after. OpenISD after
  the typed edit: USPL 86.25 (+3.01 dB, parallel).
- W5-1138SMF sealed, `VCCon=2`: typed numVC 1→2 (sweep-t429-w5-sealed-edit-numvc) equals the base
  (sweep-t429-w5-sealed-edit-pe) on every chart; editor USPL 84.65 before and after. OpenISD after the typed
  edit: USPL 81.64 (−3.01 dB, series).
- The loaded numVC=2 file matches OpenISD only because the import divides the file's terminal Re/BL by the
  wiring factor (docs/research/WINISD_PARITY.md §11b): the terminal values reaching the sweep are the file's.

## Cause
Kind: an input WinISD ignores entirely. Not a trigger bug (typed and loaded agree) and not a calculation bug.
The difference is the data model: WinISD keeps one terminal `Re`/`BL` that the wiring combo rewrites in place;
OpenISD keeps per-coil values and derives the terminal ones from `numVC` and `VCCon` (John's ruling
2026-08-28, "make it two"; QO96/QO97).

## Fix
No engine change and no switch. OpenISD is right. Still to add: a ≠W Difference cue by the numVC box in the
Driver editor saying that WinISD's charts do not move on a coil-count edit (the rule for an ignored input).
The `it.fails` cases in `packages/design/test/domain/driver-edit-parity-e150he-44.test.ts` and
`driver-edit-parity-w5.test.ts` record the deviation.

## Verification
The `it.fails` cases named for this file fail as expected: charts and USPL after a typed numVC=2 differ from
WinISD's one-coil figures by the wiring factor.
