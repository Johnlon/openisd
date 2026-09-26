# The DVol/Depth/MagDepth/Magnet geometry relation is documented but never implemented

## Status
RESOLVED 2026-08-21

## Symptom

The driver editor's Dimensions tab treats `DVol`, `Depth`, `MagDepth` and `Magnet` as four
independent, always-entered fields. WinISD does not: it solves one geometry relation among them
(plus `Dd`/`Vcd`) in whichever of the four directions is missing, exactly like the Xmax↔Hc/Hg
relation the editor already implements. A driver missing exactly one of the four — the case
WinISD fills in automatically — stays blank in openisd.

## Evidence

**WinISD's own help text** (`docs/winisd_helpfiles/help/newdriver.html`, the driver-editor
walkthrough): "It shows then approximate displacement volume DVol" — DVol is shown and computed,
not typed, once the other dimensions are entered.

**The formula** (`docs/design/WINISD_SCHEMA.md` §3.10.1, relation 25, cross-referenced from
`winisd_research/RE_GHIDRA_FINDINGS.md` "The DVol geometry relation — recovered formulas"):

    S = Dd² + Dd·Vcd + Vcd²
    DVol     = (π/4) · [ S·(Depth − MagDepth)/3 + Magnet²·MagDepth ]
    Depth    = [ π·MagDepth·(S − 3·Magnet²) + 12·DVol ] / (π·S)
    MagDepth = [ π·S·Depth − 12·DVol ] / (π·(S − 3·Magnet²))
    Magnet   = √( [ 12·DVol − π·S·(Depth − MagDepth) ] / (3π·MagDepth) )

The model is a cone tapering from the diaphragm `Dd` to the voice coil `Vcd` over height
`Depth − MagDepth`, plus a cylinder (the magnet) of diameter `Magnet` and height `MagDepth`.
WINISD_SCHEMA states the four expressions "were checked against each other algebraically and agree
exactly — the inverses are not fits", citing the stamp/store addresses in the WinISD binary for
each solve direction (`RE_GHIDRA_FINDINGS.md` lines 1012-1027).

By contrast the three sibling Advanced-panel relations recovered alongside it were already
implemented: relation 7 `Mcost`, relation 21 `Gloss`, relation 22 `SPLmaxLF`. Relation 25 was the
only one of the four with no engine implementation at all.

## Fix

- `packages/engine/src/dvolRelation.ts` — the four solve directions, SI throughout, returning
  nothing for a degenerate geometry rather than NaN (the `Magnet` inverse takes a square root).
- `packages/engine/src/driver.ts:254-273` — solver block 9b in `solveConsistencyGroup`, four
  guarded solves, mirroring the Xmax/Hc/Hg block's `setVal` contract: an entered member is never
  overwritten.
- `packages/ui/src/logic/provenance.ts` — `PROVENANCE_MAP` entries for all four fields carrying
  the §3.10.1 formulas.
- `DriverEditorModal.vue` — `:style="getFieldStyle(...)"` on the four Dimensions fields, the same
  binding every provenance-lit field uses.
- `driver-editor-provenance-and-units.browser.spec.ts` — the seed enters Depth/MagDepth/Magnet/Vcd
  and leaves DVol absent (`Dd` derives from the seeded `Sd`), so the sweep exercises a calculated
  geometry field.

NOT built, deliberately: a `consistency.ts` DQ detector for a stale carried DVol. That is a
QO49-class decision and is raised separately rather than added silently.

## Verification

`packages/engine/test/dvolRelation.test.ts`, plus six integration cases in
`packages/engine/test/driver.test.ts`: all four directions solve against the worked geometry, an
entered DVol stays pinned, `Depth == MagDepth` yields no value. Engine suite 380/380; ui logic
tests 124/124; typecheck engine+ui clean; the provenance browser spec run once at `--workers=1`.
