Status: RESOLVED

# The DVol geometry relation is fully documented but zero percent implemented

# Status
OPEN

## Symptom

`docs/design/WINISD_SCHEMA.md` §3.10.1 documents WinISD's `DVol` relation in full — the truncated
cone plus magnet cylinder, the forward form, and all four algebraically exact solve directions
(relation 25). None of it exists in the engine. A driver missing exactly one of `DVol`, `Depth`,
`MagDepth`, `Magnet` — the case WinISD fills in automatically — stays blank in openisd.

## Evidence

```
grep -rn "DVol\|MagDepth" packages/engine/src/*.ts     ->  zero matches, no test files either
```

`DVol` is not even a field the engine's `DriverRaw` type declares — `packages/engine/src/
types.ts` has no `DVol` key at all. openisd's own field for it, `basketDisplacement`
(`types.ts:101`), is declared and never read, never written, never computed anywhere in
`packages/engine/src/*.ts`.

The `.wdr` boundary is fine — `packages/winisd/src/winisdDriver.ts:131` writes the literal key
`DVol=0` on save (matching WinISD's own default) and `:155` has the unit conversion
(`driver_volume_l` ↔ `DVol`, factor `1e-3`). So the file round-trips a stored `DVol`; the engine
just never derives one, and never derives `Depth`, `MagDepth` or `Magnet` from it either.

By contrast, the other three "Advanced panel" relations recovered this session ARE implemented
correctly:

| relation | field | engine | matches documented formula |
| --- | --- | --- | --- |
| 7 | `Mcost` | `driver.ts:344` | yes |
| 21 | `Gloss` (internal name `loss`) | `driver.ts:323` | yes |
| 22 | `SPLmaxLF` | `driver.ts:332` | yes |
| 25 | `DVol`/`Depth`/`MagDepth`/`Magnet` | **absent** | n/a |

`loss` → `Gloss` is a deliberate, correctly-wired internal rename (`winisdDriver.ts:169`), not a
bug — flagging it here only to rule it out, since the naming difference could look like another
gap on a quick grep.

## Cause

The relation was recovered from `winisd.exe`'s calculation engine this session
(`winisd_research/RE_GHIDRA_FINDINGS.md`, the DVol section) and documented in the schema. It was
never carried into `driver.ts` — there is no prior implementation to have drifted from; the gap
is total, not partial.

## Fix

Not applied — no ruling requested yet. Implementing needs:

1. Add `DVol` to `DriverRaw` (`types.ts`) — `basketDisplacement` is the wrong name for it if it's
   meant to be this field; confirm intent before reusing or renaming.
2. Four `setVal` blocks in `driver.ts`, one per solve direction, each guarded on the other five
   participants (`Dd`, `Vcd`, and the three not being solved for) being present — mirroring the
   `Mcost`/`Gloss`/`SPLmaxLF` blocks already there.
3. Wire the result to the existing `.wdr` write path, which already has the key mapping.

## Verification

Once implemented: a driver with `Dd`, `Vcd`, `Depth`, `Magnet` present and `MagDepth` blank
should derive `MagDepth`; the reverse (all four present, `DVol` blank) should derive `DVol` —
the WINISD_SCHEMA.md §3.10.1 forward form is the value to check against, algebraically exact, not a
fit.

## Fix (applied 2026-08-21)

Wired per the integration plan the relation was built for:

- `packages/engine/src/driver.ts` — new solver block 9b in `solveConsistencyGroup`: four
  guarded solves (`dvolFromDims`/`depthFromDims`/`magDepthFromDims`/`magnetFromDims` from
  `./dvolRelation.js`), mirroring the Xmax/Hc/Hg block's `setVal` contract — an entered member
  is never overwritten, a degenerate geometry yields nothing.
- `packages/ui/src/logic/provenance.ts` — `PROVENANCE_MAP` entries for `DVol`/`Depth`/
  `MagDepth`/`Magnet` carrying the §3.10.1 formulas (`LABEL_TO_FIELD_KEY` already had the
  labels).
- `DriverEditorModal.vue` — `:style="getFieldStyle(...)"` on the four Dimensions fields, same
  binding as every provenance-lit field.
- `driver-editor-provenance-and-units.browser.spec.ts` — the seed now enters
  Depth/MagDepth/Magnet/Vcd on the Dimensions tab, leaving exactly DVol absent (`Dd` derives
  from the seeded `Sd`), so the sweep exercises a CALCULATED geometry field for real.

NOT built, deliberately: a `consistency.ts` DQ detector for a stale carried DVol — a
QO49-class decision, raised separately rather than added silently.

## Verification

`packages/engine/test/driver.test.ts` — six new integration cases: all four directions solve
against the worked geometry, an entered DVol stays pinned, Depth==MagDepth yields no value.
Engine suite 380/380; ui logic tests 124/124; typecheck engine+ui clean; the provenance
browser spec run once at `--workers=1` (result recorded in the session).
