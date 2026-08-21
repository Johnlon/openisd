# The engine's `Cms` route order is inverted against WinISD's address order

# Status
OPEN 2026-08-21

## Symptom

WinISD computes `Cms` two ways — `Cms = Vas/(ρ₀·c²·Sd²)` (§4 row 10) and
`Cms = 1/((2π·Fs)²·Mms)` (§4 row 11) — and its own address order runs row 10 BEFORE row 11.
`packages/engine/src/driver.ts`'s `solveConsistencyGroup` runs them in the opposite order: the
`Fs`+`Mms` route (block "3b", right after the `Fs` block) fires before the `Vas`+`Sd` route
(block 4). When both routes are ready in the same fixpoint pass, the engine locks onto row 11's
answer where WinISD would have locked onto row 10's — the same "first-ready-in-a-pass wins,
never revisited" lockout this session's `Fs`-route work
(`bugs/BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md`)
established as the standard the engine must match.

## Evidence

`winisd_research/scripts/relation_routes.py`:

```
(0x45f6f7, 'Cms', 10, 'Cms = Vas / (ρ₀·c²·Sd²)'),
(0x45f74f, 'Cms', 11, 'Cms = 1 / ((2π·Fs)²·Mms)'),
```

Row 10's compute site (`0x45f6f7`) precedes row 11's (`0x45f74f`) — WinISD tries `Vas`/`Sd`
first.

Measured directly against `solveConsistencyGroup({ full: true })` (temporary test, run and
removed 2026-08-21 — not part of the committed suite), entering `Fs`, `Mms`, `Sd` and a `Vas`
chosen so the two routes disagree by exactly 2×:

```
solveConsistencyGroup({ Fs: 40, Mms: 0.02, Sd: 0.05, Vas: 0.5614420175175001 }, { full: true }).Cms
  -> 0.0007915717472057639        // engine: locks via Fs+Mms (row 11) first

Vas / (driverRho({}) * driverC({})**2 * Sd**2)
  -> 0.0015831434                 // WinISD's own row 10 (Vas+Sd) answer — 2× the engine's
```

Every driver with both `Fs`/`Mms` and `Vas`/`Sd` present and mutually inconsistent gets the
engine's `Cms` from the wrong route — and every field downstream of `Cms` within the same pass
(`Mms`, `Rms`, `BL`, and any `Fs` route that reads `Cms`) inherits the wrong value.

## Cause

`packages/engine/src/driver.ts`'s iterative solver places the `Cms`-from-`Fs`/`Mms` line
(directly under the "3. Fs" block, labelled "3b. Mms, Cms from Fs") before the "4. Vas, Cms, Sd"
block that derives `Cms` from `Vas`/`Sd`. This ordering was never checked against WinISD's own
address order — it followed from grouping "the reverse directions of the Fs block" next to the
Fs block itself, not from the relation numbering.

## Pre-existing, not introduced by this session

This is not new code: the "3b"/"4" block order (and the routes within it) predates the
`Fs`-route fix landed alongside this bug. It was exposed by that fix's own evidence-gathering
(the `Cms` compute-site address, `0x45f6f7`, was pulled from `relation_routes.py` to cite the
`Fs`-route lockout test) — WinISD's row 10 lands one address BEFORE the row 11 the engine already
implemented, revealing the same inversion one level up the dependency chain.

## Fix (not implemented — recording only)

Move the "4. Vas, Cms, Sd" block (or at minimum its `Cms`-from-`Vas`/`Sd` line) to run before the
"3b" `Cms`-from-`Fs`/`Mms` line, matching WinISD's row 10 → row 11 address order.

## Verification (for the fix, not yet run)

A test entering `Fs`, `Mms`, `Sd`, `Vas` all at once with the two `Cms` routes engineered to
disagree, asserting the `Vas`/`Sd` route (row 10) wins — the same "prefers X over Y when both are
ready" pattern used for the `Fs`-route priority tests in
`packages/engine/test/driver.test.ts`'s `solveConsistencyGroup — Fs route parity with WinISD
(BUG_20260817)` describe block.
