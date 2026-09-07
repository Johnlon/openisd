# `.wdr` round-trip test proves one lossy cycle, never that a second cycle is stable

**Status:** OPEN
**Found:** 2026-09-07, specifying the `.wpr` bridge round-trip tests for the
`OpenISDProject`↔`WinISDProject` work (`file_io.ts`/`useDesignIO.ts` migration) and comparing
the requested `.wpr` test shape against the existing `.wdr` one.

## Symptom

`packages/design/test/winisd/wdr-openisd-round-trip.test.ts` runs exactly one cycle per sample
file — `.wdr text (WDR1) → WinISDDriver → OpenISDDriver (OIDD_1) → WinISDDriver → .wdr text
(WDR2)` — and checks WDR2 against WDR1 for specific field-level rules (entered values
unchanged, computed values agree with WinISD's own arithmetic, N slots not invented). It never
runs a second generation, so nothing in the suite proves the cycle reaches a fixed point: that
feeding WDR2 back through the same pipeline produces an `OpenISDDriver` (OIDD_2) that equals
OIDD_1, or a WDR3 that is byte-identical to WDR2.

Concretely, the test as written cannot distinguish "the format loses some information once, then
stabilises" from "the format loses a little more information on every single pass" — a driver
edited and re-saved by OpenISD twice would silently drift on the second pass and nothing would
catch it.

## Evidence

`cycle()` (`wdr-openisd-round-trip.test.ts:150-160`) is called exactly once per test — once in
`lostEntered`'s call inside the "entered values are never touched" test, once in "computed values
are recomputed and agree with WinISD", once in "N slots stay N unless something was actually
derived". No test calls `cycle(cycle(src))` or otherwise compares a first-generation output
against a second-generation one.

## What the `.wpr` bridge work is building instead, for comparison

For `OpenISDProject`↔`WinISDProject` (`.wpr`), John specified two chains, one of which is exactly
the fixed-point check missing here:

    OIDP_1 -> WPR1 -> OIDP_2 (compare LOSSY, every allowed diff named)
           -> WPR2 (compare EXACT with WPR1)
           -> OIDP_3 (compare EXACT with OIDP_2)

The `WPR2 == WPR1` and `OIDP_3 == OIDP_2` assertions are the fixed-point proof: the first hop
into WinISD's format may lose named information, but every hop after that must be perfectly
stable. The `.wdr` test has no equivalent of the `WPR2`/`OIDP_3` legs at all.

## Cause

The `.wdr` round-trip test was written to prove fidelity against a real WinISD-written oracle
corpus (`drivers/sample/winisd/`) — a different and valuable property — but was never extended to
also prove the OpenISD-side pipeline is idempotent after its first lossy hop. The two properties
were conflated as "the round-trip test" when they are separate claims requiring separate
assertions.

## Fix

Add a second-generation leg to `wdr-openisd-round-trip.test.ts`, mirroring the `.wpr` chain 2
shape: for each sample file, compute `WDR2 = cycle(src)` (as now), then `WDR3 = cycle(WDR2)`, and
assert `WDR3` is byte-identical to `WDR2`. Optionally also capture `OIDD_2` (the
`OpenISDDriver` built from `WDR2`) and assert it equals the `OpenISDDriver` used to build `WDR3`
field-for-field, matching the `OIDP_2 == OIDP_3` leg of the `.wpr` spec.

## Verification

Not yet run — no fix attempted. To verify: add the WDR2→WDR3 assertion, run
`npx vitest run packages/design/test/winisd/wdr-openisd-round-trip.test.ts`, and confirm it is
green against the same `drivers/sample/winisd/` corpus already in use. A failure here, if one
occurs, is real second-hop drift in the existing `.wdr` bridge, not a test-authoring defect.
