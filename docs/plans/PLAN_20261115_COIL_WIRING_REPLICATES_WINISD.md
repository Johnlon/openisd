# Plan: one wiring control, as WinISD has it (QO941)

Written 15 Nov 2026 for John, to read on a phone. Short sentences on purpose.

Labels used for WinISD facts:

- **observed**: seen in WinISD's code, files or screens. The finding file or run is named.
- **documented**: WinISD's own help text, quoted.
- **inferred**: worked out from the above, not seen. The reverse engineering of `winisd.exe` 0.7.0.950 is done (`R/findings/FINDING_20261115_voice-coil-connection-and-driver-count-in-the-code.md`, `R/GHIDRA_FINDINGS.md` section "2026-11-15 Voice coil connection, coil count and number of drivers"). Section (h) lists what it settled. A statement still marked "to be confirmed" is one the finding lists as not established; the Wine screen observations are still coming.

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
   Observed: `R/runs/nd-1/01_tab_driver.png` (greyed with one coil). That the project box fires the same rewrite as the editor's box is now read in the code (handler 0x4679a0 calls routine 0x461240); see (h).
   Observed: `R/findings/FINDING_20261005_multi-driver-impedance-is-one-drivers.md` ("it is the per-driver multi-coil setting").
2. **Greyed with one coil.** Observed (same screenshot; greyed state with more than one driver is inferred, to be confirmed by reverse engineering (in progress)). With two coils it is live (`R/toys/qo96_vccon_impedance.py` docstring).
3. **Flipping it rewrites the stored Re and BL in place.**
   Parallel to series: BL times N, Re times N squared. Series to parallel: the inverse.
   Observed in code: `R/GHIDRA_FINDINGS.md` l.994-996 (handler at 0x461242).
   Observed in a probe: Re 6, BL 8, two coils, Series gives 24 and 16; three coils 54 and 24; four coils 96 and 32 (`R/PROBE_FINDINGS.md` l.3348-3363, run vccon-probe-20261005).
   Only Re and BL change. Le and Znom do not (read in the code: the routine writes Re, BL and VCCon only; see (h)).
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
9. **Two coils in the project box and two drivers together (case d).** Read in the code: the coil rewrite changes the stored Re and BL, and the driver count acts on top; no code multiplies or divides Re by the driver count. See (h).

## (c) What OpenISD does today

1. **The driver keeps the maker's wiring as data.** `VCCon` is series, parallel or unknown. Re, BL, Le and Znom are stored as published.
   `docs/FIELD_REFERENCE.md` l.83-100, `packages/design/domain/driver/openIsdDriverSpec.ts` (`terminalMotor`, `solverParams`).
2. **"Coil wiring" converts.** Project field `driverEmbedding.wiring` (`packages/design/domain/openisdSchema.ts`, optional, absent means the measured wiring). `packages/design/domain/project/projectCoilWiring.ts` holds the choice and the words. The conversion is `convertWiring` (series to parallel: Re, Le, Znom divided by N squared, BL divided by N).
   Only the amplifier side reads it. The stored figures are never changed.
3. **The project's "Voice coil connection" is something else: it wires SEVERAL drivers.**
   Field `driver_ArrayWiring` (`packages/design/fields/field.ts`, "How several drivers (Num. of drivers) are joined to the amplifier"), stored as `driverEmbedding.wiring` (`openisdSchema.ts` l.925), default parallel (`packages/design/domain/openisdTransforms.ts` l.165).
   The engine applies it: in series the coil resistance and the BL push are multiplied by n (`packages/design/engine/circuit.ts` l.91-93, l.107), and the impedance chart is scaled by n (series) or 1/n (parallel) when the WinISD per-driver switch is off (`packages/design/engine/simulation/SimulationEngine.ts` `arrayImpedanceScale`, l.216-222).
   WinISD does none of this (section (b) point 7).
4. **The two controls sit one above the other on the Driver tab.** Desktop: `packages/ui/src/ui/shells/original/OriginalShell.vue` (label "Voice coil connection", then the coil block). Phone: `MobileDriverTab.vue` (label "Connection"). They read alike and mean different things. That is the confusion John saw.
5. **The per-driver impedance improvement (now withdrawn).** `docs/research/ACCURACY_IMPROVEMENTS.md` had a row saying OpenISD showed the array's impedance per the project's wiring and the yellow switch "Per-driver impedance" brought WinISD's figure back. It came from commit 64a18829 (5 Oct 2026), an agent's classification of WinISD's one-driver chart as a bug, written into `CLAUDE.md`. John did not intend it (QO941.c33, c34) and withdrew it on 15 Nov 2026. It is not a ruling of John's. See (g) 5.
6. **What a `.wpr` carries today.** Written: `[Box] Nd`, and `[Driver] VCCon` with the figures converted to "Coil wiring" (`packages/design/domain/winIsdProjectConverter.ts` l.273 `driverAtMine`, l.308). Not written: the array wiring. It is in no `.wpr`.
   Read: `[Box] Nd` (l.595) and the driver block through the driver importer, which reads `VCCon` as the driver's measured wiring (`packages/design/domain/winIsdDriverImport.ts`). The project's coil wiring stays absent, so it follows the measured wiring. The array wiring is not read; a loaded project gets parallel.
7. **A WinISD-difference list entry for the coil rewrite does not exist.** `packages/design/fields/winisdFixedBug.ts` and `winisdDifferenceSection.ts` do not mention it (research report section 4).

## How the coil wiring is calculated (John, QO942.c29)

The driver's entered values and its measured wiring go to the solver together with the project's coil wiring. The amplifier-side Re and BL are CALCULATED at that moment. Nothing is stored, nothing is held in a second place ("it's not a copy it's just a calc").

- The arithmetic lives in ONE function, `convertWiring` (`packages/design/engine/solvers/driverQuantities.ts`).
- It is reached through ONE door, `terminalMotor()` (`packages/design/domain/driver/openIsdDriverSpec.ts`): the solver's Re and BL, the sweep's Le, the Driver tab's one line, the `.wpr` export. `projectCoilWiring.ts` also asks it "can this be rewired" with a probe.
- The gate `packages/design/test/architecture-coil-wiring-arithmetic-has-one-site.test.ts` fails if a second caller or a factor of the coil count appears outside them. It names two other places that multiply by the coil count, both turning a figure printed PER COIL into the published figure for the measured wiring, not the amplifier-side conversion: the record bridge (`driverRecordConverter.ts`) and the one-time schema 3 to 4 upgrade (`multiCoilAsPublished.ts`).

## Data version 5: the project's `wiring` is renamed `VCCon` (John, QO942.c54, QO946.c18, c23)

John: "migration is just to rename the field and use "parallel"/"serial" not 1 or 2"; "only the key name changes". The project's saved `driverEmbedding.wiring` is named `VCCon` from data version 5 on (as the driver's), its value ("series" or "parallel") kept exactly as saved; the driver's own `VCCon` is untouched. `coilWiring` (added 15 Nov 2026 on the test site, never released) also becomes `VCCon` and wins where a project has both. No `retiredArrayWiring`, no notice. Data version 4 to 5, browser-store layout 5 to 6.

What an old project shows after loading (`packages/design/test/domain/schema-version-5-wiring.test.ts`, real-shaped fixtures from a production browser store):

| Project as saved | `VCCon` after loading | Coil wiring in force (MX6-22, series-measured, 2 coils) |
|---|---|---|
| Production v3, `wiring: "parallel"` (the old default, written explicitly) | `parallel` | Parallel: the amplifier side uses Re 1.175 Ω, BL 6.15 Tm. The stored driver figures stay 4.70 Ω, 12.30 Tm. |
| Test site v4, `wiring` set, no `coilWiring` | the same value | the same value |
| Test site v4 with `coilWiring` | `coilWiring`'s value | the user's choice |
| No `wiring` saved | absent | follows the driver's own VCCon (series) |

The `.wpr`: export writes `[Driver] VCCon` from the project's `VCCon` (or the driver's measured wiring when none), with Re and BL converted; import reads the file's VCCon as the project's `VCCon`.

## (d) The end state John ruled

- The driver's wiring is the measured setup. It is data of the driver and is edited only in the driver editor ("Coil wiring").
- The project's wiring is how the project uses the driver. There is ONE control for it.
- The measured wiring is not shown on the Driver tab at all (QO941.c1 onwards).
- WinISD's in-place rewrite of Re and BL is a WinISD bug. OpenISD fixes it: the published Re and BL are never overwritten. It is listed (section (g) item 4).
- "For now replicate WinISD": with more than one driver OpenISD shows what WinISD shows by default.
- Wiring of several drivers to the amplifier is not a control now. It is ticket https://github.com/Johnlon/openisd/issues/519.

The one control:

- Reads and writes `driverEmbedding.wiring` (the field "Coil wiring" uses today). No new field.
- Default: the driver's measured wiring (the field is absent until the user picks).
- Label: "Coil wiring" on both skins (John, QO942.c12: the driver tab and the project use the same name for the same concept). "Connection" and "Voice coil connection" are WinISD's own words and are no OpenISD label.
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

**Observed under Wine (WinISD 0.7.0.950, `R/findings/FINDING_20261115_winisd-voice-coil-connection-observed.md`, commit 93fad4a).** All five points agree with the code reading.

1. **The project box rewrites the stored driver (point 1).** Seed Re 14.1526, BL 6, Le 0.0005, Znom 8, numVC 2, Parallel. Box to Series: Re 56.6103, BL 12, VCCon 2 (times 4 and times 2). Back to Parallel: exact inverse. Le, Znom, Qes, Fs, Mms, Cms, Sd, Vas, SPL, USPL unchanged. The `.wpr` has no project-level key; `[Driver] VCCon` is it.
2. **Several drivers (point 2).** Nd 2 does not grey the box (numVC 2, Nd 2: enabled) and the flip still rewrites. A one-coil driver greys it, whatever Nd. Nd 1 to 2 acts alone: SPL and max power times 2, volts 3.8 to 2.7 V; the impedance chart stays one driver's. Flipping the box changes only the impedance chart (times 4 at every frequency read, both Nd); SPL, excursion, max power and VA do not move. Nd 2 with numVC 1 gives point-identical charts to Nd 2 with numVC 2 at Parallel.
3. **MX6-22 entry (point 3).** Typing the published figures (4.7 ohm, 12.3 Tm) and then choosing Series gives Re 18.8 and BL 24.6, silently, with no warning (Qes is unchanged by the rewrite, so no check can see it). Choosing Series before typing does not survive: the editor's box returns to Parallel after the first typed field. The way WinISD's help describes: at Parallel type Re 1.175 and BL 6.15 (published divided by 4 and by 2), then choose Series: Re 4.700, BL 12.30, VCCon 2.
4. **Le and Znom (point 4).** Neither changes with the box, in the project or in the editor. Only Re and BL.
5. **Round trip (point 5).** WinISD opens OpenISD files with Re, BL, Le and Znom as stored and shows the project box as "Parallel" for a VCCon 2 file (the load bug); the editor shows Series. OpenISD's exported Series MX6-22 project differs from the same project in OpenISD by 10 to 13 percent in impedance at 20 and 50 Hz (not a like-for-like proof; another agent is investigating).

**Extra WinISD defects observed (not copied; to be listed with the others in the plan for the in-app list when John wants them listed):**

- The box change does not mark the project changed: plain Save writes nothing after a flip; Save As or another edit does.
- USPL (a calculated field) is not recomputed by the flip.
- The editor's Series falls back to Parallel after the first typed field.
- The Signal tab voltage is not refreshed after the flip or a driver-count change (stale readout).

## (g) The migration (a proposal, not decided)

Everything in this section is a proposal, except what (h) says is built (task T838).

### 1. Saved projects

- A project with one driver: numbers do not change. Array wiring does nothing with one driver (`circuit.ts` l.91, n is 1).
- A project with more than one driver and array wiring parallel (the default): the impedance chart changes if the answer to (g) item 5 below is "WinISD's figure by default". Other charts do not.
- A project with more than one driver and array wiring series: its impedance chart changes (the array wiring only ever scaled the impedance chart). Built in T837: a one-time note, shown once per project, with these words: "This project wired its N drivers in series. OpenISD no longer wires drivers together, so the charts now match WinISD. See issue 519." The setting is kept in the file, unused, so nothing is lost and a later feature can read it. John to confirm.
- The schema keeps `wiring` (optional from now, ignored). No schemaVersion bump is needed if it stays accepted; a decision for the implementer with the persistence tests.

### 2. `.wpr` and `.wdr`

- Today: see (c) point 6. WinISD's `[Driver] VCCon` is the coil connection, as the label for the stored Re and BL.
- After: unchanged in what is read and written.
  Read: `VCCon` becomes the driver's measured wiring (as today); the project's coil wiring stays absent.
  Written: the figures converted to the project's coil wiring, with that wiring as `VCCon` (as today). A `.wdr` keeps the published figures with the measured wiring.
- Never written or read: the array wiring.
- Worked case, Dayton MX6-22 (2 coils, published in series: Re 4.7 ohm, BL 12.3 Tm). Nothing is rescaled on load or save, in either program (read in the code, (h) point 7).
  - OpenISD project, Coil wiring = Series (or untouched): writes Re 4.7, BL 12.3, numVC 2, VCCon 2. WinISD opens it and simulates with 4.7 and 12.3, the same numbers. Its Driver tab box shows "Parallel" (the WinISD display bug), but the numbers are right until the user moves the box.
  - OpenISD project, Coil wiring = Parallel: writes Re 1.175, BL 6.15, Le 1.5 mH and Znom 4 as published, numVC 2, VCCon 1. WinISD simulates with 1.175 and 6.15, the same as OpenISD. WinISD's own Series-to-Parallel rewrite would give the same Re and BL.
  - OpenISD `.wdr` of the driver: Re 4.7, BL 12.3, numVC 2, VCCon 2 (the measured wiring, as published).
  - A WinISD file read into OpenISD: Re and BL as stored are the published figures, VCCon is taken as the measured wiring, Coil wiring is absent (follows the measured wiring). A file WinISD saved after its own flip holds the flipped figures labelled with the new wiring; OpenISD then treats them as published for that wiring, and the numbers are the same.

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

### 5. The impedance chart with more than one driver

Separate PR (`PLAN_20261115_SEVERAL_DRIVERS_REPLICATE_WINISD.md`, task T837): with more than one driver the impedance chart is one driver's, as WinISD. This plan's coil wiring does not depend on it.

### 6. Doc lines that wrongly say the array control is "as in WinISD"

| Where | Says now | Corrected sentence |
|---|---|---|
| `docs/FIELD_REFERENCE.md` l.101-103 | "The project's 'Voice coil connection' control is a different thing: how several drivers (Num. of drivers) are joined to the amplifier, as in WinISD." | "The project's 'Voice coil connection' (phone: 'Coil wiring') is the wiring of the driver's own voice coils as the project uses them, as in WinISD. OpenISD converts from the measured wiring and never overwrites the published Re and BL. WinISD has no control for wiring several drivers (issue 519)." |
| `docs/research/WINISD_PARITY.md` l.993 (section 11b) | the labelled control "(several drivers joined to the amplifier) is a different control and is unchanged" | "WinISD's 'Voice coil connection' is the same control as OpenISD's project coil wiring. It rewrites Re and BL in place (a WinISD bug, fixed). WinISD has no wiring of several drivers." |
| `docs/research/WINISD_PARITY.md` l.79 | "Multiple drivers (series / parallel wiring) confirmed" | "Multiple drivers: count only. WinISD has no series or parallel setting for several drivers." |
| `docs/research/WINISD_PARITY.md` l.295 | "Brand, Model, Num. of drivers, Voice coil connection" matched | add: the control is the coil wiring of one driver |
| `packages/design/fields/field.ts` `DRIVER_ARRAYWIRING` (description, label) | "How several drivers (Num. of drivers) are joined to the amplifier" | field renamed to the coil wiring; description: "How the voice coils of one multi-coil driver are wired in this project. The driver's own figures stay as the maker published them; OpenISD converts. Greyed with one coil." |
| `packages/design/fields/field.ts` `VCCON` description | "Your own wiring is set in the project (Driver tab, Coil wiring)." | "The project's own wiring is set on the Driver tab." |
| `packages/design/domain/openisdSchema.ts` l.924-930 | "WinISD Driver tab: 'Voice coil connection'." on `wiring`, and for `coilWiring` "Not WinISD's 'Voice coil connection' above, which joins several drivers." | `coilWiring` carries the comment "WinISD Driver tab: 'Voice coil connection'"; `wiring` is marked unused (ticket 519). |
| `packages/design/fields/desktopHelp.ts` `VOICE_COIL_CONNECTION` and `OriginalNewProject.vue` l.164 | label only | tooltip added saying it is the coil wiring |
| `docs/research/ACCURACY_IMPROVEMENTS.md` l.61 and `WINISD_PARITY.md` l.1471 | the array's impedance per the project's wiring | marked superseded (candidate B) or kept (candidate A) |

## (h) Confirmed by reading winisd.exe (15 Nov 2026)

Source: `R/findings/FINDING_20261115_voice-coil-connection-and-driver-count-in-the-code.md`. "Read in the code" unless stated.

1. One routine (0x461240) does coil wiring. The project Driver tab's "Voice coil connection" (handler 0x4679a0) and the driver editor's combo both call it.
2. It acts only when Re > 0, BL > 0, numVC > 1 and the stored VCCon differs from the choice. Parallel to series: BL times numVC, Re times numVC squared. Series to parallel: the inverse. Then it sets VCCon.
3. **It writes Re, BL and VCCon only.** Not Le, not Znom, not Qes, not the entered or calculated marks.
4. The box is enabled exactly when numVC > 1. The number of drivers and the box type play no part.
5. No simulation routine reads numVC or VCCon. The sweep uses Re and BL as they stand.
6. The number of drivers never wires anything: Vas and Sd times Nd in one shared box, each driver fed P/Nd. The impedance chart is one driver's (Re is never multiplied or divided by Nd). Iso-Barik halves Vas and doubles the motional impedance. The Signal tab's "Driver input voltage (each)" is the square root of P times Re over Nd.
7. Load and save never rescale Re or BL. `.wdr` and `.wpr` share one reader and one writer; numVC and VCCon are plain integers, default 1.
8. **WinISD bug:** nothing sets the project box from the loaded VCCon. A loaded Series driver shows "Parallel"; choosing Parallel then divides Re and BL; choosing Series does nothing (observed in memory under Wine: Re 14.1526 and BL 6 unchanged; Parallel gives 3.538 and 3). A move of the box does not mark the project changed (observed in the saved `.wpr`).
9. The 5 Oct "numVC edit resets the box to Parallel" probe is explained: Series chosen at numVC 1 never set VCCon (the numVC > 1 guard), so the refresh showed Parallel.

Not established (finding): the sweep consuming rewritten Re and BL was not shown live (read in the code at 0x456835 only); what 0x463e10 does after the box moves (taken to be a redraw, inferred); an extra series term in 0x45e740 (unidentified).

### Le and Znom: a decision for John, a switch on paper only

WinISD's routine converts Re and BL only. OpenISD converts Le and Znom as well, which is correct maths: two identical coils with coupling k give series 2L(1+k) and parallel L(1+k)/2, a ratio of N squared for any k, the same as Re; Znom likewise (the lead's note on QO942.c22). There is no WinISD-compatibility flag for it today. The lead recommends keeping the conversion by default and adding a yellow WinISD bug switch that leaves Le and Znom unconverted as WinISD does. John has not said yes. **This PR does not touch Le or Znom.** The removal was built and set aside on the branch `t838-le-znom-removal` (commit aff9ebab, local) so it is easy to restore or drop.

The switch, designed here and NOT built:

- **Name:** "Le and Znom with the coil wiring" (the title says what WinISD leaves out), under "Enable WinISD bugs", unticked by default, yellow, with the ≠W cue by the Coil wiring control, editable only where it applies (a driver with more than one coil and a known wiring).
- **Behaviour:** ticked, `convertWiring` returns Le and Znom as published (Re and BL still convert). The stored project field is `advanced.winisdCoilWiringKeepsLeZnom` (optional, absent means off), read by `ProjectCoilWiring.atMine`, `projectSweep` (`terminalMotor().Le_H`) and `driverAtMine` (the `.wpr` writer).
- **Where it sits in code:** `ToggleField.ADV_WINISDCOILWIRINGLEZNOM`, `CompatSwitch.COIL_WIRING_LE_ZNOM` (kind `bug`), `errorSwitches.coilWiringLeZnom` (applicable when numVC is above 1 and the wiring is known), `WinisdDeviation.COIL_WIRING_LE_ZNOM`, one row on each Advanced tab, one line in the phone help list.
- **Records:** a `winisd_research` finding (the existing FINDING_20261115 files already carry the evidence: read in the code, observed under Wine), a row in the "fixed by default" section of `docs/research/ACCURACY_IMPROVEMENTS.md`, `WINISD_PARITY.md`, a bug-list entry in `winisdFixedBug.ts`, and a line in `CLAUDE.md`'s calculation-bug paragraph (a rule-file edit, for John's word).
- **Tests:** `wiring-conversion.test.ts` (both states), `my-wiring.test.ts` and `wpr-my-wiring.test.ts` (Le and Znom in the exported `.wpr` in both states), `error-switches.test.ts`, `compat-switch.test.ts`, `every-input-recalculates.test.ts` (the switch moves a chart: the impedance at high frequency, where Le matters, with the gyrator model on), the two Advanced-tab browser specs, and a phone and desktop spec for the cue.
- **Effect on the `.wpr`:** off (default) is today's export; on writes Le and Znom as published for a Parallel choice, as WinISD's own flip would.

### What this PR changes (task T838, built, held)

- **One wiring control.** "Coil wiring" on both skins; one project field (`driverEmbedding.VCCon`, renamed from `wiring` in data version 5, value kept). Default: the driver's measured wiring (this fixes WinISD's always-Parallel display).
  - A driver with more than one coil and a known measured wiring: enabled on both skins.
  - One coil (or no coil count): the desktop shows it greyed, reading Parallel, as WinISD does, and a click says "Coil wiring applies only to drivers with 2 or more voice coils."; the phone omits it (QO942.c88, c89, c91).
  - Measured wiring not stated: the desktop shows it greyed and a click says "The datasheet does not say how the coils were wired when measured, so the wiring cannot be changed. The figures are used as published."; the phone omits it (QO942.c90, c91). The select is disabled and a catcher over it takes the click.
- **Re, Le and Znom convert by N squared and BL by N (A2)**; the yellow switch "Coil wiring: Re and BL only" gives WinISD's Re-and-BL-only conversion.
- **Any number of coils above one converts** (OpenISD refused three coils before).
- **The two WinISD bugs are in the in-app list** of fixed bugs: the in-place rewrite of Re and BL, and the always-Parallel display.
- **`.wpr` export:** unchanged by this PR (a Parallel choice writes Re, BL, Le and Znom converted, as before). The Series or untouched export is unchanged. VCCon is the choice. Nothing is rescaled on load or save.
- **If only this PR is merged:** the old control that wires several drivers still exists beside it, labelled "Voice coil connection" (desktop) and "Connection" (phone), until the several-drivers PR (T837) merges and removes it. The new control is labelled "Coil wiring".

### 7. Order of work

1. T831 (open, held): removes the "Measured wiring" row, shows nothing for an unknown wiring, shows the editor's data-quality mark. Includes this plan.
2. Second task (held): the single control, the removal of the array wiring, the migration note, the tests and docs above. Starts after John answers (g) item 5 and the greyed-on-desktop point.
3. Ticket 519 for anything about several drivers.
4. T837 (held): several drivers are WinISD's, the array wiring and the Per-driver impedance switch go.
5. T838 (held): the single coil-wiring control and Re and BL only.
