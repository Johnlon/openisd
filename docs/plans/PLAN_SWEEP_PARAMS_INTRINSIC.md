# SweepParams: moving project-intrinsic fields onto OpenISDProject

`OpenISDProject.sweep(P)`/`maxCurves(P)`/`validateParams(P)` currently require the caller to
supply every field in `SweepParams` — including `Vb`, `eg`, box losses, vent geometry,
passive-radiator fields, and simulation options that are already stored on the project. John,
2026-09-06: "the functions on the project MUST NOT be provided with params that are already
intrinsic to the project." The only externally-supplied fields are `fmin`/`fmax`/`N` — the UI's
chart-window and point-count choice.

`OpenISDProject` should hold ONLY three fields — `#saved` and `#edited` (each an
`OpenISDProjectJson` record) and the injected `#engine`. John, 2026-09-06: "OpenISDProject
should have ONLY three fields the json saved and the json edited and then engine." The record is
itself structured: driver and its associated params, box, vents, filters and so on each live as
their own sub-object inside it, the same way `OpenISDProjectJson.box`/`.driver`/`.meta` already
do. Every other public member (`driver`, `box`, `name`, `comment`, and whatever this plan adds) is
a veneer of domain interfaces mirroring that structure one-for-one — a typed accessor wrapping its
corresponding sub-object in the record, built on demand from `#saved`/`#edited` rather than held
as its own stored field.

**DONE.** `driver`, `box`, `name`, `comment` are now getters, built fresh from `#saved`/`#edited`
on each read via `#slot()`, instead of stored fields assigned once in the constructor.
`OpenISDProject` holds exactly `#saved`/`#edited`/`#engine` (`#uuid`/`#listeners` are the two
documented exceptions — QO92 for `#uuid`; `#listeners` is `subscribe()`'s own bookkeeping, not
project state). Enforced by `packages/design/test/architecture-project-has-three-fields.test.ts`
(AST check over the class's property declarations, verified to fail on a planted extra field).
`npm run typecheck:design` and the `design` project's unit suite both pass with this change.

So every field below marked "new" gets two things, never one alone: a place in
`OpenISDProjectJson`'s own structure (inside the sub-object it belongs to — `box`, the new
driver-embedding section, or a project-level field), and a corresponding accessor on
`OpenISDProject`'s public surface reaching it, matching the getter shape `box`/`driver`/`name`
should have. No bare scalar bolted directly onto the class outside that structure.

**DONE.** The driver-array-level settings collected around the embedded driver — `nDrivers`,
`wiring`, `vcTempRise_K`, `Rs_ohm`, `driverAddedMass_kg`, `alfaVC_per_K`, `circuitModel` — live on
a `driverEmbedding` sub-object on the record, each reached by its own `OpenISDProject` getter
(`project.ts:1690-1727`) built fresh from `#saved`/`#edited` via `#slot('driverEmbedding')`, the
same pattern `box` uses. No separate `DriverEmbedding` domain interface was needed: the getters
themselves are the public surface, matching `box`/`driver`'s shape.

## Field disposition

| Field                 | Home                               | Status                                                                                                                                                      |
| --------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Vb`                  | `OpenISDBox`                       | exists                                                                                                                                                      |
| `Vf`                  | `OpenISDBox`                       | exists                                                                                                                                                      |
| `Sp`                  | `OpenISDBox` (vent)                | exists                                                                                                                                                      |
| `Leff`                | `OpenISDBox` (vent)                | exists                                                                                                                                                      |
| `Ql`                  | `OpenISDBox` (losses)              | exists                                                                                                                                                      |
| `Qa`                  | `OpenISDBox` (losses)              | exists                                                                                                                                                      |
| `Qp`                  | `OpenISDBox` (losses)              | exists                                                                                                                                                      |
| `prSd`                | `OpenISDBox` (PR chamber)          | exists                                                                                                                                                      |
| `prNum`               | `OpenISDBox` (PR chamber)          | exists                                                                                                                                                      |
| `prMmd`               | `OpenISDBox` (PR chamber)          | exists                                                                                                                                                      |
| `prMadd`              | `OpenISDBox` (PR chamber)          | exists — `addedMass_kg`                                                                                                                                     |
| `prCms`               | `OpenISDBox` (PR chamber)          | exists                                                                                                                                                      |
| `prRms`               | `OpenISDBox` (PR chamber)          | exists                                                                                                                                                      |
| `prXmax`              | `OpenISDBox` (PR chamber)          | exists                                                                                                                                                      |
| `tempK`               | `OpenISDProject` environment       | exists                                                                                                                                                      |
| `humidityPct`         | `OpenISDProject` environment       | exists                                                                                                                                                      |
| `pressurePa`          | `OpenISDProject` environment       | exists                                                                                                                                                      |
| `eg`                  | `OpenISDProject`                   | exists — `driveVoltage_V()`                                                                                                                                 |
| `alfaVC`              | driver embedding                   | exists — `alfaVC_per_K`, its own array-level field, independent of the driver's own datasheet `alfaVC_per_K`                                                |
| `wiring`              | driver embedding                   | exists — its own array-level `'series' \| 'parallel'` field, independent of `VCCon` (a single driver's own coil wiring)                                     |
| `circuitModel`        | driver embedding                   | exists                                                                                                                                                      |
| `Rs`                  | driver embedding                   | exists — `Rs_ohm`                                                                                                                                           |
| `nDrivers`            | driver embedding                   | exists                                                                                                                                                      |
| `vcTempRise`          | driver embedding                   | exists — `vcTempRise_K`                                                                                                                                     |
| `driverAddedMass`     | driver embedding                   | exists — `driverAddedMass_kg`                                                                                                                               |
| `tlPortModel`         | `OpenISDBox` (vent)                | exists — `useTransmissionLinePortModel`                                                                                                                     |
| `rgAtDriverSide`      | `OpenISDProject` (advanced)        | exists                                                                                                                                                      |
| `filters`             | `OpenISDProject`                   | exists                                                                                                                                                      |
| `useWinisdAirModel`   | app-level (`presentationState.ts`) | new — John: "app level setting"; stays a genuinely external `sweep()` input alongside `fmin`/`fmax`/`N`, never a project record field                       |
| `forceFlatResponse`   | `OpenISDProject` (advanced)        | exists                                                                                                                                                      |
| `flatMaxBoostDb`      | **not set** by `#sweepParams()`    | `#sweepParams()` never populates this key, letting the engine apply its own default — no project record field                                               |
| `fmin`                | external (UI)                      | stays a `sweep()` parameter                                                                                                                                 |
| `fmax`                | external (UI)                      | stays a `sweep()` parameter                                                                                                                                 |
| `N`                   | external (UI)                      | stays a `sweep()` parameter                                                                                                                                 |
| `power_W`/`voltage_V` | `OpenISDProject` (signal)          | new — `powerDrive_W()`/`statedVoltage_V()`/`setPowerDrive_W()`/`setDriveVoltage_V()`, cross-solving via `Engine.driveVoltage()`/`Engine.driveFromVoltage()` |

`sweep(P)`/`maxCurves(P)`/`validateParams(P)` take only `FrequencyGrid` (`{fmin?, fmax?, N?}`,
exported from `domain/index.ts`); `#sweepParams()` assembles the full `SweepParams` from the
project's own record. `packages/design/test/engine-wiring.test.ts` builds real driver and
passive-radiator fixtures via `conformingRecordToOpenIsdDriver`/`conformingRecordToOpenIsdPassiveRadiatorStandalone` and
compares `project.sweep()` against a manual `engine.sweep()` call with matching `Ql`/`Qa`.
`useWinisdAirModel` stays an app-level (`presentationState.ts`) `sweep()` input alongside
`fmin`/`fmax`/`N`, per the row above.
