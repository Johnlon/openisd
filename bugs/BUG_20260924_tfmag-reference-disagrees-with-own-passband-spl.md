# BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl

**Status:** OPEN

## Symptom

The transfer-function chart is supposed to sit at 0 dB in the passband — it is the box response
with the driver's own sensitivity divided out. openisd's sits at +0.494 dB, because the
sensitivity it divides by is not the sensitivity its own SPL curve produces.

## Evidence

Re-checked 2026-09-24, Tang Band W5-1138SMF in a 4.48 L sealed box, from
`packages/design/test/scratch-w5.test.ts` (scratch, run this session):

| openisd number                 | value      | computed from      |
|--------------------------------|-----------:|--------------------|
| `spl` passband (200 Hz–20 kHz) | 81.422 dB  | Bl, Mms, Sd, Re    |
| `SPL_dB` in the driver record  | 80.92838 dB| Fs, Vas, Qes       |
| `tfMag` passband               | +0.494 dB  | the difference     |

80.92838 dB is the classical efficiency route: η0 = 4π²·Fs³·Vas/(c³·Qes) = 7.5405e-4, and
p = √(η0·ρc/2π) = 0.22258 Pa → 80.919 dB. The sweep's 81.422 dB comes from
p = ρ·Bl·Sd·eg/(2π·Re·Mms).

Both are openisd's own numbers for the same fact — this driver's 1 W / 1 m sensitivity — and
they differ because the entered parameter set is not self-consistent: the entered Mms implies
Fs = 48.83 Hz while the entered Fs is 45 Hz, a 12.2 % disagreement in Mms.

WinISD, probed this session on the identical project
(`winisd_research/runs/w5_sealed/charts_base/`), plots its transfer function at 0.013 dB in the
passband — one pixel off zero — and its SPL passband is 80.508 dB. Its two numbers agree
because its sweep and its sensitivity both derive Mms from Fs and Vas.

## Cause

The sweep's SPL and the driver record's `SPL_dB` are computed by different code paths that
consume different subsets of an inconsistent driver record, and `tfMag` subtracts one from the
other.

## Fix

Two openisd numbers hold the same fact. Pick one source for the driver's 1 W / 1 m sensitivity
and have both the driver readout and the transfer-function reference use it. Either the sweep's
own passband level or the efficiency formula, not one each.

Note this does not close the 0.9 dB gap to WinISD's SPL curve — that is a separate consequence
of the same inconsistent record and is not an openisd defect (see
`docs/research/PROBE_W5_SEALED_20260924.md` section 4.3).

## Verification

Unit test on `Engine.sweep` for this case: `tfMag` in the passband must be 0 dB to within the
grid's resolution, for a driver whose entered Fs/Vas/Qes and entered Mms/Cms/Bl disagree.
