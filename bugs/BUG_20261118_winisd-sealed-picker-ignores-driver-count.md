# BUG_20261118_winisd-sealed-picker-ignores-driver-count

**Status:** FIXED (T907)

## Symptom
One sentence: with the "Sealed picker volume" WinISD bug switch ticked and 4 drivers, the sealed alignment picker gives one driver's volume (W5-1138SMF at Qtc 0.800: 3.13 L), where WinISD's picker gives 4 times that (12.54 L).

## Evidence
- WinISD's picker `0x45c140` sets Vb = `[ESI+0x4b0]` / ((Qtc/Qt)² − 1) (winisd_research/archive/GHIDRA_FINDINGS.md, "SEALED (CLOSED) ALIGNMENT PICKER FORMULA FOUND"). Its `+0x4b0` (Vas), `+0x4b8` (Qts′) and `+0x4d0` (Fs) are the three slots `fr_45e090` writes, and `fr_45e090` writes `+0x4b0 = Nd·Vas`, halved for Iso-barik (GHIDRA_FINDINGS.md, "Number of drivers and placement"; spec/S04_sealed_box.md section 2, 0x45e0ad-0x45e0f2). The wizard dispatcher `0x44e9b0`, which calls the picker, copies the wizard's driver count and Iso-barik radio into the design object and runs `fr_45e090` first.
- OBSERVED, 18 Nov 2026 (winisd_research runs/s04-picker-nd-20261118/results.jsonl): WinISD's New Project wizard, W5-1138SMF, Closed, Qtc 0.800, saved Vr 0.00313383736670561 m3 at 1 driver and 0.0125353494668224 m3 at 4 drivers, exactly 4 times.
- Left over from T901 (bugs/BUG_20261118_sealed-readout-ignores-driver-count.md, "Not changed").

## Cause
`OpenISDDriver.sealedPickerVolume` with the switch ticked passed one driver's Vas to `SealedEngine.winisdPickerVolume`.

## Fix
The ticked route takes the same engine rule as every other sealed feed: `SealedEngine.arrayVas(Vas, load.nDrivers, load.loading)`. The load's Rs and the box losses stay ignored, as in WinISD.

## Tests
- packages/design/test/domain/winisd-sealed-picker-counts-drivers.test.ts: 1, 2 and 4 drivers give 1, 2 and 4 times WinISD's 3.1338 L; 4 drivers give WinISD's observed 12.5353 L; an isobaric pair gives half; the Box tab then reads WinISD's 0.787 at every count.
