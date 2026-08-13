# Znom is calculated from Re, but openisd derives nothing and emits `N` at ParState slot 0

**Found** 2026-08-13, by the WinISD ParState slot-0 probe (ledger QO30).
**Severity** a `.wdr` written by openisd tells WinISD a field is unset that WinISD itself computes,
and the fresh-authored writer puts the wrong number on the `Znom=` line.

## Symptom

Load `drivers/sample/winisd/John-all-manu-populated.wdr` (a genuine WinISD save, `Re=6`,
`Znom=8`, ParState slot 0 = `C`) and write it back:

- `Driver.toWdr()` emits ParState slot 0 = `N` — "not in play" — where WinISD wrote `C`.
- The fresh-authored path (`packages/winisd/src/classic/wdr.ts:29`) writes
  `'Znom=' + g(d.Z || d.Re)`, i.e. `Znom=6` where WinISD writes `Znom=8`. For `Re=8` it writes
  `8` where WinISD writes `12`.

`packages/winisd/test/driver-roundtrip.test.ts:68` had to exclude slot 0 from its
"ParState round-trips identically" assertion to stay green.

## What WinISD does

`Znom` is CALCULATED from `Re` — `C` in slot 0 means WinISD derived it, it is not a pin:

    Znom = 2 · round_half_to_even(0.75 · Re)

18/18 exact over the probe set (`winisd_research/runs/znom_state.jsonl`,
`toys/campaign_znom_state.py`, wine 10.0). `Znom` is an integer, so the criterion is exact
integer agreement, not a residual.

The rounding mode takes all three exact-`.5` ties to pin; none alone is decisive:

| `Re` | `0.75·Re` | WinISD | refutes |
| --- | --- | --- | --- |
| 6 | 4.5 | `Znom=8` (→4, even) | half-**up** would give 5 → 10 |
| 10 | 7.5 | `Znom=16` (→8, even) | half-**down** would give 7 → 14 |
| 2 | 1.5 | `Znom=4` (→2, even) | confirms both directions |

**The two NEAR-ties are only reproduced by an exact evaluation of the product** — WinISD is
Delphi and computes in 80-bit Extended, so `0.75·Re` is exact there and never rounds to the tie:

| `Re` (file text) | exact `0.75·Re` | WinISD | a double-rounded product |
| --- | --- | --- | --- |
| `7.333333333333333` | 5.49999999999999975 → 5 | `Znom=10` | `5.5` → 6 → would predict **12** |
| `3.3333333333333335` | 2.500000000000000125 → 3 | `Znom=6` | `2.5` → 2 → would predict **4** |

It follows `Re` and NOT the damping factors: `Z_incon_re8_qes27` writes `Re=8` beside `Qes`/`Qts`/
`Rms` describing a driver with `Re=27`, and `Znom` came out `12 = 2·round(0.75·8)`, not `40`. A
*calculated* `Re` serves as input equally well (`Z_re_unset`: `Re` back-derived as 6 and marked
`C`, `Znom` still 8).

Slot 0 is an ordinary E/C field, not a pin like `numVC`'s permanent `E`:

| case | file in | `Znom` saved | slot 0 |
| --- | --- | --- | --- |
| entered, agreeing with the rule | `Znom=8, Re=6` | 8 | `E` |
| entered, contradicting the rule | `Znom=4, Re=6` | 4 | `E` — never corrected to 8 |
| absent | `Re=6` | 8 | `C` |
| entered then cleared in the editor | `Znom=8, Re=6` | 8 | `C` — reverts to calculated |

`Re=0.6` rounds the product to 0 and WinISD saves `Znom=0` marked `C`: a COMPUTED zero, distinct
from the unset `Znom=0`/`N` of a blank driver.

## Cause

`packages/engine/src/driver.ts`'s `solveConsistencyGroup` has no rule for `Z` at all, in either
mode. The Driver ADT hands it every entered field
(`packages/winisd/src/driver.ts:426`) and marks a slot `C` only when the solver filled it, so
`cell('Z').state` falls through to `N`. `classic/wdr.ts:78`'s `s[0] = num(raw.Z) ? 'E' : 'C'` has
the right SHAPE but no formula behind it, which is why `toWdr` writes `Re` in place of `Znom`.

## Fix

`nominalImpedance(Re)` in `packages/engine/src/driver.ts`, called from the full solver's
consistency block, so `Z` is derived wherever the other calculated fields are.

Delphi's Extended is reproduced **exactly**, not approximated: `0.75·Re` is `3·Re/4`, whose exact
value needs up to 55 mantissa bits, so it is carried as an error-free `hi + lo` double pair
(`hi = 0.75·Re`, `lo` the exact residual from a two-sum of the exactly-representable `Re/2` and
`Re/4`) and the half-to-even decision is taken on the pair. The fractional part of `hi` is either
exactly `0.5` or at least one ulp away from it, and `|lo| ≤ ulp/2`, so `lo` can only ever break a
true tie — it can never manufacture or destroy one. That reproduces WinISD on both near-ties,
where the naive `Math.round(0.75 * Re)` on a double gets both wrong.

## Verification

`packages/engine/test/znom.test.ts` — the 16 probe rows asserted exactly, the three tie rows named
individually, both near-ties asserted against the naive double product to prove the exactness
matters, and the entered-value pin. `packages/winisd/test/driver-roundtrip.test.ts` no longer
excludes slot 0: all 49 characters round-trip.
