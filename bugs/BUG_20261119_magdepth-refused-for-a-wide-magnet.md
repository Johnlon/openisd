# BUG_20261119_magdepth-refused-for-a-wide-magnet

**Status:** FIXED (T936)

## Symptom
A 10" driver with Dd 220 mm, Vcd 65 mm, Depth 150 mm, Magnet 170 mm and DVol 2.991 L gets no Magnet depth, with the note "Magnet (170 mm) is as wide as the cone allows", where WinISD gives 70 mm.

## Evidence
Found by the Gemini (agy) engine review, checked 19 Nov 2026.
- The geometry is self-consistent: MagDepth 70 mm with the other four gives DVol 2.991 L, and the relation solved for MagDepth gives 0.0700 m.
- S = Dd² + Dd·Vcd + Vcd² = 0.06693 m2, sqrt(S/3) = 149.4 mm. A magnet wider than that makes the denominator S - 3·Magnet² negative; the numerator is negative too, so the answer is an ordinary positive depth.
- The note was wrong as well: 170 mm is narrower than the 220 mm cone.
- WinISD guards each direction only on "the target must be zero and all five other participants strictly greater than zero" (`winisd_research/archive/GHIDRA_FINDINGS.md`, "The DVol geometry relation").

## Cause
`rawMagDepth` (`packages/design/engine/dvolRelation.ts`) returned no answer whenever S - 3·Magnet² was not positive.

## Fix
Only a zero denominator has no answer. The refusal ruling of BUG_20261115_calculated-dimension-contradicts-its-own-geometry stays: a result outside 0 < MagDepth < Depth is refused, which also catches the huge value a near-zero denominator gives. The zero-denominator note now says the magnet and cone terms cancel.

## Tests
`packages/design/test/engine/driver-solve.test.ts`, "DVol geometry lock — a result outside the driver is refused, with a reason": the 2.991 L case gives 70 mm with no note; the exact DVol gives 70 mm back; a magnet of exactly sqrt(S/3) is still refused.
