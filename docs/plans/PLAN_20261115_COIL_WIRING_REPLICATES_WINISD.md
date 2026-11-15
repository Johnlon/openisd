# Plan: one wiring control, as WinISD has it (QO941)

Written 15 Nov 2026 for John, to read on a phone. Short sentences on purpose.

Labels used for WinISD facts:

- **observed**: seen in WinISD's code, files or screens. The finding file or run is named.
- **documented**: WinISD's own help text, quoted.
- **inferred**: worked out from the above, not seen. Every inferred statement below is marked "to be confirmed by reverse engineering (in progress)": one agent is reading the WinISD executable, another is running WinISD under Wine.

Every OpenISD statement names the file it comes from.
WinISD research files live in `winisd_research` (written `R/` below).

## (a) The question, in John's words

- "Connection in the project view is meant to be my projects use of the driver ie my wiring" (QO941.c11).
- "this is a bug as far as I'm concerned ... the driver wiring is the measured setup, the project wiring is the usage of the driver" (QO941.c14).
- "VcCon is obviously just how the driver coils are connected to each other as far as I'm concerned not the two drivers connection, BUT maybe I'm wrong and yes maybe for multiple drivers there is need for more settings - write it up - for now replicate winisd" (QO941.c24).
- "openisd is meant to replicate WinISD so that sounds like a bug" (QO941.c21).

## (b) What WinISD does

1. **The control.** The project Driver tab has "Voice coil connection", next to "Num. of drivers".
   It is the wiring of ONE driver's voice coils.
   Observed: `R/runs/nd-1/01_tab_driver.png` (greyed with one coil). That the project box fires the same Re and BL rewrite as the editor's box is inferred, to be confirmed by reverse engineering (in progress): only the editor's handler was decompiled.
   Observed: `R/findings/FINDING_20261005_multi-driver-impedance-is-one-drivers.md` ("it is the per-driver multi-coil setting").
2. **Greyed with one coil.** Observed (same screenshot; greyed state with more than one driver is inferred, to be confirmed by reverse engineering (in progress)). With two coils it is live (`R/toys/qo96_vccon_impedance.py` docstring).
3. **Flipping it rewrites the stored Re and BL in place.**
   Parallel to series: BL times N, Re times N squared. Series to parallel: the inverse.
   Observed in code: `R/GHIDRA_FINDINGS.md` l.994-996 (handler at 0x461242).
   Observed in a probe: Re 6, BL 8, two coils, Series gives 24 and 16; three coils 54 and 24; four coils 96 and 32 (`R/PROBE_FINDINGS.md` l.3348-3363, run vccon-probe-20261005).
   Only Re and BL change. Le and Znom do not (inferred: nothing in the findings says they do; to be confirmed by reverse engineering (in progress), see point 4 of section (f)).
4. **The rewrite is the only effect.** The simulation never reads the coil count or the connection. Observed: `R/PROBE_FINDINGS.md` FINDING-009 and `R/findings/FINDING_20261019_numvc-is-not-a-simulation-input.md`.
   The impedance chart moved when the project box was changed, because the stored Re moved (observed: `R/runs/qo96_vccon_live/results.jsonl`, peak 12 to 48 ohm, times 4).
5. **Editing the coil count afterwards puts the box back to Parallel and does not undo the rewrite.** Observed: `R/PROBE_FINDINGS.md` l.3348-3363. Series, edit the count, Series again gives Re times 16 (`docs/research/WINISD_PARITY.md` l.978).
6. **A file only carries a label.** Four `.wpr` files with 1, 2, 2 and 4 coils and connection 1, 1, 2, 1 hold the same Re and BL. Observed: `R/runs/qo96_dvc/*.wpr`. Loading never rescales.
   The project file has `[Driver] numVC`, `[Driver] VCCon` and `[Box] Nd`. It has no project-level connection key. Observed: same runs.
7. **No control for wiring several drivers.** N drivers are N copies, each in Vb/N, each fed P/N.
   The impedance chart is ONE driver's: 18.609 ohm peak at 1 and at 4 drivers. SPL rises 6.02 dB at 4. Maximum power times 4. VA is the whole array's.
   Observed: `R/findings/FINDING_20261005_multi-driver-impedance-is-one-drivers.md`.
8. **What its help says.** `docs/winisd_helpfiles/help/newdriver.html` l.137-143, documented:
   "Connection mode can be changed by changing the combobox selection. The driver editor then converts Bl and Re values accordingly."
   and "If you enter resistance for parallel connection and get about half of advertised Bl, then you know that Bl was specified that way."
   So WinISD itself tells the user to type the published figures and use the box to match the maker's wiring.
9. **Two coils in the project box and two drivers together (case d).** Inferred only: the coil rewrite acts on each driver, and the driver count acts on top. Never observed; to be confirmed by reverse engineering (in progress). See (f).

## (c) What OpenISD does today

1. **The driver keeps the maker's wiring as data.** `VCCon` is series, parallel or unknown. Re, BL, Le and Znom are stored as published.
   `docs/FIELD_REFERENCE.md` l.83-100, `packages/design/domain/driver/openIsdDriverSpec.ts` (`terminalMotor`, `solverParams`).
2. **"My wiring" converts.** Project field `driverEmbedding.coilWiring` (`packages/design/domain/openisdSchema.ts`, optional, absent means the measured wiring). `packages/design/domain/project/projectCoilWiring.ts` holds the choice and the words. The conversion is `convertWiring` (series to parallel: Re, Le, Znom divided by N squared, BL divided by N).
   Only the amplifier side reads it. The stored figures are never changed.
3. **The project's "Voice coil connection" is something else: it wires SEVERAL drivers.**
   Field `driver_ArrayWiring` (`packages/design/fields/field.ts`, "How several drivers (Num. of drivers) are joined to the amplifier"), stored as `driverEmbedding.wiring` (`openisdSchema.ts` l.925), default parallel (`packages/design/domain/openisdTransforms.ts` l.165).
   The engine applies it: in series the coil resistance and the BL push are multiplied by n (`packages/design/engine/circuit.ts` l.91-93, l.107), and the impedance chart is scaled by n (series) or 1/n (parallel) when the WinISD per-driver switch is off (`packages/design/engine/simulation/SimulationEngine.ts` `arrayImpedanceScale`, l.216-222).
   WinISD does none of this (section (b) point 7).
4. **The two controls sit one above the other on the Driver tab.** Desktop: `packages/ui/src/ui/shells/original/OriginalShell.vue` (label "Voice coil connection", then the coil block). Phone: `MobileDriverTab.vue` (label "Connection"). They read alike and mean different things. That is the confusion John saw.
5. **The per-driver impedance improvement.** `docs/research/ACCURACY_IMPROVEMENTS.md` row "More than one driver: the impedance chart shows one driver's impedance" says: OpenISD shows "the array's impedance per the project's wiring (divided by N parallel, times N series)"; the yellow switch "Per-driver impedance" brings WinISD's figure back.
   Who decided: John, 4 Oct 2026, listed "the per-impedance" among the straight WinISD bugs that get a yellow switch (`CLAUDE.md`, "WinISD controls behave as native WinISD"); the engine comment cites "John, 2026-10-05" (`SimulationEngine.ts` l.218). Commit 64a18829 (5 Oct 2026). Bug record `bugs/archive/BUG_20261005_winisd-multi-driver-impedance-is-one-drivers.md`.
   The new-project default is the switch OFF, so the array's impedance is shown (`openisdTransforms.ts` l.200 `winisdDriverCountModel: false`).
6. **What a `.wpr` carries today.** Written: `[Box] Nd`, and `[Driver] VCCon` with the figures converted to "My wiring" (`packages/design/domain/winIsdProjectConverter.ts` l.273 `driverAtMine`, l.308). Not written: the array wiring. It is in no `.wpr`.
   Read: `[Box] Nd` (l.595) and the driver block through the driver importer, which reads `VCCon` as the driver's measured wiring (`packages/design/domain/winIsdDriverImport.ts`). The project's coil wiring stays absent, so it follows the measured wiring. The array wiring is not read; a loaded project gets parallel.
7. **A WinISD-difference list entry for the coil rewrite does not exist.** `packages/design/fields/winisdFixedBug.ts` and `winisdDifferenceSection.ts` do not mention it (research report section 4).

## (d) The end state John ruled

- The driver's wiring is the measured setup. It is data of the driver and is edited only in the driver editor ("Coil wiring").
- The project's wiring is how the project uses the driver. There is ONE control for it.
- The measured wiring is not shown on the Driver tab at all (QO941.c1 onwards).
- WinISD's in-place rewrite of Re and BL is a WinISD bug. OpenISD fixes it: the published Re and BL are never overwritten. It is listed (section (g) item 4).
- "For now replicate WinISD": with more than one driver OpenISD shows what WinISD shows by default.
- Wiring of several drivers to the amplifier is not a control now. It is ticket https://github.com/Johnlon/openisd/issues/519.

The one control:

- Reads and writes `driverEmbedding.coilWiring` (the field "My wiring" uses today). No new field.
- Default: the driver's measured wiring (the field is absent until the user picks).
- Label: phone skin "My wiring". Desktop skin "Voice coil connection", in WinISD's place beside "Num. of drivers" (decision of the lead).
  One control, one field, two labels by skin.
  Label rules: a desktop label that is WinISD's own is the normal case (`packages/design/fields/desktopHelp.ts` `VOICE_COIL_CONNECTION`). The phone label is OpenISD's own, as other phone labels are (`PhoneLabels`). Neither needs a new parity entry. The desktop tooltip must say what it does, and the register row for it must be right (section (g) item 3).
- Shown for a driver with more than one coil whose measured wiring is known. This is the removal PR (T831) and is already built.
- WinISD greys it with one coil. OpenISD today shows nothing for one coil and nothing for an unknown wiring. Open point for John: on the desktop skin only, show it greyed with one coil, as WinISD does? Proposal: yes on desktop (parity with the screen), no on phone.

## (e) What several drivers might need later (open questions, no design)

All of this is ticket https://github.com/Johnlon/openisd/issues/519.

- The load the amplifier sees: series or parallel across the drivers. WinISD shows one driver's impedance and never says.
- Mixed wiring: coils inside each driver, and the drivers to each other. One control cannot say both (research report, "Ambiguity").
- Isobaric: the "Iso-Barik" radio is disabled and says "not modelled" (`OriginalShell.vue` l.473). John: "we don't yet support isobaric so we just go ahead for now with each on the baffle" (QO941.c16). The radio changes nothing today (a local value only, `OriginalShell-hooks.ts` l.701). Proposal: leave it as WinISD shows it, greyed.
- Whether each driver gets its own source resistance and cable, which decides whether series and parallel differ in power at all.

## (f) Still unobserved in WinISD

From the research report. Another agent is running WinISD under Wine. Leave this space for its results.

1. The project box's own effect on stored Re and BL (not only the chart). Probe: load a two-coil `.wpr`, change the box, save, read `[Driver] Re` and `BL` (expect Re times 4, BL times 2).
2. Two drivers and two coils together (case d): impedance, SPL, VA, against two drivers with one coil.
3. MX6-22 end to end: two coils, Series, type 4.7 / 12.3 / 0.37, read Qes, Re, BL, then Parallel; then type the same with the default Parallel and compare Qes.
4. Whether the box scales Le and Znom. Code says no.
5. Round trip: an OpenISD dual-coil `.wdr` run in WinISD, curves compared.

**WINE RESULTS GO HERE (not yet filled in):**

- Point 1: pending.
- Point 2: pending.
- Point 3: pending.
- Point 4: pending.
- Point 5: pending.

## (g) The migration (a proposal, not decided)

Everything in this section is a proposal. It rests on WinISD behaviour that is still being confirmed by reverse engineering (in progress); nothing here is built.

### 1. Saved projects

- A project with one driver: numbers do not change. Array wiring does nothing with one driver (`circuit.ts` l.91, n is 1).
- A project with more than one driver and array wiring parallel (the default): the impedance chart changes if the answer to (g) item 5 below is "WinISD's figure by default". Other charts do not.
- A project with more than one driver and array wiring series: its impedance (and, where `circuit.ts` applies it, the BL push) changes. This must be visible, not silent. Proposal: on load, a one-time note on the Driver tab: "This project wired its N drivers in series. OpenISD no longer wires drivers together, so the charts now match WinISD. See issue 519." The setting is kept in the file, unused, so nothing is lost and a later feature can read it. John to confirm.
- The schema keeps `wiring` (optional from now, ignored). No schemaVersion bump is needed if it stays accepted; a decision for the implementer with the persistence tests.

### 2. `.wpr` and `.wdr`

- Today: see (c) point 6. WinISD's `[Driver] VCCon` is the coil connection, as the label for the stored Re and BL.
- After: unchanged in what is read and written.
  Read: `VCCon` becomes the driver's measured wiring (as today); the project's coil wiring stays absent.
  Written: the figures converted to the project's coil wiring, with that wiring as `VCCon` (as today). A `.wdr` keeps the published figures with the measured wiring.
- Never written or read: the array wiring.

### 3. Tests and goldens that change

Found by search; the implementer re-greps. Each change names its evidence.

- `packages/design/test/domain/winisdDriverCountModel.test.ts`: series versus parallel impedance (four times). Changes with the answer to item 5.
- `packages/design/test/engine/sweep-golden-master.test.ts` with `test/fixtures/golden/vented-2drv-series.json` (generator `gen-golden.ts`): a two-driver series golden. Changes or goes.
- `packages/design/test/domain/every-input-recalculates.test.ts` (case `wiring`): the input no longer moves a chart.
- `packages/design/test/domain/project-new-defaults.test.ts`, `packages/design/test/fields/field-registry.test.ts` (`driver_ArrayWiring` lists parallel and series).
- UI: `packages/ui/test/ui/new-project-wizard-walk.browser.spec.ts`, `packages/ui/test/hooks/OriginalNewProject-hooks.test.ts`, `packages/ui/test/ui/field-layout-rules.browser.spec.ts` (wizard and Driver tab wiring box), `my-wiring.browser.spec.ts`, `wiring-dq-mark.browser.spec.ts`.
- The WinISD-parity tests that pin the driver-count behaviour against WinISD captures (`engine/driver-count-winisd`, runs `sealed-w5-nd2` and its siblings) are WinISD's own numbers with the bug switch on. They stay green if "WinISD's figure by default" is chosen, and get a default flip if not.
- Baseline pictures: every Driver tab with more than one driver, and the new-project wizard's driver step.

### 4. The in-app list of WinISD bugs OpenISD fixes

New entry for `packages/design/fields/winisdFixedBug.ts`, in the file's style:

```
static readonly COIL_WIRING_REWRITE = new WinisdFixedBug({
  title: 'WinISD overwrites the driver\'s Re and BL when you change the voice coil connection',
  winisd: 'WinISD\'s "Voice coil connection" box rewrites the Re and BL you typed, in place. Going from parallel to series multiplies Re by N squared and BL by N, where N is the number of voice coils. The driver no longer holds the figures the maker published. Changing the number of voice coils afterwards puts the box back to Parallel without undoing the rewrite, so doing it again multiplies the figures again.',
  openisd: 'OpenISD keeps the published Re and BL with the wiring the maker measured them in, and works out the figures for your wiring when it calculates. Nothing you typed is changed.',
  seenIn: 'the Voice coil connection box on the Driver tab, and the coil wiring box in the driver editor.',
  size: 'Dayton MX6-22 (2 coils, published in series: Re 4.7 ohm, BL 12.3 Tm): parallel gives Re 1.175 ohm and BL 6.15 Tm in the calculation. WinISD would store those over the published figures.',
});
```

Also: a finding file in `winisd_research` (`FINDING_*.md`), a row in the "fixed by default" section of `docs/research/ACCURACY_IMPROVEMENTS.md`, and `docs/research/WINISD_PARITY.md` (CLAUDE.md rule). The OpenISD difference that Le and Znom are also converted (WinISD leaves them) goes in the same entry or a second row, once point 4 of (f) is observed.

### 5. The impedance chart with more than one driver: two candidates

The existing improvement (John, 4-5 Oct 2026) needs the array wiring to read. With the array wiring gone as a control there are two ways. Not chosen here.

- **Candidate A: always parallel (divided by N) by default, yellow switch "Per-driver impedance" for WinISD's figure.**
  Keeps John's 4-5 Oct ruling and the yellow-switch rules in `CLAUDE.md`.
  Invents a wiring the user never chose, which is not "replicate WinISD".
  Existing projects: parallel ones unchanged. Series ones change (to parallel, visibly).
  Tests: only the series cases change; the switch tests stay.
- **Candidate B: WinISD's per-driver figure by default. The switch and the array scaling go.**
  This is literally "for now replicate WinISD" (QO941.c24). The array's impedance becomes ticket 519 (a feature, not a bug switch).
  Existing projects: every project with more than one driver changes its impedance chart (parallel ones times N back to one driver's).
  Tests: the on-state parity tests become the default; the off-state tests (`winisdDriverCountModel.test.ts`, the series golden) are removed with the feature. The 5 Oct rows in `ACCURACY_IMPROVEMENTS.md`, `WINISD_PARITY.md` l.1471 and the bug record are marked superseded.

Recommendation: B, because it is what John's last words say and it removes a wiring assumption. It reverses a 5 Oct ruling, so it needs John's yes.

### 6. Doc lines that wrongly say the array control is "as in WinISD"

| Where | Says now | Corrected sentence |
|---|---|---|
| `docs/FIELD_REFERENCE.md` l.101-103 | "The project's 'Voice coil connection' control is a different thing: how several drivers (Num. of drivers) are joined to the amplifier, as in WinISD." | "The project's 'Voice coil connection' (phone: 'My wiring') is the wiring of the driver's own voice coils as the project uses them, as in WinISD. OpenISD converts from the measured wiring and never overwrites the published Re and BL. WinISD has no control for wiring several drivers (issue 519)." |
| `docs/research/WINISD_PARITY.md` l.993 (section 11b) | the labelled control "(several drivers joined to the amplifier) is a different control and is unchanged" | "WinISD's 'Voice coil connection' is the same control as OpenISD's project coil wiring. It rewrites Re and BL in place (a WinISD bug, fixed). WinISD has no wiring of several drivers." |
| `docs/research/WINISD_PARITY.md` l.79 | "Multiple drivers (series / parallel wiring) confirmed" | "Multiple drivers: count only. WinISD has no series or parallel setting for several drivers." |
| `docs/research/WINISD_PARITY.md` l.295 | "Brand, Model, Num. of drivers, Voice coil connection" matched | add: the control is the coil wiring of one driver |
| `packages/design/fields/field.ts` `DRIVER_ARRAYWIRING` (description, label) | "How several drivers (Num. of drivers) are joined to the amplifier" | field renamed to the coil wiring; description: "How the voice coils of one multi-coil driver are wired in this project. The driver's own figures stay as the maker published them; OpenISD converts. Greyed with one coil." |
| `packages/design/fields/field.ts` `VCCON` description | "Your own wiring is set in the project (Driver tab, My wiring)." | "The project's own wiring is set on the Driver tab." |
| `packages/design/domain/openisdSchema.ts` l.924-930 | "WinISD Driver tab: 'Voice coil connection'." on `wiring`, and for `coilWiring` "Not WinISD's 'Voice coil connection' above, which joins several drivers." | `coilWiring` carries the comment "WinISD Driver tab: 'Voice coil connection'"; `wiring` is marked unused (ticket 519). |
| `packages/design/fields/desktopHelp.ts` `VOICE_COIL_CONNECTION` and `OriginalNewProject.vue` l.164 | label only | tooltip added saying it is the coil wiring |
| `docs/research/ACCURACY_IMPROVEMENTS.md` l.61 and `WINISD_PARITY.md` l.1471 | the array's impedance per the project's wiring | marked superseded (candidate B) or kept (candidate A) |

### 7. Order of work

1. T831 (open, held): removes the "Measured wiring" row, shows nothing for an unknown wiring, shows the editor's data-quality mark. Includes this plan.
2. Second task (held): the single control, the removal of the array wiring, the migration note, the tests and docs above. Starts after John answers (g) item 5 and the greyed-on-desktop point.
3. Ticket 519 for anything about several drivers.
