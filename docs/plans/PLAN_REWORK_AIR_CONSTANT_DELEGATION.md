# Air-constant delegation rework — c/roo/VCCon/numVC calculated defaults

Companion to `bugs/BUG_20260905_c_roo_vccon_calculated_default_only_visible_at_wdr_export_not_on_the_driver_getter.md`
(the defect this plan fixes) · `ARCHITECTURE.md` §3 (driver model) · `engine/air.ts` (the air
model itself, unchanged by this plan) · `.claude/rules/engine.md` (calculation-logic sign-off).

## 1. The defect

`driver.spec[section].c_m_per_s.get()`, `.roo_kg_per_m3.get()` and `.VCCon.get()` all report
`{value: null, state: 'not-available'}` when the record states nothing, even though each has a
real, always-available calculated default:

- `c`/`roo` — the live physical air model at reference conditions (`engine/air.ts`'s `airFor`).
- `VCCon` — WinISD's documented default of parallel wiring (`docs/spec/SPEC_ENGINE.md:424`,
  `"VCCon=1"`).
- `numVC` — WinISD's documented default of 1 coil (same line, `"numVC=1"`).

Today the calculated default for all four exists ONLY inside
`openIsdDriverToWinIsdDriver` (`winisd/driverYmlToOpenisdAndWdr.ts`), which runs at `.wdr`
export time. Any caller reading the driver directly — the UI, `solveConsistencyGroup`'s own
inputs, a test — sees a hole instead of the value WinISD itself always shows.

## 2. `VCCon`/`numVC` — no blocker, do first

Neither field needs an `Engine` reference; both defaults are static constants.

| Step                                                                                                                                                            | Where                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Remove the inline `{value: '1', state: 'not-available'}` literal in `wdrVCCon()`                                                                                | `winisd/driverYmlToOpenisdAndWdr.ts:431-440` |
| Remove the inline `{value: '1', state: 'calculated'}` literal for `numVC`                                                                                       | `winisd/driverYmlToOpenisdAndWdr.ts:506-508` |
| Add `calcVCCon(): VoiceCoilWiring` returning `VoiceCoilWiring.Parallel`, and `calcNumVC(): number` returning `1`                                                | `domain/project.ts`, near `wiringFromRecord` |
| `DriverSpecsSection`'s `wiring()`/`f('numVC')` builders report the calculated value instead of `not-available` when the record states nothing                   | `domain/project.ts:1154-1199`                |
| `wdrVCCon()` and the exporter's `numVC` line read `spec.VCCon.get()`/`spec.numVC.get()` and serialize whatever state/value comes back — no local literal at all | `winisd/driverYmlToOpenisdAndWdr.ts`         |

Single source of truth for each: the exporter never decides these facts, it only serializes
what the driver reports.

## 3. Reference-air fallback consolidation — same batch, no blocker

Five call sites independently call `moistAirDensity`/`moistAirSoundVelocity` with
`DEFAULT_T_REF_K`/`DEFAULT_RH_REF_PCT`/`DEFAULT_P_REF_PA` instead of through `air.ts`'s own
`airFor({})`, which already does exactly this:

| Site                                                  | Current                                          | Change                                                                  |
| ----------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `engine/solver.ts:33-34` (`driverC`'s final fallback) | `moistAirSoundVelocity(DEFAULT_T_REF_K, ...)`    | call `airFor({}).c`                                                     |
| `engine/solver.ts:42` (`driverRho`'s fallback)        | `moistAirDensity(DEFAULT_T_REF_K, ...)`          | call `airFor({}).rho`                                                   |
| `engine/boxDesign.ts:31-32` (`refRho`/`refC`)         | inline `moistAirDensity`/`moistAirSoundVelocity` | wrap `airFor({}).rho`/`.c`, or delete and call `airFor({})` at each use |
| `engine/formulas.ts:17-18` (`prVas`)                  | inline pair                                      | one `airFor({})` call                                                   |
| `engine/formulas.ts:60-61` (`prCmsFromVas`)           | inline pair                                      | one `airFor({})` call                                                   |

`driverC()`/`driverRho()`'s own record-aware logic (stated `c` → derived from stated `roo` →
reference air) is real business logic, not duplication, and is unchanged — only the final
fallback line switches to `airFor({})`.

**Verification:** `air.test.ts`, `advanced-figures.test.ts`, `consistency.test.ts` pin exact
WinISD-oracle values (`343.684120962152`/`1.20095217714682` etc.) — full pass required, no
numeric change expected since the same constants and functions are still what gets called.

## 4. c/roo — three-tier environment lookup, blocked on a design decision

### The three tiers that exist today

| Tier    | Holds                                                                                                             | Where                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Driver  | `c_m_per_s`/`roo_kg_per_m3` — the driver's OWN stated value                                                       | `domain/project.ts:1131-1132`, `Field<number>`                                                                                                                           |
| Project | `temperature_K`/`humidity_pct`/`pressure_Pa`, each `number \| null`                                               | `domain/project.ts:393-397` (`OpenISDEnvironmentJson`), read at `:993-998` — used today only by `sealedResonanceFn()`'s Fsc/Qtc readout, never by the driver's own c/roo |
| App     | `envDefaults: {tempK, pressurePa, humidityPct}`, a Vue `reactive()` singleton with editable Options-dialog values | `packages/ui/src/logic/presentationState.ts:18-19,56` (`AIR_CONSTANTS_APP_DEFAULT`)                                                                                      |

Confirmed: temperature/humidity/pressure are used for nothing else anywhere in the codebase —
only for computing `c`/`roo` via `airFor`.

### Target behaviour

- Driver states `c` (or `roo`, from which `c` derives) → use it. Unchanged.
- Driver states neither, driver is embedded in a project → ask the engine for `airFor()` using
  **the project's own environment** (falling further back to the app's, per below, if the
  project's own fields are unset).
- Driver states neither, driver is standalone (My Drivers entry, bundle row, detached copy) →
  ask the engine for `airFor()` using **the app's environment**.

### Refill-on-clear behaviour (project tier)

If a human clears the project's own temperature/humidity/pressure fields (back to `null`),
those fields refill from the app-level defaults rather than sitting `null`. This is UI/project
state behaviour, not something the driver's own getter does.

### The structural question this needs a ruling on

`OpenISDDriverEmbedded.wrap()` (`domain/project.ts:1550-1554`) currently takes only a `Lens`
onto the project's driver slot, by deliberate choice — its own comment: _"The project owns that
slot and builds the lens, so the driver needs no reference back to the project."_ That was a
local implementation choice, not an architectural constraint (`ARCHITECTURE.md` does not forbid
a driver knowing its project) — confirmed 2026-09-05, giving `OpenISDDriverEmbedded` a project
reference does not violate layering.

`OpenISDDriverStandalone` (`:1529-1541`) has no project because there is none to have; it needs
the app-level provider instead, and `packages/design` has no import path to
`packages/ui`'s `presentationState.ts` — that provider must be handed in from the UI side, not
reached for from inside the domain.

### Proposed shape (subject to sign-off before implementation)

1. Introduce a small provider abstraction — e.g. `AirConstantProvider` returning
   `{tempK, humidityPct, pressurePa}` or equivalent — that both a project and the app-level
   Options state can satisfy structurally, without `packages/design` importing anything from
   `packages/ui`.
2. `OpenISDDriverEmbedded.wrap()` takes an `AirConstantProvider` sourced from the project's own
   environment (reversing the current "no reference back" comment).
3. `OpenISDDriverStandalone.wrap()` takes an `AirConstantProvider` the caller supplies —
   `packages/ui` passes the app-level `envDefaults` when constructing a standalone driver from
   UI code (My Drivers list, bundle browsing).
4. `c_m_per_s`/`roo_kg_per_m3`'s field builders in `DriverSpecsSection` gain access to whichever
   provider their owning `OpenISDDriver` holds, and call `engine.airFor(provider)` instead of
   reporting `not-available` when the record states nothing.
5. Project-level refill-on-clear: whatever owns the project's environment fields (the Options
   dialog / project settings UI) watches for a field going `null` and repopulates it from
   `presentationState.ui.envDefaults` — implemented in `packages/ui`, not `packages/design`.

### Open questions before implementation

- Exact shape/name of the provider abstraction, and which package declares its interface
  (`packages/design` should declare the interface; `packages/ui` supplies the app-level
  implementation).
- Whether `OpenISDDriver` (the base class) gains the provider, or only the two subclasses —
  affects whether `c_m_per_s`/`roo_kg_per_m3`'s builders live in the base constructor or are
  overridden per subclass.
- Whether `conformingRecordToDriver`'s signature needs to grow a provider parameter, and what
  every existing call site (tests, `driverYmlToOpenisdAndWdr.ts`, the UI) passes when it has no
  natural provider to hand (a bare fixture, an export path with no live UI).

## 5. Sequencing

Section 2 and 3 have no blockers and can proceed immediately. Section 4 waits on the open
questions above being ruled on.
