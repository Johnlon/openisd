Status: OPEN

# `.wpr` export writes fabricated constants over design state the project actually holds

## Symptom

`toWpr()` writes hardcoded literals into `[Box]`, `[SignalSource]` and `[Filters]` for fields
the project has real values for. Export silently discards the user's settings and writes
someone else's.

## Evidence

`packages/winisd/src/classic/wpr.ts`, and the project fields each one overwrites
(`packages/model/src/openisdProject.ts`):

| Line | Written as | The project's real value | Effect |
|---|---|---|---|
| `:163` | `['Qlf', 10], ['Qaf', 100], ['Qpf', 100]` | `box.Ql`/`Qa`/`Qp` | **FIXED 2026-08-21** — now `num(box.Ql ?? 10)` etc., matching the rear chamber. WinISD keeps a loss triple per chamber and OpenISD's box carries one describing the whole enclosure, so both chambers are written from it. `packages/winisd` 1240/1241 after the change; no golden moved, because WinISD's own defaults happen to equal ours. |
| `:174` | `['Nd', 1]` | `signal.driverCount` | **FIXED 2026-08-21** — `WprInput.signal` gained `driverCount`, written from `P.nDrivers` in `wprMapping.ts`. |
| `:174` | `['d', 1]`, `:175` `['Angle', 0]` | none | **NOT a defect, verified 2026-08-21.** `OpenISDListening` exists in the model but the UI collects neither field — `grep listening\|distance_m\|angle_rad packages/ui/src/types.ts` = 0 hits — so there is no design state being overridden. WinISD's own `d=1`/`Angle=0` (`goldens/sealed-small.wpr`) is the honest output until the UI collects a listening position. |
| `:175` | `['alfaVC', 0.0039], ['dTVC', 0]` | `simOptions.alfaVC`, `simOptions.vcTempRise` | **FIXED 2026-08-21** — `WprInput` gained `voiceCoil: { alfaVC, tempRise_K }`, written from `P.alfaVC`/`P.vcTempRise`. |
| `:190` | `['Count', 0]` — "OpenISD does not yet drive WinISD's behavioural filter chain" | `filters: Filter[]` | Every filter the user configured is dropped. The comment states this as fact; the project has had a populated `filters` array since the Filters pane shipped. |
| `:170` | `['Qiclfr', 100], ['Qiclfc', 0], ['Qiclcr', 0]` | none | **NOT a defect, verified 2026-08-21.** WinISD writes exactly these — `goldens/bandpass4.wpr` and `goldens/passive-radiator.wpr` both carry `Qiclfr=100`, `Qiclfc=0`, `Qiclcr=0`. No project source exists to override. |
| `:168` | `['Vc', 0], ['Fc', 0], ['Qlc', 0], ['Qac', 0], ['Qpc', 0]` | none | **NOT a defect, verified 2026-08-21.** The CENTRE chamber belongs to a 6th-order bandpass, which OpenISD does not model at all (`openisdProject.ts`, QO44) — so nothing is being overridden. Both goldens above carry all five as `0`. |
| `:181` | `['Color', 16711680]` | none in the project | Plot colour. Cosmetic, no OpenISD equivalent. |
| `:166` | `['Qlr', num(box.Ql ?? 10)]` etc. | `box.Ql`/`Qa`/`Qp` | **FIXED 2026-08-21** — the READ was correct but `buildWprInput` never passed the three, so the fallback always fired and every design exported WinISD's defaults. `wprMapping.ts` now passes `Ql: P.Ql, Qa: P.Qa, Qp: P.Qp`. Found while fixing `:163`; not previously in this table. |
| `:187` | `['Rg', signal.Rg ?? 0.1]` | `signal.seriesResistance_ohm` | **FIXED 2026-08-21** — `wprMapping.ts` now passes `Rg: P.Rs`. The writer's `?? 0.1` fallback stays for a caller that genuinely has none. |

The upstream cause is that `buildWprInput` (`packages/ui/src/logic/wprMapping.ts:33-45`) never
passes them: its signature takes `box`, `P`, `driver`, `driverSection`, `project`, `now`,
`ventArea_m2`, `curves` — and `WprInput` (`wpr.ts:71-116`) has no field for driver count,
listening position, VC thermal, Rg or filters. The serializer cannot write what it is not given,
so it writes a literal.

## Cause

`WprInput` was defined around what the first implementation happened to pass. Fields with no
slot got a plausible-looking constant with a comment, rather than a slot. The comments make the
values read as WinISD defaults — several are, but for `Nd`, `alfaVC`, `d`, `Angle` and
`Filters.Count` the project has the real answer and it is thrown away.

## Fix

Not fixed. `WprInput` gains a slot for every field the project can answer; `buildWprInput`
passes them; `toWpr` writes them. A literal survives ONLY where the project genuinely has no
source (`Qicl*`, `Color`, the unused centre chamber), and each of those states that in one line.

Verify against the WinISD-written goldens in
`packages/winisd/test/fixtures/winisd-parity/goldens/` — several exercise multi-driver and
non-default environments, so the corpus can confirm what WinISD itself writes for `Nd` and
friends rather than us guessing.

## Verification

N/A — open. Afterwards: a design with 2 drivers, a filter, and a non-zero VC temperature rise
exports a `.wpr` carrying all three, and a round trip through WinISD returns them unchanged.
