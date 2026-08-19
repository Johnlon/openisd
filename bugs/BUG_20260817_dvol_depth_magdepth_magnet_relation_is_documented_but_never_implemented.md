# The DVol/Depth/MagDepth/Magnet geometry relation is fully documented and never implemented

# Status
OPEN

## Symptom

The driver editor's Dimensions tab treats `DVol`, `Depth`, `MagDepth` and `Magnet` as four
independent, always-entered fields. WinISD does not: it solves one geometry relation among them
(plus `Dd`/`Vcd`) in whichever of the four directions is missing, exactly like the Xmax↔Hc/Hg
relation the editor already implements. openisd derives none of the four.

## Evidence

**WinISD's own help text** (`research/winisd/help/newdriver.html`, the driver-editor walkthrough):
"It shows then approximate displacement volume DVol" — DVol is *shown/computed*, not typed, once
the other dimensions are entered.

**The formula, already reverse-engineered and sitting in this repo's own docs**
(`docs/design/WDR_SCHEMA.md` §3.10.1, cross-referenced from `winisd_research/RE_GHIDRA_FINDINGS.md`
"The DVol geometry relation — recovered formulas"):

    S = Dd² + Dd·Vcd + Vcd²
    DVol     = (π/4) · [ S·(Depth − MagDepth)/3 + Magnet²·MagDepth ]
    Depth    = [ π·MagDepth·(S − 3·Magnet²) + 12·DVol ] / (π·S)
    MagDepth = [ π·S·Depth − 12·DVol ] / (π·(S − 3·Magnet²))
    Magnet   = √( [ 12·DVol − π·S·(Depth − MagDepth) ] / (3π·MagDepth) )

Model: the driver is a cone tapering from the diaphragm `Dd` to the voice coil `Vcd` over height
`Depth − MagDepth`, plus a cylinder (the magnet) of diameter `Magnet` and height `MagDepth`.
WDR_SCHEMA states the four expressions "were checked against each other algebraically and agree
exactly — the inverses are not fits", and cites the exact stamp/store VAs in the WinISD binary
for each of the four solve directions (`RE_GHIDRA_FINDINGS.md` lines 1012-1027). This is not a
guess or an approximation to reverse-engineer — it is already recovered and pinned.

**Not implemented anywhere in openisd**: `grep -rn "Dvol\|DVol\|basketDisplacement" packages/engine/src
packages/model/src` (excluding tests) returns only field declarations
(`packages/engine/src/types.ts:101 basketDisplacement?: number`,
`packages/model/src/openisdDriver.ts:161-172` the mm-scale unit mapping) — no formula, no solver
entry, nothing that reads `Depth`/`MagDepth`/`Magnet`/`Dd`/`Vcd` to produce `DVol` or vice versa.

**Misclassified in the registry as a result**: `packages/ui/src/logic/fields/fieldRegistry.ts:432`
marks `dimDvol` `provenance: 'entered'`, and `DriverEditorModal.vue`'s Dimensions tab renders all
eight dimension fields identically as plain entered values with no `getFieldStyle`/provenance
binding — there is no calculated state for any of the four this relation actually governs.

## Correction to a prior claim

This session earlier told the human "no provenance on Dimensions is correct... nothing derives
Basket Diameter from anything else" as a blanket statement about the whole tab. That is true for
`Thick`, `Basket`, `Outer` and `VCd` — WDR_SCHEMA's relation lists only `DVol`, `Depth`,
`MagDepth`, `Magnet`, `Dd`, `Vcd` as members, so those four genuinely have no formula and no
docs claim otherwise. It was WRONG to extend that to `DVol`/`Depth`/`MagDepth`/`Magnet` without
checking WinISD's own documentation for them specifically, which the human caught.

## Fix (not yet applied — scope, not a one-liner)

Implement the relation as a fifth solver group alongside the existing Xmax↔Hc/Hg one
(`packages/engine/src/driver.ts` / `packages/engine/src/consistency.ts`), four solve directions,
each guarded on the other participants being present and physically valid (the `Magnet` inverse
takes a square root, so an impossible input set must be handled, not surfaced as NaN). Wire the
editor's `DVol`/`Depth`/`MagDepth`/`Magnet` fields to `getFieldStyle`/provenance the same way
`Xmax`/`Hc`/`Hg` already are, and add `PROVENANCE_MAP`/`LABEL_TO_FIELD_KEY` entries for all four.

Not started this session — multiple concurrent sessions are actively rewriting overlapping hot
files right now (ledger QO56), so a new solver group is deferred until that settles.

## Verification (once fixed)

A driver-editor test analogous to the existing Xmax/Hc/Hg round-trip: enter any three of
`DVol`/`Depth`/`MagDepth`/`Magnet` (plus `Dd`/`Vcd`), assert the fourth is solved to the formula
above and marked calculated; clearing the entered one and typing the solved one instead swaps
which is which.
