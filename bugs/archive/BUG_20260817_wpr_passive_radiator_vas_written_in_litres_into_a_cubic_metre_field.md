# `.wpr` writes the passive radiator's Vas in litres into a cubic-metre field — 1000× too large

# Status
- Vas litres/m³ write-site fix: FIXED
- F2/F3 sub-findings: OPEN (moved to BACKLOG.md)

## Symptom

Exporting a passive-radiator design to `.wpr` writes `[PassiveRadiator].Vas` 1000× too large.
WinISD reads the file as cubic metres; openisd writes litres. The default design exports
`Vas=20.074` where WinISD needs `0.020074`.

## Evidence

`packages/engine/src/formulas.ts:15-17`:

```ts
export function prVas(prCms: number, prSd: number): number {
  return prCms * prSd * prSd * RHO * C * C * 1000;   // ×1000 converts m³ to litres
}
```

`prVas()` deliberately returns **litres** — its own comment says so, and that's correct for its
display use (`packages/ui/src/logic/prWinIsdFields.ts:16`, shown under an "L" label in
`PREditModal.vue`).

The bug is at the one call site that writes the `.wpr` file,
`packages/ui/src/logic/wprMapping.ts:101`:

```ts
input.pr = {
  Vas: prVas(P.prCms, P.prSd),   // litres, passed straight to the SI field
  ...
```

That value flows unconverted into `packages/winisd/src/classic/wpr.ts:197`'s
`[PassiveRadiator]` write. Every other field in that section is SI — `Sd`, `Xmax`, `Me` — so this
is not a section-wide convention, just this one field.

**Oracle**: `docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr:151` has `Vas=0.0048`, which WinISD's
own PR pane renders as `4.80 l` (`docs/winisd_screenshots/view_3_passive_radiator.png`). 0.0048 m³ = 4.8 L —
confirms the file field is cubic metres, litres nowhere in it.

**Why nothing caught it**: `packages/winisd/test/classic/wpr.test.ts:130` hand-feeds
`Vas: 0.0048` directly — it proves the serialiser only, never the mapping. `buildWprInput` itself
had zero tests (`grep -r buildWprInput packages/ui/test` returned nothing before this fix).

## Cause

`prVas()`'s public contract is litres (correct, and used correctly for display). The `.wpr`
mapping layer called it directly instead of converting back to the file's SI unit — the one
function serves two unit domains and the boundary crossing was never converted.

## Fix

`packages/ui/src/logic/wprMapping.ts:101` — divide by 1000 at the write site, converting `prVas`'s
litres back to the file's cubic metres:

```ts
Vas: prVas(P.prCms, P.prSd) / 1000,
```

`prVas()` itself is unchanged — its litres contract is correct for its other caller.

## Verification

New test `packages/ui/test/logic/wprMapping.test.ts` — a red/green pair: asserts
`buildWprInput('pr', ...).pr.Vas` equals `prCms · prSd² · ρ · c²` (no `×1000`, no `÷1000`
duplicated in the test — computed independently from the same physical formula) for a
representative PR driver. Fails against the pre-fix code (was 1000× the asserted value), passes
after.

## Scope note

The same audit (QO37) found two more real gaps not fixed here, not called severe:
- **F2** — 11 driver-editor fields (`Vd`, `Dd`, `no`, `SPL`, `USPL`, `SPLmax`, `SPLmaxLF`, `Rme`,
  `gamma`, `Mpow`, `Mcost`) are silently discarded on `.wdr` save.
- **F3** — `.wpr` writes `Rg`, `alfaVC`, `dTVC` as literals; the project's real values never reach
  the file.

Both moved to `BACKLOG.md`.
