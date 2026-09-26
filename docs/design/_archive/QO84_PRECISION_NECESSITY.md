# QO84 — does OpenISD's DQ need the precision-interval approach? Verdict: YES

Investigation for QO84, against the corpus at `winisd_drivers/db/datasheets` (1,969 records)
and `packages/engine/src/consistency.ts` at openisd HEAD `9cdde8f`. No code changed.

## Verdict

**Necessary.** John's prior — "is it necessary - I think it probably is for the dq" — is
confirmed, and the case is stronger than the `'28 Hz'` vs `'28.0 Hz'` example that prompted it.
The absence of `read_precision` produces wrong DQ verdicts in **both** directions, and the
larger error is the one nobody predicted.

## The mechanism

`read_precision` is **declared and never consumed.** It exists at
`packages/model/src/openisdRecord.ts:58`; every other occurrence in the TypeScript tree is a
test fixture. No production path reads it.

`consistency.ts` instead infers precision from the stored SI float:

```ts
delta[k] = k in entered ? halfUlp(resolved[k]) : Math.abs(resolved[k]) * FLOAT_NOISE;
```

`halfUlp` (`consistency.ts:159`) takes half the last significant decimal of the value **as
stored**. Its own docstring is honest about the premise — the stored number is "the only
precision evidence a record carries". That premise stopped being true when the corpus began
carrying `read_precision` per reading.

A stored float cannot answer two questions the printed literal can:

1. **Trailing zeros.** `'28.0'` and `'28'` both store the float `28`. `halfUlp(28) = 0.5`,
   but `'28.0'` states ±0.05. The tolerance comes out **10× too loose**.
2. **Non-decimal unit conversions.** Inches and cubic feet are not powers of ten, so the
   decimal count of the SI value has no relation to the significant figures of the source.
   `'8'` inches states ±0.5 in = ±0.0127 m; stored as `0.2032`, `halfUlp` infers ±5e-5 m —
   **254× too tight**.

## Corpus exposure (measured, not estimated)

| measure | value |
|---|---|
| records scanned | 1,969 |
| records carrying ≥1 divergent reading | **1,906 (96.8%)** |
| readings carrying `read_precision` | 41,021 |
| readings where `halfUlp` ≠ `read_precision` | **7,810 (19.0%)** |
| — too loose (false negatives possible) | 7,230 |
| — too tight (false positives possible) | 580 |

Worst loosening by field: `Fs` and `Cms` ×10,000; `Pe`, `Mms`, `BL`, `Sd`, `EBP` ×1,000.

## Worked examples from real records

**Direction 1 — too loose, so a real disagreement goes unreported.** Three records where the
Q-group verdict actually flips. Relation `Qts = Qes·Qms/(Qes+Qms)`; tolerance built the way
`checkConsistency` builds it (own half-width plus the movement induced by perturbing each
other member).

| record | printed Qts / Qes / Qms | residual | tol from `read_precision` | tol from `halfUlp` |
|---|---|---|---|---|
| `dayton-audio/mx15-22` | `'0.40'` `'0.46'` `'4.27'` | 0.01526 | 0.00912 → **flags** | 0.05412 → silent |
| `beyma/12lx60v2` | `'0.38'` `'0.40'` `'15.3'` | 0.00981 | 0.00978 → **flags** | 0.05237 → silent |
| `seas/w12cy003` | `'0.36'` `'0.44'` `'2.30'` | 0.00934 | 0.00865 → **flags** | 0.00978 → silent |

In each case the datasheet's own three numbers disagree beyond the precision the datasheet
itself claims, and OpenISD's DQ cannot see it — because `'0.40'` and `'2.30'` lose their
trailing zero the moment they become floats.

**Direction 2 — too tight, so a good record is flagged.** All from `grs/8fr-8`, whose
datasheet is imperial:

| field | printed | stored (SI) | `read_precision` | `halfUlp` | error |
|---|---|---|---|---|---|
| `Vas` | `'1.31'` ft³ | 0.037095008 | ±1.42e-4 | ±5e-10 | **283,000× too tight** |
| `Outer` | `'8'` in | 0.2032 | ±0.0127 | ±5e-5 | 254× too tight |
| `Vcd` | `'1.5'` in | 0.0381 | ±0.00127 | ±5e-5 | 25× too tight |
| `Depth` | `'3.875'` in | 0.098425 | ±1.27e-5 | ±5e-7 | 25× too tight |

580 readings sit in this class, concentrated in `weight_kg`, `Vcd`, `Depth`, `Vas`, `Outer`,
`Xlim`, `Xmax` — i.e. wherever a vendor prints imperial. These are the more damaging failures
for a release: DQ reports a contradiction in a record that is internally consistent to every
digit its source actually stated.

## What this does not say

- It does not say python's `precision.py` should be ported line for line. The finding is that
  the *evidence* (`read_precision`) must reach the check; whether the interval algebra is
  ported or reimplemented against the existing `delta[]` accumulation is a design choice.
  The narrowest change consistent with the evidence is to seed `delta[k]` from the reading's
  `read_precision` where one exists, and fall back to `halfUlp` where none does.
- It does not quantify how many of the 7,810 divergent readings actually change a *verdict*.
  Only the Q-group was searched exhaustively for verdict flips (3 found). Other §4 groups were
  not swept; the true flip count is ≥3 and unmeasured above that.
- The 580 too-tight readings were characterised by field, not individually confirmed as
  currently-flagged. The mechanism is certain; the per-record DQ outcome is not claimed.

## Reproduction

Both scans are pure reads over `winisd_drivers/db/datasheets/*/*/openisd.yml`, comparing each
reading's `read_precision` against a Python transcription of `halfUlp`. Re-derivable from the
tables above; no artifact was left in the corpus.
