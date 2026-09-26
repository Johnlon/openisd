# OpenISD — research and grounding

The theory OpenISD implements, what WinISD is built on, and what we have measured WinISD doing.
The evidence (probe runs, disassembly, arithmetic) is in the source documents linked from each
section.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [gap list](OPENISD_WINISD_GAPS_AND_BUGS.md) ·
[doc index](DOCUMENTATION.md).

## Sources

### What WinISD is built on

| Source                                                                      | What it settles                                                                                                    |
|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| Claus Futtrup, *Driver Parameter Calculator* (DPC): [air.htm](https://www.cfuttrup.com/dpc/air.htm), [airmodel.htm](https://www.cfuttrup.com/dpc/airmodel.htm), [formulas.htm](https://www.cfuttrup.com/dpc/formulas.htm) | WinISD's air model and parameter definitions. WinISD's help names DPC as the source. Its published constants reproduce six WinISD air measurements to 3.3e-15. |
| [`winisd_research/WINISD_IS_BUILT_ON_DPC.md`](../winisd_research/WINISD_IS_BUILT_ON_DPC.md) | The evidence for the claim above, and the rule that follows: look in DPC before deriving or fitting anything.       |
| WinISD's own help, [`docs/winisd_helpfiles/help/`](docs/winisd_helpfiles/help/) | Field meanings (`thielesmall.html`, written by Futtrup), box losses, and the DPC citation (`boxdesign.html`).       |
| WinISD 0.7 screenshots, [`docs/winisd_screenshots/`](docs/winisd_screenshots/) | Every pane, dialog, filter type and chart type WinISD offers.                                                       |

### Theory canon

The full list, with oracles and cross-check implementations, is in
[`docs/research/REFERENCES.md`](docs/research/REFERENCES.md).

| Source                                                                  | Used for                                                            |
|-------------------------------------------------------------------------|---------------------------------------------------------------------|
| R. H. Small, "Direct-Radiator Loudspeaker System Analysis", JAES 20(5), 1972; Thiele (1971); Small (1972–73) | T/S relations, closed-box and vented-box systems, alignments.       |
| W. M. Leach Jr, *Introduction to Electroacoustics*; "Electroacoustic Design with SPICE", JAES 39(7/8), 1991 | The analogous-circuit model `engine/circuit.ts` implements.         |
| Picard et al., CIPM-2007 moist-air density, *Metrologia* 45 (2008)       | OpenISD's physical air model (`engine/air.ts`).                      |
| Ahonen, Linearteam enclosure modelling, 2007 ([pdf](../winisd_research/references/Ahonen_Linearteam_enclosure_modelling_2007.pdf)) | Corroborates the lossy 3rd-order sealed-box model. Gives no coefficients. |
| Ballard, sealed-box honours thesis, 2011 ([pdf](../winisd_research/references/Ballard_sealed_box_honors_2011.pdf)) | Sealed-box loss background.                                         |
| [`docs/research/VENTED_ALIGNMENT_FORMULAS.md`](docs/research/VENTED_ALIGNMENT_FORMULAS.md) | WinISD's five vented alignments (QB3, BB4, EBS3, EBS6, C4), recovered from the binary and matched to 60 wizard captures (Qts 0.15–1.0) within 2.3e-14. Implemented in `engine/boxDesign.ts`. |

### Circuits and schematics

| Source                                                                                                  | What it is                                                                                  |
|---------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| [`winisd_research/references/yanapack_circuits/`](../winisd_research/references/yanapack_circuits/)     | SPICE-style netlists (`driver.cir`, `closed_cab.cir`, `surround-27-vented.cir`) for yanapack. It confirms circuit topology, not values. |
| [`winisd_research/references/yanapack_oracle_HOWTO.md`](../winisd_research/references/yanapack_oracle_HOWTO.md) | How to run yanapack against a WinISD case.                                                  |
| `packages/design/engine/circuit.ts`                                                                     | OpenISD's circuit: electrical → mechanical → acoustical, gyrator-coupled, solved per frequency. |
| [`docs/research/WINISD_PARITY.md`](docs/research/WINISD_PARITY.md) §9                                   | WinISD's circuit model against the full gyrator model. Its Le placement is superseded by PROBE_W5 §4.1. |

### WinISD behaviour research

| Document                                                                         | Contents                                                                         |
|----------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| [`winisd_research/WINISD_MODEL.md`](../winisd_research/WINISD_MODEL.md)          | How WinISD behaves: the solver rule, the sealed-box Fsc cubic, the air model, file-format facts. |
| [`winisd_research/PROBE_FINDINGS.md`](../winisd_research/PROBE_FINDINGS.md)      | Every finding and WinISD bug from driving the real app, with reproductions.       |
| [`winisd_research/GHIDRA_FINDINGS.md`](../winisd_research/GHIDRA_FINDINGS.md)    | What the disassembly shows: constants, addresses, formulas.                       |
| [`winisd_research/PROBE_METHOD.md`](../winisd_research/PROBE_METHOD.md)          | The wine harness: how to drive WinISD and read numbers back.                      |
| [`winisd_research/GHIDRA_METHOD.md`](../winisd_research/GHIDRA_METHOD.md)        | The Ghidra environment and the live gdb technique.                                |
| [`docs/design/WINISD_SCHEMA.md`](docs/design/WINISD_SCHEMA.md)                   | `.wdr`/`.wpr` byte format and the 27 consistency relations.                        |
| [`docs/research/WINISD_PARITY.md`](docs/research/WINISD_PARITY.md)               | Field-by-field UI parity against the WinISD screenshots. Part 2 verified 2026-08-13; the gap list supersedes its status marks. |
| [`docs/research/PROBE_W5_SEALED_20260924.md`](docs/research/PROBE_W5_SEALED_20260924.md) | Every chart, WinISD against OpenISD, one sealed project.                          |

`winisd_research/` is a separate git repository; its history is there, not here. Its entry point
is [`winisd_research/README.md`](../winisd_research/README.md).

## WinISD's model

### The parameter solver

> Repeat until nothing changes: for each relation, if exactly one member is unknown and every
> other member has a value (entered or already calculated), fill it. An entered value is never
> recomputed and never questioned. A field is never filled from a value that was itself derived
> from it.

- This is constraint propagation to a fixpoint. It is not field precedence and not recency.
- The relations are the 27 of `WINISD_SCHEMA.md` §4: 22 from the binary's group strings (15 confirmed, 7 inferred) and 5 read from the calculation engine.
- Route priority is address order; for Fs, relation 11 beats 14, 2, 4 and 12 (`GHIDRA_FINDINGS.md`; FINDING-027/028 in `PROBE_FINDINGS.md`).
- Each field carries a ParState mark: **E** entered, **C** calculated, **N** not available. WinISD's editor colours show it (green, blue, black).
- WinISD never flags a contradiction:
  - two entered values that disagree are never compared;
  - where two routes could fill one hole, the losing route is dropped without notice.
- The derived figure-of-merit fields read `0` after a file load until any field is edited (BUG-005).

Source: `WINISD_MODEL.md` §"The rule".

### Air

- **Source of the values:**
  - WinISD reads temperature, humidity and pressure from the app-level Options, and nothing else.
  - A driver's stored `c`/`roo` win when both are present. When only one is, see `WINISD_SCHEMA.md` §12.
  - A project's own `[Box] T/phi/p` reach only the Project tab readouts.
  - Sources: FINDING-006, `WINISD_MODEL.md` §"Air".
- **When it runs:** once per process, at load. Changing Options with a project open leaves that project's `c`/`roo` stale (BUG-009).
- **The formula:**
  - `c` is ideal-gas moist-air mixing over Hyland–Wexler vapour pressure, with DPC's constants.
  - The gas constant is R = 8.31451, the 1986 CODATA value.
  - `ρ = γ·p/c²`, with γ = 1.4.
  - ρ is not computed from a density model.
- **Reference point:** 293.15 K, 30 %, 101325 Pa gives `c = 343.6841209621523` and `ρ = 1.200952177146823`, captured from live registers.
- **OpenISD's physical model** (CIPM-2007) differs from WinISD's by 8.3 ppm on ρ and 4.1 ppm on c at the reference point. The difference is DPC's constants (R = 8.31451, M_air = 28.965 g/mol), its Hyland–Wexler vapour-pressure curve, and no enhancement factor (FINDING-008 §2).

### Sealed-box resonance

- WinISD's `Fsc` is not the textbook `fs·√(1+Vas/Vb)`.
- The leak adds a third pole. WinISD solves the resulting cubic and reports `Fsc = |pole|/2π`.
- So `Fsc` rises as the leakage Q (`QL`) falls, by about 2.8 Hz over the usable range. The textbook value is the `QL → ∞` limit.
- OpenISD's `LossMode.WinisdLossy` (the default) matches WinISD's `[Box] Fr` to within 5e-5 Hz over a Ql sweep (`loss-mode.test.ts`).
- `.wpr [Box] Fr` stores this lossy value (FINDING-007).
- The Qts that feeds Fsc, Qtc and the vented designer is Rg-corrected: `Qes' = Qes·(Re+Rg)/Re`. Without it Fsc is 0.03 Hz low and Vb about 3 % off (`WINISD_MODEL.md` §5; `engine/lossMode.ts` `sourceLoadedQts`).

Source: `WINISD_MODEL.md` §"WinISD's sealed-box resonance".

### Voice coils

- `numVC`/`VCCon` are not simulation inputs.
- Changing the wiring rewrites the driver's `Re` and `BL` in place: parallel→series multiplies `BL` by `numVC` and `Re` by `numVC²`.
- The E mark is left unchanged (FINDING-009; [bug record](../winisd_research/bugs/BUG_20260828_winisd_silently_rewrites_Re_and_BL_and_still_marks_them_entered.md)).
- The arithmetic is correct physics. The defect is that a typed value is replaced and still marked as typed.

### Other measured facts

| Fact                                                                                                         | Source         |
|--------------------------------------------------------------------------------------------------------------|----------------|
| The project's `[Box] alfaVC` and the driver's `alfaVC` are independent fields.                              | FINDING-011    |
| Force flat response showed no boost ceiling up to about 95 dB of implied gain; a higher ceiling is untested. | FINDING-010    |
| Box-tab Volume and Tuning do not cascade on typing; coupling differs by box type and follows the chamber.   | FINDING-004; `PROBE_FINDINGS.md` §"per-chamber coupling" |
| The Vents tab is the inverse-Helmholtz solver: enter Vb, Fb and diameter, and it returns the length.        | PROBE_FINDINGS |
| WinISD does not validate entered values; physically impossible values are accepted.                          | PROBE_FINDINGS |
| The `.wdr` writer emits UTF-8 and stores a newline as the byte `A4`. The reader turns `A4` back into a newline before decoding, so any character whose UTF-8 contains `A4` is destroyed; invalid bytes become `?`. | PROBE_FINDINGS §"Comment field" |
| Passive radiators have no standalone `.wdr`.                                                                 | WINISD_MODEL §9 |
| WinISD has no curve export: no menu bar, no data file filter, and the cursor readouts have no window handle. | [parity goldens README](packages/design/test/winisd/fixtures/winisd-parity/README.md) |

### Further findings

| Finding                                                                                                   | Source |
|-----------------------------------------------------------------------------------------------------------|--------|
| Xmax routes: row 19 beats row 20, and a zero row-19 answer falls through to 20. `Hc == Hg` with no `Vd` hangs WinISD. | `WINISD_MODEL.md` §Xmax; `PROBE_METHOD.md` |
| ParState: 49 slots. No `ParState=` line means all E. A blank driver is N except numVC (E) and c/roo (C). The Xlim value is discarded on save but its mark is kept. | `GHIDRA_FINDINGS.md` §ParState; `PROBE_FINDINGS.md` |
| Figure-of-merit formulas: Gloss, SPLmaxLF, Mcost (`min`), SPLmax −3 dB, `KLe = Le·√(2π·fLe)`, the four-way DVol relation. | `parity/SOLVER_GAPS.md`; `GHIDRA_FINDINGS.md` |
| New Project wizard, sealed route: nine fixed Qtc targets, `Vr = Vas/((Qtc/Qts_eff)²−1)`, with an unexplained ×1.0098 on Qts. | `PROBE_FINDINGS.md` §New Project wizard |
| Passive radiator: Fh is the series-compliance resonance; `prTuning()` and Fs with added mass match exactly. | `PROBE_FINDINGS.md` §Passive radiator |
| Vents tab: the first port resonance is `c/(2L)` over the bare length, with no end correction. The binary holds two end-correction constants, 0.732 and 0.6. | `PROBE_FINDINGS.md` §Vents; `GHIDRA_METHOD.md` |
| Box-loss defaults are Ql 10, Qa 100, Qp 100. Ql shifts Fsc; Qa does not. | `WINISD_PARITY.md` §Losses; `PROBE_FINDINGS.md` |
| `.wpr`: `phi` is a fraction; `[SimulatorOptions]` holds VCInd, FlatResponse and TLPorts; box sections store no computed output except sealed `Fr`; `BL=` and `Znom=` are case-sensitive. | `WINISD_MODEL.md` §wpr |
| BUG-006: WinISD's recomputed Re, Rms and Cms differ from hand calculation by about 1 %. | `PROBE_FINDINGS.md` BUG-006 |
| Only the last of the `c`/`roo` fallback probes is valid: Options is the source (the earlier runs never committed the OK button). | `runs/c_roo_fallback_ok_vs_escape_20260819.md` |

Paths are in `winisd_research/`.

## WinISD bugs, and what OpenISD does instead


| WinISD bug                                                                                  | OpenISD                                                                                                              |
|---------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| BUG-002/003/004: crashes and popup loops on an empty driver, the Box tab or a blank PR volume | A missing input leaves dependent fields N, and the sweep returns a named missing-dependency issue instead of values. |
| BUG-005: figure-of-merit fields read `0` until any edit                                     | The project solves on construction, so derived fields are present on load.                                          |
| BUG-009: changing Options leaves the open project's air stale                               | `appSettingsChanged()` re-stamps every unstated environment field; entered ones are kept (`environmentalAxioms.test.ts`). |
| FINDING-009: a wiring change rewrites `Re`/`BL` and keeps the E mark                        | Per-coil `Re`/`BL` stay as entered. `Re_terminal_ohm`/`BL_terminal_Tm` are separate calculated fields (`solver.ts`). |
| Solver modes A and B: contradictions are never shown                                        | Each member of an inconsistent group carries an `inconsistent-inputs` DQ issue.                                     |
| BUG-007: a decimal comma is dropped                                                         | Not verified. OpenISD uses `<input type="number">`, so comma handling depends on the browser.                      |
| BUG-008: `Dd` unit inconsistency                                                            | Not verified. OpenISD stores dimensions in SI units (`openisdSchema.ts`).                                            |

## Methods

### Driving WinISD (probing)

- **Setup:** WinISD 0.7 runs under wine on WSLg or Xvfb, and a Python harness drives it (`winisd_research/lib/wine_control.py`). Run one instance at a time: the harness finds the window by title.
- **Reading numbers back, cheapest first:**
  1. UI text over `WM_GETTEXT`, at 2–6 significant figures, with no side effects;
  2. the saved `.wpr` at about 15 digits; the project must be dirtied first;
  3. pixels via `xwd`: the only channel for E/C/N marks (the darkest pixels against the legend
     swatches; exact colour fails under wine) and for the graph.
- **Getting WinISD to recalculate:**
  - The sealed Fsc readout recalculates only on a field-clear event: type, Ctrl+A, Ctrl+X,
    Ctrl+V, Tab. Once per field per process; a second commit crashes WinISD
    (`trigger_fsc_recalc`).
  - Other readouts and the derived-field pass fire on a typed edit. The safe edit is retyping a
    value as itself, spelled differently (for example `0.00050` over `0.0005`).
  - A Box-tab edit is needed to dirty the project, or Save writes nothing.
- **Provenance rule:** a found `.wpr` proves nothing about the binary under test. Inputs are written by the probe itself, before the launch that observes them.
- **Probing both apps on one case:**
  - Feed WinISD and OpenISD the same inputs and compare every output.
  - WinISD curves are traced from plot pixels.
  - OpenISD's are dumped from `Engine.sweep` with the parameters the app passes.
  - Example: `PROBE_W5_SEALED_20260924.md`: both apps fed the W5-1138SMF values from
    `winisd_research/toys/w5_sealed_baseline.py`.

Source: `PROBE_METHOD.md`.

### Reading the binary

- Ghidra static analysis of `winisd.exe` found the constants and formula addresses.
- A live gdb capture under wine settled the sealed-box cubic.
- The air model was matched to DPC's published constants. The sealed-box cubic's topology was
  confirmed by yanapack, which is not a value oracle.
- Source: `GHIDRA_METHOD.md`.

### Golden files from WinISD

- **What they are:** projects that WinISD itself saved, copied out unmodified (`packages/design/test/winisd/fixtures/winisd-parity/goldens/*.wpr`).
- **How they are made:** `winisd_research/scripts/qo8_parity_generator.py` does the following:
  - Scenarios are explicit parameter sets (`scenarios.json`) in WinISD's own key names. They never name a database driver, so a pipeline re-run cannot re-baseline them.
  - Each scenario is written into a project, and WinISD is launched on it.
  - Recalculation is triggered with one driver-editor retype (`Le`) and one box retype (volume). Neither belongs to a consistency group.
  - The project is then saved.
  - The generator stops at the first scenario WinISD will not answer. It never substitutes an OpenISD value, which would make the test a tautology.
- **Provenance:** `provenance.json` records the binary's sha256 and the harness commit.
- **How they are checked:** `winisd-parity-functional.test.ts` runs OpenISD on the same scenarios and diffs field by field.
- **Divergences:** deliberate differences are listed in `divergences.json`.
- **Limit:** goldens cover field calculations only. WinISD cannot export curves. `engine/golden.test.ts` pins OpenISD's own sweep output exactly, which guards against regressions, not against disagreement with WinISD.

### Oracle tiers

This ordering is OpenISD's own; `docs/research/REFERENCES.md` ranks the literature sources.

1. Closed forms (sealed `fc`, `Qtc`, passband sensitivity).
2. WinISD goldens and live-register captures.
3. Manufacturer datasheets.
4. Alignment tables, verified against a primary source before use.

Agreement with another open-source tool is a sanity check only.

### Method rules

- Never tune a better model until it matches WinISD. Find the formula WinISD uses (DPC first).
  Air was mis-fitted once; the record is in `PROBE_FINDINGS.md` FINDING-008 §2d.
- OpenISD's TypeScript is not evidence of WinISD's behaviour. Only WinISD captures, its help, and the literature count.
