# BUG_20261017_air-has-hidden-sources

**Status:** RESOLVED (T527, 21 Oct 2026). Hits 1 and 5 closed by T366; hits 2-4, 6, 7 and 9 were already gone (T372-T375); hit 8 fixed and hit 10 is the owner; all pinned by `architecture-air-has-no-hidden-source.test.ts`.

## Symptom
Air (ρ and c) can come from a place nobody named. A project with its own air, switched to a passive radiator,
gets a starting radiator Vas worked out in factory air (20 °C, 30 %, 101325 Pa), not the project's.
John, 17 Oct 2026: "there is no default air"; "there should not be a case where air comes from a hidden
source"; "no method is allowed to get it direct from the app settings as a side effect at all".

## Rule
Air comes from its owner, as an argument. A driver's air is the app's or typed. A project's air is its own,
or the app's when it has none. The app's air reaches a driver or a project through one named source built in
`main.ts`. No calculation, hook or domain method reads the app setting, and none fills a missing condition
with a constant.

## Hits (audit 17 Oct 2026)
| # | Where | What it does |
|---|---|---|
| 1 | `PrEngine.vas()` and `cmsFromVas()` | `solveEnvironment({})`: factory air. Live caller: `openISDBox.ts` starting radiator Vas. FIXED T366: both take an `Air`; the box passes the project's. Test `air-has-no-hidden-source.test.ts`; gate `architecture-air-has-no-hidden-source.test.ts` |
| 2 | `engine/air.ts` `airFor()` | fills a missing tempK, humidityPct or pressurePa from `DEFAULT_*_REF_*` | **CLOSED (stale): `airFor` takes a full required `AirEnvironment`; no fallback. Gate: no `DEFAULT_*_REF_*` outside `air.ts`, `appSettings.ts`, `index.ts`.** |
| 3 | `SweepParams` tempK, humidityPct, pressurePa optional | `port.ts`, `circuit.ts` (two), `SimulationEngine.ts` run in factory air when a caller leaves them out | **CLOSED (stale): no optional tempK/humidityPct/pressurePa anywhere in design or ui/src. Gate pins it.** |
| 4 | `createEnvironmentAir` `advAir` (`OriginalShell-hooks.ts`) | `value ?? undefined`: a blank project condition shows factory air in the Advanced readouts | **CLOSED (stale): `createEnvironmentAir` reads the project's five air fields; no `?? undefined`, no app read.** |
| 5 | `winisd/winisdProject.ts` | template literals `T 293.15, p 101325, phi 0.3`. CHECKED T366: the converter supplies T, p, phi from the project's air, so the template value is never written for a project export; pinned by a test |
| 6 | `EnvironmentEngine.defaults` | holds `AppSettings`, publishes `envDefaults` read at call time | **CLOSED (stale): `EnvironmentEngine` hands the project an `AppAir` at construction; `defaults()` is read only by the Options editor and tests.** |
| 7 | `projectEnvironment.ts` | each project air field falls back to `engine.defaults()` itself | **CLOSED (stale): the project fills a blank field once from `engine.environment.appAir` (copied as E), not from `defaults()`.** |
| 8 | `openISDDriver.ts` standalone driver | air wired as `() => engine.environment.defaults()` | **CLOSED T527: standalone driver air is `engine.environment.appAir` c and rho (the app's air, per the rule). Gate: no `environment.defaults(` in design source.** |
| 9 | `createEnvironmentAir` and three phone hooks | read `appState.envDefaults()` | **CLOSED (stale): the phone hooks use `createEnvironmentAir` over the project; none reads `envDefaults`.** |
| 10 | `OptionsModal-hooks.ts` | reads `settings.envDefaults()` to fill the editor | **CLOSED (owner): the Options editor reads the app setting it edits; that is the setting's owner, not a calculation.** |

## Open questions for John (relayed by fable)
Per-field or all-or-nothing project air; live or fixed when Options changes; what the saved file records;
whether a driver inside a project uses the project's air; the air of a .wpr import that has none.
No behaviour that these would change is changed until John answers.

## Fix
Required `AirEnvironment` with all three conditions; no `??` fallback in `airFor`; `AppAirSource` interface;
`main.ts` builds the one instance; Advanced tab says "from project" or "from app"; architecture test:
no `solveEnvironment({})`, no optional environment fields, no `DEFAULT_*_REF_*` outside the app setting's
initialiser, no read of the app's environment outside `main.ts`.
