# BUG_20260924_sealed-box-leakage-modelled-as-damping-not-a-leak

Status: OPEN (re-verified 2026-09-26) — sealed leakage is still `Ral = Ql/(ω·Cab)` in `packages/design/engine/circuit.ts`.

## Symptom

In a sealed box, raising the leakage loss Ql makes openisd's low-frequency phase and group
delay go down. In WinISD the same change makes them go up. For the same 4.48 L box with Ql = 10
the group delay at 10 Hz is 3.13 ms in openisd and 7.61 ms in WinISD, and the transfer-function
phase is 165.7° against 183.9°.

## Evidence

Re-checked 2026-09-24. WinISD 0.7 under wine, four separate launches of the same project with
only the box loss Q's changed; openisd from `packages/design/test/scratch-w5.test.ts` variants.
WinISD curves traced from the plot pixels
(`winisd_research/runs/w5_sealed/charts_{base,lossless,noleak,noabs,leaky}/`).

| Box losses               | WinISD phase @10 Hz | WinISD max GD | openisd phase @10 Hz | openisd max GD |
|--------------------------|--------------------:|--------------:|---------------------:|---------------:|
| Ql 10, Qa 100 (default)  |             183.90° |       7.61 ms |              165.66° |        3.13 ms |
| Ql 1e5, Qa 1e5           |             167.94° |       4.24 ms |              168.82° |        3.16 ms |
| Ql 1e5, Qa 100           |             167.94° |       4.22 ms |                    — |              — |
| Ql 10, Qa 1e5            |             183.90° |       7.58 ms |                    — |              — |
| Ql 3                     |             207.84° |      10.97 ms |              159.32° |        3.15 ms |

Three facts follow directly from the table:

1. Made lossless, the two programs agree (167.94° vs 168.82°).
2. Qa contributes nothing to the difference; Ql produces all of it.
3. The two respond to Ql in opposite directions.

183.90° exceeds the 180° ceiling of a second-order high-pass, so WinISD's sealed alignment is
third order and openisd's is second order.

Source: `packages/design/engine/circuit.ts:157-162` and `:170-173` —
`Ral = Ql/(w * Cab)` recomputed at every grid frequency, `Zbox = cPar(Zc, Ral, Raa)`, and for
`box === 'sealed'` the radiated volume velocity is `U0 = UD`, the driver's alone.

## Cause

Because `Ral` is proportional to 1/ω it tracks |Zc| at every frequency, so `cPar(Zc, Ral)` is a
scaled compliance in series with a 1/ω resistance. It adds damping and cannot add a pole or a
zero — the alignment stays second order whatever Ql is. A leak that actually leaks changes the
order.

⚠ unverified (WinISD's own formula was not read out of WinISD, only its curves): a model with
`Ral` held **constant** at its value at Fc, and the leak's volume velocity subtracted from the
driver's (`U0 = UD - UD*Zbox/Ral`), reproduces WinISD's traced phase to 0.94° RMS over
10–200 Hz and its group delay to about 10 %. Best-fit reference frequency 67.0 Hz against
Fc = 64.94 Hz.

## Fix

Give the sealed box a leak that changes the order: a leakage resistance that does not vary with
frequency, and a radiated output that is the driver's volume velocity minus the leak's. The
vented and passive-radiator branches already have the `U0 = UD - UP` structure; sealed is the
one that does not.

`Ral` needs a reference frequency to be sized at. For a sealed box the candidate is Fc.

## Verification

Unit test on `Engine.sweep` for this case: with Ql = 10 the transfer-function phase at 10 Hz
must exceed 180° and the group delay must be near 7.6 ms; with Ql = 1e5 both must fall back to
≈ 168° / ≈ 3.2 ms. Then re-trace `toys/w5_charts.py base charts=1,2` and the four loss variants
and check the openisd curves move in the same direction as WinISD's across all of them.
