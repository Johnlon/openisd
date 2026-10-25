# BUG_20261018_wpr-non-round-vents-lost

**Status:** FIXED (T392, 18 Oct 2026)

Recorded 18 Oct 2026 by opi. John: "BUG DISPATCH TO FIX".

## Symptom
Open a WinISD project file (.wpr) whose port is a slot or rectangle: OpenISD drops the port's
size and shows only a warning ("vent shape N not imported: only round vents are read"), so the
imported design has the wrong port and the wrong tuning. Saving a slotted-port design from OpenISD
as a .wpr does not write the slot either.

## Evidence
- Import: `packages/design/domain/winIsdProjectConverter.ts:223-231`: any `Shape` other than 1 skips `dia1` and pushes the warning; `dia2` and `crosscalc` are never read.
- Export: `winIsdProjectConverter.ts:175-176`: `Shape = 1` is written only when the vent is round, marked "slotted's own code is not confirmed".
- OpenISD itself models slotted vents (`packages/design/domain/box/ventWindow.ts:14-34`, width and height).
- Every .wpr in the repo has `Shape=1` (`git grep -h "^Shape=" -- '*.wpr' | sort | uniq -c`), so no file shows the other codes.

## Cause
WinISD's non-round `Shape` codes and the meaning of `dia1`, `dia2` and `crosscalc` for them were
never captured, so the converter refuses them instead of reading them.

## Fix
1. Under wine, save one .wpr from WinISD for each vent shape it offers (and crosscalc on/off); record the codes and fields in docs/research.
2. Import and export every shape with its sizes; no warning for a shape WinISD writes.

## Verification
- Unit tests: each captured .wpr imports with the same port area, sizes and tuning WinISD shows; export → import round-trips each shape.
