# The Xmax probe table presents its control case as a seventh derivation run

# Status
FIXED (re-verified 2026-08-19)

## Symptom

`docs/design/WINISD_SCHEMA.md` §4.1 introduces the `Xmax` tie-break campaign as "seven WinISD runs
driving the real binary, **one blank `Xmax` per run**". Six of the seven fit that description.
The seventh, `D_all_four_xmax`, has `Xmax` **entered**, not blank.

The table then lists `D` last — out of alphabetical order, after `G` — with `neither` in the
"fired" column and no marker saying it is the control. A reader scanning the table sees six rows
where a route fired and one where none did, and reasonably concludes `D` is an unexplained
failure or a missing derivation.

## Evidence

`winisd_research/runs/xmax_route.jsonl`, record `D_all_four_xmax`:

```json
"entered": { ..., "Hc": 0.015, "Hg": 0.0034, "Vd": 0.000407, "Sd": 0.022, "Xmax": 0.0093 },
"parstate_in": "EEEEEENNEENEEEEEEEEENNNEEENNNNNNNNNNNNNNNNNNNNNNN",
"predicted": { "route19": 0.0058, "route20": 0.0185 }
```

`Xmax` is in the `entered` set and its ParState position carries `E` on the way IN. WinISD
returned `0.009` still marked `E`. Both routes were computable and disagreed with it (`0.0058`
and `0.0185`); WinISD used neither.

That is the DESIGNED outcome. `D` is the control that establishes "an entered value is never
recomputed" for `Xmax` specifically, against two live competing routes — the strongest form of
that test. The doc's own bullet already says so; the table just does not.

## Cause

The intro sentence generalises over all seven runs a property only six of them have, and the
table has no column distinguishing "Xmax was blank, watch which route fills it" from "Xmax was
supplied, watch whether anything overrides it".

## Fix

- Correct the intro: six runs leave `Xmax` blank, one supplies it as a control.
- Move `D` into sequence and label it, so `neither` reads as the expected result rather than a
  gap.

Not a defect in WinISD, and not a missing formula in openisd — `packages/engine/src/driver.ts`
already reproduces all seven cases, `D` included, because an entered value is never overwritten.

## Verification

The intro's count of blank-`Xmax` runs matches the number of rows whose "fired" column names a
route, and every row whose `Xmax` was entered is marked as a control.

Re-verified 2026-08-19: `docs/design/WINISD_SCHEMA.md:403-405` now reads "six leave `Xmax` blank
and watch which route fills it, and the seventh (`D`) supplies an `Xmax` that agrees with
neither route, as a control" — both fixes applied: `D_all_four_xmax` is row 4 (in sequence, not
last) and its "fired" column reads `neither — **control**` (`:419`).
