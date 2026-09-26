# PLAN — FIX_WIZARD_SEALED (New Project wizard: WinISD step order + EBP on box-type)

**Status: LANDED 2026-09-21 (commits e06274b, 714fd43 + follow-ups) — §8 tasks 1–7 done; hook +
thin shell + 10 hook tests + both browser specs green. Q1 LANDED 2026-09-21: the library body is
`DriverLibrary.vue`, rendered by the `DriverBrowser.vue` overlay and inline as wizard step 1
(no "Select Driver..." button; `embedLibrary()` keeps the Use→wizard handoff armed until the
wizard closes; Q2 gating holds). Remaining: Q3 deferred by John. Execution tracked in
`PLAN_WIZARD_AND_TESTS.md`.**

**Priority (John, 2026-09-20): Sealed (this plan) ships first. Vented alignment is HIGH
PRIORITY next, but only starts once sealed is correct — do not parallelise the two.** §5's
"no vented alignment step" is this plan's scope only, not a final ruling — it is the next plan
once this one lands. See `archive/FIX_WIZARD_VENTED.md` (done 2026-09-22) and `FIX_WIZARD_VENTED-remains.md`.

## 1. Goal

The New Project wizard's step order does not match WinISD's, and the wizard is missing the
Efficiency Bandwidth Product (EBP) readout WinISD shows on its box-type step. Bring the wizard
to WinISD's flow, adding one improvement John asked for: show the calculated sealed volume on
the alignment step (already true of our existing "Choose Sealed Alignment" dialog) AND show the
EBP suitability readout (already true of that same dialog) one step earlier, on the box-type
step — so the user sees "Sealed preferred / Vented preferred" before picking a box type, not
after.

Target flow (WinISD order — screenshots below):

1. Select driver for project
2. Number of drivers and placement (Normal / Iso-Barik)
3. Type of design (box type) — **+ EBP value + suitability readout**
4. Sealed Alignment — **only when box type is Closed/sealed** — alignment dropdown + calculated
   volume + EBP readout
5. Project Information (name + description)

Previous / Next / Cancel on every step; Next becomes "Create" on the last step.

## 2. Reference screenshots (WinISD)

| Step | Screenshot |
|---|---|
| 1 Select driver | [new_project_wizard_1_select_driver.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_1_select_driver.png) |
| 2 Num/placement | [new_project_wizard_2_num_placement.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_2_num_placement.png) |
| 3 Box type + EBP | [new_project_wizard_3_box_type.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_3_box_type.png) |
| 4 Sealed alignment | [new_project_wizard_4_sealed_alignment.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_sealed_alignment.png) |
| 4 Vented alignment (WinISD only — not built here, §5) | [new_project_wizard_4_vented_allignment.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_4_vented_allignment.png) |
| 5 Project info | [new_project_wizard_5_name.png](http://localhost:8000/winisd/openisd/docs/winisd_screenshots/new_project_wizard_5_name.png) |

## 3. Current state (facts)

| Fact | Where |
|---|---|
| Wizard is Project name → Box type → Volume → **Pick Driver (popup, last)** — reverse of WinISD's order | [OgNewProject.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue) |
| No EBP / suitability readout anywhere in the wizard | same file |
| The wizard has **no hook file** — all logic (`pickDriver`, project construction, step state) lives inline in the `.vue`, against the [ui.md](http://localhost:8000/winisd/openisd/.claude/rules/ui.md?html) rule (one hook per component) | same file |
| `ebp()` / `ebpSuitability()` are pure engine functions, already used by an existing dialog | [boxDesign.ts:43,70](http://localhost:8000/winisd/openisd/packages/design/engine/boxDesign.ts#L43) |
| The "Choose Sealed Alignment" dialog (Box tab, **not** the wizard) already shows alignment dropdown + calculated volume + EBP + suitability label ("Sealed preferred" / "Vented preferred" / "Either") — this is the pattern John wants copied one step earlier | [OriginalShell.vue:698-718](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OriginalShell.vue#L698), hook: [SealedAlignment-hooks.ts](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/SealedAlignment-hooks.ts) |
| Sealed alignment options (0.500 → 1.500) already match WinISD's list exactly | [options.ts:43-53](http://localhost:8000/winisd/openisd/packages/design/fields/options.ts#L43) |
| `project.nDrivers` / `project.wiring` already exist and are edited today on the **Driver tab** (not the wizard); Iso-Barik placement is a disabled radio marked "(not modelled)" | [OriginalShell.vue:352-366](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OriginalShell.vue#L352) |
| No vented/6th-order/ABC alignment table exists in the engine — only a single QB3 auto-tune formula (`ventedAlignment()`). WinISD's vented-alignment dropdown (QB3/BB4/C4/EBS3/EBS6) has no equivalent here | [boxDesign.ts:76-85](http://localhost:8000/winisd/openisd/packages/design/engine/boxDesign.ts#L76) |
| `BoxTypeDiagram.vue` already draws the box-type SVGs the wizard and Box tab share | [BoxTypeDiagram.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/BoxTypeDiagram.vue) |
| `DriverBrowser.vue` (994 lines) is the existing full driver picker, today opened as a follow-up popup via `driverBrowsing.openPickerFor(cb)` at the end of the wizard | [DriverBrowser.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverBrowser.vue), [driverBrowsingState.ts:435](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L435) |
| Two browser specs and one logic test pin the CURRENT step order and will fail once it changes | [wizard-defaults.browser.spec.ts](http://localhost:8000/winisd/openisd/packages/ui/test/ui/wizard-defaults.browser.spec.ts), [wdr-opens-wizard.browser.spec.ts](http://localhost:8000/winisd/openisd/packages/ui/test/ui/wdr-opens-wizard.browser.spec.ts), [newProject.test.ts](http://localhost:8000/winisd/openisd/packages/ui/test/logic/newProject.test.ts) |
| Sibling components are mid-migration to the hook-per-component pattern right now, **uncommitted, another session's work** — do not touch `AdvancedOptions.vue`/`DiagnosticsModal.vue`/`PRBrowser.vue` or their new hook test files while doing this plan | git status at plan time |

## 4. Target step order

| # | Label | Content | Gate to advance |
|---|---|---|---|
| 1 | Select driver for project | Embedded driver picker (existing `DriverBrowser.vue` surface — search tree, preview, Add New, Load) | A driver is selected |
| 2 | Number of drivers and placement | `nDrivers` select (existing `N_DRIVERS_OPTIONS`) + Normal/Iso-Barik radio (Iso-Barik **disabled**, "(not modelled)" — same wording as the Driver tab today) + wiring select + `BoxTypeDiagram`-style driver placement art | none (optional, defaults given) |
| 3 | Type of design | Box type select (`newProjectBoxTypeOptions()`) + `BoxTypeDiagram` + **EBP value + suitability readout** (from the step-1 driver's Fs/Qes — computed the moment a driver exists, box type not required) | none |
| 4 | Sealed Alignment — **shown only when box type = Closed(sealed)** | Alignment dropdown (`SEALED_ALIGNMENT_OPTIONS`) + calculated volume (L) + EBP + suitability readout (same three pieces as the existing Box-tab dialog, computed wizard-locally from the step-1 driver's Qts/Vas/Fs/Qes — no project exists yet at this point) | none |
| 5 | Project Information | Name (required) + description | Name non-empty, same as today |

Every step keeps Previous / Next / Cancel; step 5's Next becomes Create. Going back and forward
must not lose what was entered on a step already visited (WinISD keeps "Selected driver" visible
at the top of every later step — reuse that header).

## 5. Explicit non-goals (keep the shape John asked for, nothing wider)

- **No vented/6th-order/ABC alignment step.** WinISD offers one for those types; openisd's engine
  has no alignment table behind them (§3). Vented/bandpass4/passive-radiator keep today's
  wizard defaults (35 Hz tuning target, 5 cm port) unchanged. Only Closed/sealed gets the new
  step 4, because that is the only alignment table that exists and the only one John asked for.
- **No PR-params wizard step** (WinISD screenshot `new_project_wizard_4_pr_params.png`). Passive
  radiator keeps today's `defaultPassiveRadiator()` auto-fill; not requested.
- **No isobarik acoustic modelling.** The radio stays disabled, exactly as it is on the Driver
  tab today — this plan does not add box-volume-halving or compound-chamber modelling.

## 6. Open questions for John (before writing code)

| # | Question | Why it matters |
|---|---|---|
| Q1 | Embed the full `DriverBrowser.vue` (994 lines: search, preview, My Drivers, Load, Add New) as step 1's content, or a slimmed-down picker built just for the wizard? | Full reuse is less code and stays in sync with the standalone picker; but it's a big component to inline into a 5-step modal and its "Use" button semantics (closes to a live project) need adapting to "advance to step 2" instead. |
AGREED BY JL 

| Q2 | Can step 1's Next fire before a driver is chosen? WinISD's screenshot shows Next enabled with a driver already highlighted in the tree (a default selection), not genuinely gated. | Decides whether the wizard needs a "no driver picked yet" empty state or always pre-selects the first available driver. |
NO IT CANNOT FIRE 

| Q3 | Two existing, separate paths set `newProjectDriver` and auto-open the wizard with a driver already attached, skipping today's driver-pick step entirely: (a) choosing ANY driver — bundled catalog or a saved "My Driver" — from the picker while no project is open ([driverBrowsingState.ts:422](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L422)), and (b) importing a `.wdr` or `.owdr` file from disk while no project is open ([useApplicationIO.ts:198](http://localhost:8000/winisd/openisd/packages/ui/src/logic/useApplicationIO.ts#L198)). (b) is genuinely rare — most users hit (a), picking a bundled driver. With driver-pick now step 1 instead of the last step, does either path skip step 1 straight to step 2, or does step 1 still show, pre-selected to that driver? | Changes `wdr-opens-wizard.browser.spec.ts`'s expected step order, and decides whether path (a) needs its own test too (today only (b) is covered). |
OPEBING A WDR/OWDR  FILE OFF DISK SHOJLD NOT FIRE UP THE PROJECT - IT SHOULD OPEN AN IMPORT OPTION TO ADD THE DRIVER TO THE MyDrivers via the DriverEditor diablog where it can be reviewed before savinf.
DEFERRED - Single route only as per WinIsd model
 

## 7. Files touched

| File | Change |
|---|---|
| [OgNewProject.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OgNewProject.vue) | Rewritten: 5 steps in new order, template/wiring only |
| `packages/ui/src/hooks/OgNewProject-hooks.ts` (new) | All step state, gating, EBP/suitability computeds, sealed-alignment computeds, project construction — extracted per [ui.md](http://localhost:8000/winisd/openisd/.claude/rules/ui.md?html) |
| [BoxTypeDiagram.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/BoxTypeDiagram.vue) | Reused as-is on steps 2 and 3 |
| [DriverBrowser.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverBrowser.vue) / [driverBrowsingState.ts](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts) | Reused for step 1, per Q1's answer |
| [boxDesign.ts](http://localhost:8000/winisd/openisd/packages/design/engine/boxDesign.ts), [Engine.ts](http://localhost:8000/winisd/openisd/packages/design/engine/Engine.ts) | No change expected — `ebp`/`ebpSuitability`/`sealedQtcFromVolume`/`sealedFromQtc`/`closestSealedAlignment`/`sealedAlignmentOptions` already public on `Engine` |
| `packages/ui/test/hooks/OgNewProject-hooks.test.ts` (new) | Layer-2 tests |
| [wizard-defaults.browser.spec.ts](http://localhost:8000/winisd/openisd/packages/ui/test/ui/wizard-defaults.browser.spec.ts), [wdr-opens-wizard.browser.spec.ts](http://localhost:8000/winisd/openisd/packages/ui/test/ui/wdr-opens-wizard.browser.spec.ts) | Rewritten for new step order |
| [newProject.test.ts](http://localhost:8000/winisd/openisd/packages/ui/test/logic/newProject.test.ts) | Checked/updated if it asserts old step order |

## 8. Task list

- The New Project dialog MUST ask the user to pick a driver first, before any box or volume choice, when a new project is started.
- The New Project dialog MUST show "Number of drivers" and "Placement" (Normal / Iso-Barik) as its second step, with Iso-Barik shown but not selectable, when a new project is started.
- The New Project dialog MUST show the Efficiency Bandwidth Product and a "Sealed preferred / Vented preferred / Either" readout on the Type of design step, once a driver has been picked.
- The New Project dialog MUST show a Sealed Alignment step, with the alignment dropdown, the calculated box volume, and the EBP readout, only when Closed is the chosen box type.
- The New Project dialog MUST skip straight from Type of design to Project Information when a box type other than Closed is chosen.
- The New Project dialog MUST let the user move back to any earlier step without losing what they already entered there.
- The New Project dialog MUST keep Previous, Next, and Cancel available on every step, with Next reading "Create" only on the last step.
- Opening a driver file with no project open MUST start the wizard with that driver already in place — DEFERRED (Q3): John wants a file open to go to a DriverEditor import into My Drivers instead; single route per WinISD. Not done here.
- The New Project dialog MUST create a vented / passive-radiator / bandpass project at the starting volume the user typed on the Type of design step, never at the sealed-alignment volume (done, 714fd43).

## 9. Testing plan (TDD — `tdd.md`)

1. **Layer 1 (unit, `packages/design`)** — no new engine behaviour; existing `ebp`/`ebpSuitability`/
   sealed-alignment tests keep passing unchanged. Confirm before starting: run the design suite.
2. **Layer 2 (hook)** — new `OgNewProject-hooks.test.ts`: step index transitions and gating; EBP/
   suitability computed correctly from a fixture driver; sealed-alignment volume/EBP computed
   wizard-locally (no project) matches the same formula the Box-tab dialog uses; step 4 is absent
   from the step sequence for every non-sealed box type.
3. **Layer 3 (UI, hook mocked)** — template shows the right step for a given mocked hook state;
   Previous/Next/Cancel call the right hook methods; Create is only reachable on step 5.
4. **Layer 4 (browser)** — rewrite the two existing specs end-to-end through the new step order;
   assert the EBP text is visible on step 3 and the alignment step is visible only when Closed is
   picked.

Every step of this plan is red→green: write the failing test at its layer, watch it fail for the
right reason, implement, watch it pass, then run `npm run typecheck` and the affected suites
before commit — no exceptions, per [verify.md](http://localhost:8000/winisd/openisd/.claude/rules/verify.md?html).
