# Test review — removed tests, 2026-10-04

Every test removed in the test reorg, with the kept test that covers it or why it tested nothing. Rules: [TESTING_STRATEGY.md](../../TESTING_STRATEGY.md).

## design

| removed test (file › title) | reason | kept test that covers it |
|---|---|---|
| engine/sweep.test.ts › flags an isolated non-finite point as a warn that names the frequency | DUPLICATE | classify-finite › is classified as a warn, never as a blocking error + names the frequency where the curve is undefined (stronger: checks the exact frequency text) |
| engine/sweep.test.ts › flags pervasive breakdown even when spl is the finite −200 sentinel (the Vb=0 shape) | DUPLICATE | classify-finite › a breakdown at every frequency is an error even where spl holds the finite -200 sentinel (real Vb=0 sweep, same error level) |
| engine/hardening.test.ts › a −200 dB silence sentinel is finite data and is never reported as a singularity | DUPLICATE | classify-finite › an all-finite sweep with -200 dB silence sentinels is still null |
| engine/hardening.test.ts › a clean sweep of a valid design reports nothing — the guard does not cry wolf | DUPLICATE | classify-finite › returns null for an all-finite sweep |
| domain/winisd-abc-intra-port-velocity.test.ts › on and off differ by a small dropped term: 1.36 dB at 110 Hz at most, under 0.1 dB away from 80-150 Hz | DUPLICATE | engine/abc-large-qiclfr-winisd › switch off differs from the abc-w5-1 capture by 0.14 relative (1.35 dB) at most + switch on matches the abc-w5-1 capture at 1e-9 (same project, same switch, against WinISD itself) |
| domain/winisd-abc-intra-port-velocity.test.ts › with a very large inter-chamber leak Q, on and off agree to 1e-9 | DUPLICATE | engine/abc-intra-port-velocity › a very large inter-chamber leak Q: on and off agree to 1e-9; engine/abc-large-qiclfr-winisd › the gap between switch off and on shrinks as 1/Qiclfr |
| domain/winisd-pr-npr-resonance.test.ts › moves the Npr 2 impedance, and not the Npr 1 one | DUPLICATE | engine/pr-npr-resonance › switch on differs from off at Npr 2 + Npr 1: on and off are identical; engine/driver-count-winisd › passive-radiator box (project with the switch on, against the WinISD capture) |
| domain/winisdCountAndFlatModels.test.ts › on: two drivers show one driver's impedance, whatever the wiring | DUPLICATE | engine/driver-count-winisd › every box type matches the WinISD capture with winisdDriverCountModel at its default (on), impedance included |
| domain/winisdCountAndFlatModels.test.ts › on: the transfer function is flat at 1 Hz | DUPLICATE | engine/force-flat-response-winisd › transfer function (≤1e-12 dB) against the WinISD capture with winisdFlatModel at its default (on) |
| vent-pr-group-stubs.test.ts › notifyVentChanged() runs without throwing — the store calls it on every project change | POINTLESS | asserts only "does not throw"; domain/project-vent-solve › Vent solver group derives C/N/E state... asserts the result of the same call |
| vent-pr-group-stubs.test.ts › notifyVentChanged() derives vent length when tuning_goal_hz is entered | DUPLICATE | domain/project-vent-solve › Vent solver group derives C/N/E state, value and structural DQ atomically (length calculated, > 0, dq empty — stronger) |
| vent-pr-group-stubs.test.ts › notifyPrChanged() runs without throwing | POINTLESS | asserts only "does not throw"; domain/project-pr-solve › PR solver group derives C/N/E state... asserts the result of the same call |
| solver-group-pr-vent.test.ts › Engine exposes pure solveDriverConsistencyGroup, and notifyVentChanged | POINTLESS | asserts only that two test-solver outputs are defined / > 0; engine/vent-consistency › writes the derived length onto its handle... and engine/pr-consistency › writes the derived added mass... assert the values |
| engine/dq-issue-text.test.ts › missing-dependencies names the target and the routes | DUPLICATE | engine/dq-issue-text › renders a missing-dependencies issue as "<target> cannot be calculated yet - state <routes>." (exact full sentence, target, route and missing field) |
| engine/dq-issue-text.test.ts › inconsistent-inputs states the disagreement | DUPLICATE | engine/dq-issue-text › renders an inconsistent-inputs issue as "<fields> disagree by <pct>: <formula>. Every field..." (exact full sentence) |
| engine/tf-silence.test.ts › the passband reference of an all-silent curve is 0 | DUPLICATE | engine/passband-ref › returns 0 for an all-sentinel curve rather than -200 |
| engine/issueHelpers.test.ts › a driver-field breach names the field and the physical limit | DUPLICATE | engine/issueHelpers › outOfRange › names the field, its value, and the limit it fell below (identical expectation) |
| engine/issueHelpers.test.ts › a vented-alignment breach names the design band instead | DUPLICATE | engine/dq-issue-text › states the band a value fell outside (asserts the value and both band edges; this one asserted only /plausible/) |
| engine/dq-issue-text.test.ts › out-of-range names the field, the value and the limit | DUPLICATE | engine/issueHelpers › outOfRange › names the field, its value, and the limit it rose above (exact sentence) |
Kept, doubtful (not removed):

- domain/winisd-bessel-highpass › moves the system response through a Bessel high-pass, and not without one: engine/bessel-highpass-switch pins the effect, but only through the engine; this is the only test that the project switch reaches the sweep.
- domain/winisdFlatModel › off: the boost is capped, so 1 Hz stays rolled off, and domain/winisdDriverCountModel › off: two drivers in series show four times the parallel impedance: engine tests pin the engine effect directly; these two prove the project field reaches the engine in the off direction.
- domain/winisdVaModel › off: ... and domain/winisdWrapPhase › toggles phase wrapping in sweep results: no engine/ test pins these effects.
- engine/dq-issue-text › each factory decides the text at construction: a weaker cross-kind smoke test, overlapped by the per-kind sentence tests; kept because it also covers missingDependencies with an empty route list.

## uiunit

| removed test (file › title) | reason | kept test that covers it, or why it tests nothing |
|---|---|---|
| ui/test/logic/cursor-lock.test.ts › clicking an unlocked chart locks the cursor at that frequency | POINTLESS | re-implements the click handler inline (if/else on project fields); imports no click module. Cursor field defaults/round trip: design/test/domain.test.ts "cursorF/pinnedF/cursorLocked/dragRange default to unset and round-trip" |
| cursor-lock.test.ts › single click somewhere else while locked moves cursor to new location and unlocks | POINTLESS | same inline re-implementation |
| cursor-lock.test.ts › clicking near the already pinned location unlocks the cursor | POINTLESS | same inline re-implementation |
| cursor-lock.test.ts › editorModelValue resolves SKU over long model text | POINTLESS | helper function defined inside the test, no source module |
| cursor-lock.test.ts › spinning frequency nudge buttons moves frequency logarithmically | POINTLESS | helper `spinHz` defined inside the test; the real step is FrequencyAxis.step, tested in design/test/chart/axis.test.ts |
| cursor-lock.test.ts › verifies that de-fld fields have width constraint fit-content | POINTLESS | asserts string literals defined in the test against themselves |
| cursor-lock.test.ts › verifies that the de-comment box has a full-width layout constraint | POINTLESS | asserts a string literal defined in the test against itself |
| cursor-lock.test.ts › verifies that rgAtDriverSide is unchecked (false) by default | MOVED (not removed) | now newProject.test.ts › starts with Rg not at the driver side |
| hooks/GraphPanel-hooks.test.ts › createMockGraphPanelAPI › returns default mock values for graph panel | POINTLESS | asserts the test helper's (a src mock factory's) own default values; real hook covered by the useGraphPanel describe in the same file |
| hooks/GraphPanel-hooks.test.ts › createMockGraphPanelAPI › accepts partial overrides | POINTLESS | asserts the mock factory returns the override it was handed |
| design fields/field-registry.test.ts (was ui/logic/field-registry) › lists the whole band as options for a count | DUPLICATE | field-registry.test.ts › vent_Count offers 1..4 ports (same countOptions 1..4 assertion plus precision and description) |
| (kept, doubtful) persistence/projectRepo.test.ts › open projects shared between tabs › a tab hears another tab save its open projects; viewStateRepo.test.ts › a tab hears another tab save the view | none removed | ui/logic/sessionSync.test.ts › adopts the open projects / adopts the view another tab saves proves hearing end to end, but the repo tests pin hear-exactly-once at the repo layer, and adoption is a different behaviour; kept at both layers |

## original

| removed test (file › title) | reason | kept test that covers it, or why it tests nothing |
|---|---|---|
| original-skin › Signal tab: Driver input voltage is editable and drives System input power | DUPLICATE | original-signal-tab › entering a voltage derives the power V²/(Re+Rs) on blur and keeps it (stronger: asserts the exact law and the committed domain value) |
| signal-commits-as-blur-notification › entering a voltage makes the power derive to V²/Re on blur | DUPLICATE | original-signal-tab › entering a voltage derives the power V²/(Re+Rs) on blur and keeps it |
| signal-commits-as-blur-notification › deleting the voltage re-derives it from P and Re on blur | DUPLICATE | original-signal-tab › clearing V returns the pair to the 1 W reference (same clear-V rule, asserts the domain P and V) |
| signal-drive › upping the power moves the voltage; clearing the voltage returns the pair to the 1 W reference | DUPLICATE | original-signal-tab › moving the power moves the voltage… and › clearing V returns the pair to the 1 W reference |
| signal-defaults › BUG 1/2: system input power shows a value and moving it moves the voltage | merged, not removed | original-signal-tab › both cells are filled… + › moving the power moves the voltage… |
| signal-defaults › BUG 4/5: the power↔voltage pair stays coupled and positive | DUPLICATE | original-signal-tab › entering a voltage derives the power… and › clearing V returns the pair to the 1 W reference (the "No drive level stated" title assertion was carried into the clear-V test) |
| env-defaults › BUG 8: clearing an environment field cannot blank it | DUPLICATE | original-advanced-tab › deleting any environment field drops the stored value and shows the app default as calculated (superset: all three fields, entered/calculated classes) |
| env-defaults › BUG: the sample project (minimal driver record) also shows the air constants | DUPLICATE | original-advanced-tab › a project's stored temperature, humidity and pressure are shown + › air density is shown beside sound velocity (same sample environment, same 343.99 / 1.19885) |
| env-defaults › wizard-built project: air constants move with pressure… (the uncheck-"WinISD air model", RH 100 tail only) | DUPLICATE | original-advanced-tab › unticking "WinISD air model" switches the readouts to the moist-air physics model (same RH 100 → 1.19358 / 344.74 assertions) |
| app › app shell renders — project nav and graph are populated | DUPLICATE | original-shell › choosing Original swaps to the ported WinISD shell (asserts the root, projects, signal generator and graph panel) |
| app › box type change to sealed re-renders enclosure panel | DUPLICATE | original-box-tab › sealed Fsc/Qtc readouts re-render… and › the Box tab exposes all six box types (Qtc is read and the sealed diagram shown) |
| app › box type change to vented shows vent controls | DUPLICATE | original-vented-tab › a 30L box with a 5cm bore… (types into Vent diameter and Fb target on the Vented tab) |
| app › share link encodes state in URL hash | DUPLICATE | share-link › the Export menu's Share link writes the design into the address bar (asserts the same hash `s=`) |
| original-skin › the Vented pane labels the tuning readout "1st port resonance" | DUPLICATE | original-vented-tab › the Vented "1st port resonance" shows the vent pipe resonance (locates the field by that label text) |
| original-skin › a project is closed by selecting its row then Close | DUPLICATE | original-project-list › Close test |
| original-skin › the toolbar shows the build version chip | DUPLICATE | original-toolbar › exact version |
| original-skin › chosen skin is remembered across a reload | DUPLICATE | skin-selection |
| modal-escape › Escape dismisses the driver library modal | DUPLICATE | modal-behaviour › true modals (library closes with Escape) |
| driver-editor-mandatory › every Parameters input reports its E/C/N state | DUPLICATE | driver-editor-provenance › All input fields on Parameters tab render valid E/C/N provenance classes (same value-e/c/n check, fuller) |

## mobile

| removed test (file › title) | reason | kept test that covers it, or why it tests nothing |
|---|---|---|
| mobile-box-tab › switching to a never-used box type defaults its volume instead of showing 0 | DUPLICATE | mobile-box-tab › switching box type › from vented, switching to sealed then passive radiator both work immediately (same seed, COMPLETE_DRIVER_PROJECT_OWPR vented, then select sealed, same not-0.00/not-empty volume assertions, plus the passive radiator leg) |
| mobile-driver-tab › Select driver opens the driver browser overlay | DUPLICATE | mobile-driver-browser › the driver picker fills the short viewport instead of clamping to a fixed height (taps Select driver, asserts `.overlay.on .wb-modal` visible, then a stronger height assertion) |
