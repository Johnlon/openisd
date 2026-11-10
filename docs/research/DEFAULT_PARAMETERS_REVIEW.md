# Default parameter values: review of every one

Date: 10 Nov 2026. Branch t750. Source: counting test `packages/design/test/architecture-no-default-parameters.test.ts` (71 defaults in shipped source).
Caller counts are from a type-aware scan: calls that leave the argument out, split into shipped source and tests. Rough, not exact (calls through a variable are missed).

## Summary
- HIDES CONTEXT 22, POLICY 8, CONVENIENCE 39, TEST-ONLY 2.
- Worst: the app-context defaults (`= realAppContext`) on OpenISDProject, ProjectBuilder, OpenISDDriver.empty and the passive-radiator standalone; the T744 class.
- Also bad: `createAnnouncementCenter` defaults to the TEST server; `createEngine` defaults to factory settings; Tune limits default to none.
- Most added by: no task id (34), T607 (4), T622 (4), T391 (3), T619 (3), T460 (2). 34 carry no task id (pre-task-era commits; 7 are in the 25 Sep release squash ade563bb6c, author lost).
- Most defaults are relied on only by tests; shipped source relies on few. Remove HIDES CONTEXT first, then POLICY.

## HIDES CONTEXT (22)
Stands in for something that differs by caller: app, project, settings, clock, services. Most severe.

| file:line | function | default | added by (commit, date, task) | why | callers relying on it |
|---|---|---|---|---|---|
| packages/design/domain/passiveRadiator/openISDPassiveRadiatorStandalone.ts:23 | OpenISDPassiveRadiatorStandalone.empty | `appContext: AppContext = realAppContext` | 1e14c809c4, 2026-09-29, Passive-radiator objects no longer carry | Which app stamps a new passive radiator. Same bug class as T744. | 3 src, 12 test (of 18 refs) |
| packages/design/domain/winIsdProjectConverter.ts:255 | WinIsdProjectConverter.WinIsdProjectConverter | `private readonly driverFromRecord: DriverFromRecord = OpenISDDriver.fromConformingRecord` | e9b57f2f2d, 2026-10-30, T619 | Same parser choice as above. | 3 src, 119 test (of 123 refs) |
| packages/design/engine/Engine.ts:87 | createEngine | `settings: AppSettings = defaultAppSettings` | 7e2fee41fe, 2026-09-28, Engine is an interface; createEngine is  | Which app settings the engine reads (air, units). Forgetting it gives factory settings, not the user's. Only 3 non-test callers, 858 test calls lean on it. | 3 src, 858 test (of 881 refs) |
| packages/design/domain/driverRecordConverter.ts:611 | DriverRecordConverter.DriverRecordConverter | `private readonly driverFromRecord: DriverFromRecord = OpenISDDriver.fromConformingRecord` | e9b57f2f2d, 2026-10-30, T619 | Which parser turns a record into a driver. Default is the strict conforming one; callers wanting another must say so. | 2 src, 73 test (of 76 refs) |
| packages/design/domain/openisdTransforms.ts:28 | ProjectBuilder.ProjectBuilder | `appContext: AppContext = realAppContext` | ade563bb6c, 2026-09-25, 25 Sep squash (author lost) | Which app (clock, ids) stamps the project being built. Same bug class as T744. | 2 src, 217 test (of 223 refs) |
| packages/design/domain/project/openISDProject.ts:668 | OpenISDProject.fromOwprText | `appContext: AppContext = realAppContext` | 3019b187b4, 2026-10-31, T622 | Which app stamps the project (Modified date, ids). Forgetting it silently uses the real app. T744 was exactly this on a sibling wrap. | 2 src, 58 test (of 61 refs) |
| packages/ui/src/logic/presentationState.ts:176 | cycleTraceColor | `open: readonly OpenISDProject[] = []` | 62151d66e3, 2026-10-29, T607 | The projects currently open. Default is none, so a forgotten list hides open projects. | 2 src, 3 test (of 9 refs) |
| packages/design/domain/project/openISDProject.ts:677 | OpenISDProject.fromOwprTextRepairing | `appContext: AppContext = realAppContext` | 3019b187b4, 2026-10-31, T622 | Which app stamps the project (Modified date, ids). Forgetting it silently uses the real app. T744 was exactly this on a sibling wrap. | 1 src, 13 test (of 14 refs) |
| packages/ui/src/logic/toneGenerator.ts:75 | createToneGenerator | `makeCtx: () => ToneCtx = () => new AudioContext()` | e80081a8e, 2026-07-06, Initial commit: OpenISD (squashed, no pr | Where the browser audio device comes from. Default grabs the real one; an app service. | 1 src, 1 test (of 3 refs) |
| packages/design/chart/series.ts:448 | seriesFor | `lines: ReferenceLineColors = DEFAULT_REFERENCE_LINE_COLORS` | 8f90ea6e2b, 2026-10-18, T391 | Colours of the 0 dB and -3 dB lines. The user sets these in Options; the default is the factory colour, so a caller that forgets it ignores the user's setting. | 0 src, 11 test (of 16 refs) |
| packages/design/domain/driver/openISDDriver.ts:72 | OpenISDDriver.empty | `appContext: AppContext = realAppContext` | 3019b187b4, 2026-10-31, T622 | Which app (date, id source) the new driver is stamped by. Forgetting it gives the real clock and ids, even in a copy that must not. | 0 src, 96 test (of 101 refs) |
| packages/design/domain/driverRoundTripDiffs.ts:233 | DriverRoundTripCheck.DriverRoundTripCheck | `private readonly driverFromRecord: DriverFromRecord = OpenISDDriver.fromConformingRecord` | e9b57f2f2d, 2026-10-30, T619 | Same parser choice as above. | 0 src, 2 test (of 4 refs) |
| packages/design/domain/openisdTransforms.ts:36 | ProjectBuilder.empty | `appContext: AppContext = realAppContext` | 8af39ceb73, 2026-09-29, ProjectBuilder is the way a project is m | Which app (clock, ids) stamps the project being built. Same bug class as T744. | 0 src, 94 test (of 102 refs) |
| packages/design/domain/project/openISDProject.ts:467 | OpenISDProject.wrap | `appContext: AppContext = realAppContext` | fe02bfd915, 2026-09-27, (auto) Domain: openisdDomain.ts split by | Which app stamps the project (Modified date, ids). Forgetting it silently uses the real app. T744 was exactly this on a sibling wrap. | 0 src, 1 test (of 3 refs) |
| packages/design/domain/project/openISDProject.ts:481 | OpenISDProject.wrapWithIdentity | `appContext: AppContext = realAppContext` | eb503a499d, 2026-09-29, The project stamps its own Modified date | Which app stamps the project (Modified date, ids). Forgetting it silently uses the real app. T744 was exactly this on a sibling wrap. | 0 src, 0 test (of 2 refs) |
| packages/design/domain/project/openISDProject.ts:486 | OpenISDProject.wrapSession | `appContext: AppContext = realAppContext` | 3019b187b4, 2026-10-31, T622 | Which app stamps the project (Modified date, ids). Forgetting it silently uses the real app. T744 was exactly this on a sibling wrap. | 0 src, 0 test (of 2 refs) |
| packages/design/domain/project/openISDProject.ts:887 | OpenISDProject.tune | `limits: TuneLimits = TuneLimits.NONE` | 6d611c68ac, 2026-10-21, T525 | Which Tune limits apply. Limits differ by project and app; default NONE means no limit and no amber/red warning. | 0 src, 8 test (of 9 refs) |
| packages/design/domain/project/tuneView.ts:98 | tuneViewOf | `limits: TuneLimits = TuneLimits.NONE` | 6d611c68ac, 2026-10-21, T525 | Same Tune-limits choice as above. | 0 src, 0 test (of 1 refs) |
| packages/ui/src/logic/announcementCenter.ts:109 | createAnnouncementCenter | `endpoints: AnnouncementEndpoints = announcementEndpointsForHostname('test.openisd.app')` | 7e2fe0305f, 2026-10-26, T608 | Which announcements server to ask. Default is the TEST server; a production caller that forgets it reads test announcements and never fails. | 0 src, 4 test (of 6 refs) |
| packages/ui/src/logic/appVersion.ts:69 | createAppVersionPort | `publicVersion: Promise<string> = Promise.resolve('')` | 7b167949cf, 2026-10-15, T194 | Where the public version number comes from. Default is an empty string, so a forgotten source shows a blank version. | 0 src, 14 test (of 18 refs) |
| packages/ui/src/logic/sweepTransport.ts:14 | sweepTransport | `onWorkerFault: (fault: Error) => void = () => {}` | 17210d7e04, 2026-11-01, T639 | Where a sweep worker's error goes. Default throws it away, which hides crashes. | 0 src, 0 test (of 3 refs) |
| packages/ui/src/ui/canvas.ts:24 | drawOne | `style: DrawStyle = DESKTOP_DRAW_STYLE` | 35923cb9a4, 2026-10-21, T513 | Desktop or phone drawing style. Default is desktop, so a phone caller that forgets it draws the desktop look. | 0 src, 0 test (of 0 refs) |

## POLICY (8)
A real app value that should be one named constant passed explicitly.

| file:line | function | default | added by (commit, date, task) | why | callers relying on it |
|---|---|---|---|---|---|
| packages/design/domain/schemaVersion.ts:53 | upgradeToCurrent | `current: number = CURRENT_SCHEMA_VERSION` | b2cff1209e, 2026-11-05, T668 | The current stored-data version number. A named constant exists; pass it. Also a test seam. | 4 src, 6 test (of 11 refs) |
| packages/design/domain/schemaVersion.ts:53 | upgradeToCurrent | `steps: readonly UpgradeStep[] = UPGRADE_STEPS` | b2cff1209e, 2026-11-05, T668 | The list of upgrade steps. A named list exists; pass it. Also a test seam. | 4 src, 6 test (of 11 refs) |
| packages/design/domain/box/openISDBox.ts:76 | startVentGeometry | `roundDiameter_m: number = STARTING.ventDiameter_m` | 192b2df2c5, 2026-10-07, bp6/ABC step 1: a new 6th-order bandpass | Starting vent diameter of a new box. | 2 src, 0 test (of 5 refs) |
| packages/ui/src/logic/telemetry/errorContext.ts:58 | RecentActions.RecentActions | `private readonly capacity: number = MAX_ACTIONS` | 76ceb0b248, 2026-10-16, T229 | How many recent actions an error report keeps. | 2 src, 7 test (of 9 refs) |
| packages/design/fields/spinnerStep.ts:86 | spinValue | `speed: SpinSpeed = 'fine'` | 0feaa61f21, 2026-10-07, Spinner steps: ~1% a tap, 10% after a 1  | Spinner speed class; "fine" is the start speed. | 1 src, 22 test (of 27 refs) |
| packages/design/domain/box/openISDBox.ts:737 | OpenISDBox.resetVentedAlignment | `alignment: VentedAlignment = STARTING.ventedAlignment` | 1122d93608, 2026-10-01, Clearing Target Tuning Freq (or Vent len | Starting vented alignment of a new box. | 0 src, 2 test (of 2 refs) |
| packages/design/engine/vent/VentEngine.ts:64 | VentEngineImpl.lengthForTuning | `endCorrection: number = END_CORRECTION` | 7037119559, 2026-09-28, Engine areas: vent — VentEngine holds po | Port end correction factor (a physics constant used by WinISD). | 0 src, 10 test (of 16 refs) |
| packages/design/engine/vent/VentEngine.ts:72 | VentEngineImpl.tuningFromLength | `endCorrection: number = END_CORRECTION` | 7037119559, 2026-09-28, Engine areas: vent — VentEngine holds po | Port end correction factor (a physics constant used by WinISD). | 0 src, 11 test (of 17 refs) |

## CONVENIENCE (39)
Saves typing a value that is almost always the same.

| file:line | function | default | added by (commit, date, task) | why | callers relying on it |
|---|---|---|---|---|---|
| packages/design/fields/phoneText.ts:27 | PhoneHelpSection.PhoneHelpSection | `readonly links: readonly HelpLink[] = []` | b6cb9e743e, 2026-11-01, T640 | No help links. | 94 src, 1 test (of 116 refs) |
| packages/design/engine/driver/routes/SolveRoute.ts:34 | SolveRoute.SolveRoute | `readonly relation: Relation \| null = null` | 461129a063, 2026-10-04, (auto) Driver solver componentised: rela | Route has no relation. | 54 src, 0 test (of 55 refs) |
| packages/design/engine/driver/routes/SolveRoute.ts:33 | SolveRoute.SolveRoute | `readonly keepsNonPositive: boolean = false` | 73cef4189c, 2026-10-03, (auto) Driver solver: 54 routes as data  | Non-positive results are dropped. | 53 src, 0 test (of 55 refs) |
| packages/design/engine/driver/routes/SolveRoute.ts:32 | SolveRoute.SolveRoute | `private readonly guard: (v: WithInputs<I>) => boolean = () => true` | 73cef4189c, 2026-10-03, (auto) Driver solver: 54 routes as data  | Route always applies. | 22 src, 0 test (of 55 refs) |
| packages/design/domain/cell.ts:93 | calculatedCell | `precision: number \| null = null` | 3e165ce2dd, 2026-10-02, (auto) Field decimals: at least WinISD's | Number of decimals; null means use the field's own. | 14 src, 6 test (of 21 refs) |
| packages/design/engine/driver/routes/Relation.ts:23 | Relation.Relation | `readonly modelTolerance: number = 0` | 6c6630bc3f, 2026-10-19, T460 | Zero tolerance. | 14 src, 1 test (of 16 refs) |
| packages/design/engine/driver/routes/Relation.ts:24 | Relation.Relation | `readonly onlyWhenTargetEntered: boolean = false` | 6c6630bc3f, 2026-10-19, T460 | Applies whether or not the target was typed. | 14 src, 1 test (of 16 refs) |
| packages/design/fields/field.ts:1472 | ToggleField.ToggleField | `breakAfter: string \| null = null` | 3c0043853d, 2026-10-05, Advanced tab: compat groups side by side | No line break after the field. | 14 src, 0 test (of 16 refs) |
| packages/design/domain/cell.ts:89 | enteredCell | `precision: number \| null = null` | ade563bb6c, 2026-09-25, 25 Sep squash (author lost) | Number of decimals; null means use the field's own. | 12 src, 3 test (of 18 refs) |
| packages/design/fields/sheetField.ts:74 | SheetField.SheetField | `readonly whatIfLabel: string \| null = null` | 62151d66e3, 2026-10-29, T607 | No What-if label. | 12 src, 0 test (of 18 refs) |
| packages/design/fields/sheetField.ts:72 | SheetField.SheetField | `readonly portTitle: string \| null = null` | ea13f9d1d1, 2026-10-16, T209 | No port title. | 8 src, 0 test (of 18 refs) |
| packages/ui/src/hooks/NumInput-hooks.ts:55 | fmt | `halfWidth: number \| null \| undefined = props.halfWidth` | f5d27ba0c4, 2026-11-08, T727 | Use the props half-width. | 8 src, 0 test (of 9 refs) |
| packages/design/fields/field.ts:1472 | ToggleField.ToggleField | `seenIn: string \| null = null` | 3c0043853d, 2026-10-05, Advanced tab: compat groups side by side | No "seen in" note. | 6 src, 0 test (of 16 refs) |
| packages/persistence/src/repos/layoutMigration.ts:45 | migrate | `onStep = () => undefined` | 4b17e81bb7, 2026-10-13, T055/T058 | Ignore migration progress. | 5 src, 4 test (of 12 refs) |
| packages/design/domain/cell.ts:486 | pairedField | `partnerDefault: number \| null = null` | d9127210ca, 2026-10-17, T275 | The other number of a paired field; null means none. | 4 src, 3 test (of 12 refs) |
| packages/design/domain/driverRecordConverter.ts:472 | openIsdDriverToWinIsdDriver | `dqLines: readonly string[] = []` | ade563bb6c, 2026-09-25, 25 Sep squash (author lost) | No data-quality note lines. | 4 src, 12 test (of 16 refs) |
| packages/ui/src/hooks/NumInput-hooks.ts:647 | beginRepeat | `pressedAt = performance.now()` | 62151d66e3, 2026-10-29, T607 | Saves typing the usual value. | 3 src, 0 test (of 4 refs) |
| packages/design/chart/layout.ts:35 | ChartLayout.font | `bold: boolean = false` | 760a3bd9f0, 2026-10-17, T348 | Plain font unless asked. | 2 src, 1 test (of 6 refs) |
| packages/design/engine/air.ts:94 | within | `aboveMin = false` | 588b436d78, 2026-11-01, T637 | Lower bound inclusive. | 2 src, 0 test (of 3 refs) |
| packages/design/engine/circuit.ts:102 | solve | `fDriver: number = f` | 888998d408, 2026-10-05, ABC group delay: WinISD bug switch "Enab | Driver frequency equals the chart frequency (differs only for the WinISD ABC group-delay bug). | 2 src, 0 test (of 3 refs) |
| packages/design/fields/readoutFormat.ts:27 | ReadoutFormat.text | `tokens: Readonly<Record<string, string>> = {}` | 0b83bcea8d, 2026-10-04, WIP: not mine, committed so nothing stay | No substitution tokens. | 2 src, 11 test (of 18 refs) |
| packages/design/engine/simulation/SimulationEngine.ts:307 | classifyArrays | `opts: { allowPositiveInfinity: boolean } = { allowPositiveInfinity: false }` | e200fa3a79, 2026-09-28, Engine areas: simulation and box — Simul | No chart options. | 1 src, 0 test (of 2 refs) |
| packages/ui/src/logic/appState.ts:640 | doSweep | `withMax = true` | b97903bb27, 2026-10-12, appState: createAppState(deps) factory a | Include the maximum. | 1 src, 0 test (of 2 refs) |
| packages/ui/src/logic/driverSelection.ts:189 | editProjectDriver | `showDisagreements = false` | 3783402048, 2026-11-05, T662 | Do not list disagreements. | 1 src, 0 test (of 2 refs) |
| packages/design/chart/series.ts:447 | seriesFor | `bare = false` | 8f90ea6e2b, 2026-10-18, T391 | Draw the full chart unless asked for the bare one. | 0 src, 10 test (of 16 refs) |
| packages/design/chart/series.ts:504 | buildPlotData | `errors: DriverError[] = []` | ade563bb6c, 2026-09-25, 25 Sep squash (author lost) | No driver errors to mark on the chart. | 0 src, 21 test (of 24 refs) |
| packages/design/chart/series.ts:505 | buildPlotData | `opts: { bare?: boolean; primaryColor?: string; referenceLines?: ReferenceLineColors } = {}` | 8f90ea6e2b, 2026-10-18, T391 | No chart options. | 0 src, 21 test (of 24 refs) |
| packages/design/domain/passiveRadiator/openIsdPassiveRadiatorSpec.ts:36 | OpenIsdPassiveRadiatorSpec.OpenIsdPassiveRadiatorSpec | `conflicts: () => readonly PrSpecIssue[] = () => []` | 3f8ab91109, 2026-10-04, (auto) ABC velocity switch defaults to W | No radiator conflicts. | 0 src, 0 test (of 1 refs) |
| packages/design/engine/complex.ts:3 | cx | `im = 0` | e80081a8e, 2026-07-06, Initial commit: OpenISD (squashed, no pr | Imaginary part zero. | 0 src, 0 test (of 126 refs) |
| packages/design/engine/consistency.ts:241 | requiredPositiveIssue | `fill: FillRoute = 'none'` | 6815f5c82f, 2026-10-06, (auto) Chart legend lists 0 dB/-3 dB lin | No fill route. | 0 src, 1 test (of 2 refs) |
| packages/design/engine/signal/SignalEngine.ts:28 | driveVoltage | `rs: number = 0` | b2ef483bf8, 2026-09-28, Engine areas: environment, driver, signa | Zero series resistance (Rg). Note: Rg is project data; a caller that forgets it silently drops Rg. | 0 src, 0 test (of 0 refs) |
| packages/design/engine/signal/SignalEngine.ts:36 | driveFromVoltage | `rs: number = 0` | b2ef483bf8, 2026-09-28, Engine areas: environment, driver, signa | Zero series resistance (Rg). Note: Rg is project data; a caller that forgets it silently drops Rg. | 0 src, 0 test (of 3 refs) |
| packages/design/fields/field.ts:239 | NumberField.spinRule | `spin: FieldSpin = this.spin` | ecd3f1c209, 2026-10-22, T561 | Use the field's own spin rule. | 0 src, 14 test (of 16 refs) |
| packages/design/fields/readoutFormat.ts:35 | ReadoutFormat.textSI | `tokens: Readonly<Record<string, string>> = {}` | 618ee13fd4, 2026-10-17, T364 | No substitution tokens. | 0 src, 3 test (of 5 refs) |
| packages/design/winisd/winisdDriver.ts:195 | WinISDDriver.build | `dqLines: readonly string[] = []` | ade563bb6c, 2026-09-25, 25 Sep squash (author lost) | No data-quality note lines. | 0 src, 2 test (of 17 refs) |
| packages/ui/src/hooks/OriginalProjectList-hooks.ts:255 | openColourPicker | `doubleClick = false` | 62151d66e3, 2026-10-29, T607 | Single click. | 0 src, 0 test (of 1 refs) |
| packages/ui/src/hooks/OriginalShell-hooks.ts:487 | spinHz | `factor = 1.02` | ade563bb6c, 2026-09-25, 25 Sep squash (author lost) | Saves typing the usual value. | 0 src, 0 test (of 5 refs) |
| packages/ui/src/logic/driverSelection.ts:172 | editMyDriver | `uuid = ''` | ade563bb6c, 2026-09-25, 25 Sep squash (author lost) | No driver uuid (new driver). | 0 src, 0 test (of 0 refs) |
| packages/ui/src/logic/viewport.ts:40 | createViewportWatch | `query = PHONE_LAYOUT_QUERY` | 9c457e48b9, 2026-11-05, T681 | Saves typing the usual value. | 0 src, 4 test (of 5 refs) |

## TEST-ONLY (2)
Exists so tests can call shorter.

| file:line | function | default | added by (commit, date, task) | why | callers relying on it |
|---|---|---|---|---|---|
| packages/persistence/src/storage/keyValueStorage.ts:69 | createSharedMemoryStorage | `initial: Record<string, string> = {}` | 9f416acdf6, 2026-09-26, (auto) update drive voltage status in WI | Seed contents of an in-memory store. Only used so tests can call shorter; app code uses the browser store. | 0 src, 19 test (of 20 refs) |
| packages/persistence/src/storage/keyValueStorage.ts:101 | createMemoryStorage | `initial: Record<string, string> = {}` | 4b17e81bb7, 2026-10-13, T055/T058 | Seed contents of an in-memory store. Only used so tests can call shorter; app code uses the browser store. | 0 src, 135 test (of 283 refs) |

## Notes
- Constants such as STARTING.*, END_CORRECTION, PHONE_LAYOUT_QUERY already exist, so the POLICY ones need only the caller to pass them.
- Several rows were classed by reading the code around them; a few CONVENIENCE rows (series resistance `rs`) could be argued as HIDES CONTEXT.
