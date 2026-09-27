# HANDOVER 20260927 — WinISD chart parity: sealed done, filters next, then vented

Goal: by default every OpenISD chart equals WinISD's, bugs included. Each conventional variant
sits behind its own switch in the WinISD Compatibility panel (Advanced tab).

## State

- **Sealed: all 10 charts match WinISD.** 9 exact (≤ 1e-13), group delay within WinISD's own
  rounding (4.9e-4 ms). Confirmed independently by session a2 at current HEAD.
- Filters, vented, bandpass 4th, passive radiator: not started. Checklist: [CHARTS.md §0](../CHARTS.md).
- Both repos committed and pushed. openisd `main`; winisd_research `master` on the new private
  remote https://github.com/Johnlon/winisd_research.

## Done this session (2026-09-26/27)

| Area | What | Commit |
|---|---|---|
| Sealed engine | box absorption in series, impedance and push use entered BL, TF 0 dB = HF asymptote, max power into Re + Rg | 2026-09-26 |
| Group delay | phase slope at the point, as WinISD (f ± ((f+1e-10)−f)) | `08120f89` |
| VA chart | new chart, WinISD formula P·Re·\|Hf\|²/\|Z + Rg\| | `374db633` |
| "WinISD VA model" switch | off = P·(Re+Rg)/\|Z seen by amp\|, Rg counted once | `044126b7` |
| VA, Rg at driver side | WinISD counts Rg twice; captured, tested | `eff622df` |
| Toolbar | chart drop-down fixed 324 px, name on one line, brand centred | `dfd4b624` |
| Loss model | Box-tab selector removed; compat panel only, unlabelled: WinISD lossy / Lossless / Conventional lossy model; tooltip rewritten | `dfd4b624`, `53f0200e` |
| Compat panel | ends at its last switch (no stretch) | `dfd4b624` |
| Gaps doc | Ql leakage, TF reference, air model moved to Resolved | `389ec226` |
| winisd_research | 147 MB gdb core dump stripped from history, `core*` ignored | `729061d` |

## How a chart is checked

1. WinISD side, by debugger (never exe patching):
   `cd winisd_research && scripts/headless.sh python3 toys/w5_chart_refresh.py <run> VCInd=0 Rg=0.1 "charts=spl|impedance"`
   → `runs/<run>/` (w5.wpr, gdb.log, pngs, charts.json). Capture only the chart under work plus
   the fixed ones for regression.
2. OpenISD side: `npx tsx build/tmp/w5_openisd_dump.ts <run>/w5.wpr fs.json out.json` (scratch,
   imports the same .wpr, sweeps the saved project).
3. Compare: `toys/chart_refresh_compare.py` → record + tables for
   [CHART_REVIEW](../research/CHART_REVIEW_WINISD_VS_OPENISD.md?html).
4. Each gap: bug file, RED test with WinISD's logged values (`winisdDriverModel.test.ts`), fix,
   browser test if visible, update CHARTS.md + chart review.

Loggers in `scripts/gdb_log_chart_points.py`: `PointLogger` at 0x462394 (sealed routine 0x4618f0)
and 0x457536 (vented routine 0x456800); `VALogger` at 0x46c05c (plot code, any box).
Box-type dispatcher 0x566850: 0 sealed 0x4618f0, 1 vented 0x456800, 2 bp4 0x457a30,
3 0x5668c0, 4 PR 0x45a960, 5 0x4591b0.

## Order of work (John, 2026-09-27)

1. **Filters on sealed, full** — every WinISD filter type, non-default settings: the 3 EQ/Filter
   charts plus SPL, excursion, VA, max SPL/power. Sealed is exact, so any gap is the filter's.
2. **Vented** — full chart pass, then one capture with a filter.
3. **Passive radiator**, then **bandpass 4th** — the same.
4. **Human re-verification (QO170)** — every WinISD bug claimed from debugger/disassembly/scripted
   runs is reproduced by hand in WinISD with John before it counts as fact. Filter bugs: the seven
   `bugs/BUG_20260927_winisd-*` filter files. Add each new claimed WinISD bug to QO170.

The filter response Hf multiplies into every box type the same way, so filter types are proven
once, on sealed; the other boxes need one filter capture each, not the full set.

## Next: filters on sealed

- WinISD filter types (help `filtersimulator.html`): Butterworth low/high-pass orders 1–10,
  Linkwitz-Riley (4th order only), Bessel orders 1–10, second-order section (fc, Q), allpass,
  Linkwitz transform, parametric EQ, second-order high-pass by peak gain and peak frequency,
  static gain. Filter chain sits on the electrical side: 0 dB = the Signal tab voltage.
- OpenISD (`engine/filters.ts`): high-pass and low-pass are **second-order sections only**
  (fc, Q) — no order, no Butterworth/LR/Bessel families. Plus Linkwitz transform, peaking EQ,
  and low/high shelf (**OpenISD-only**, not in WinISD). Missing: allpass, DLP raised-cosine,
  static gain, peak-gain high-pass, orders ≠ 2.
- **.wpr import ignores `[Filters]`.** Format (sample `docs/samples/sample_project_passive-radiator.wpr`):
  `Count=N`, `filter<i>type=<int>`, `filter<i>params=<;-separated>`, e.g. type 0 params
  `0;1;2;50;0.707`, type 7 params `0;1;100;0.333;6`. ⚠ Unverified: the type-number → filter map
  and each params field's meaning. Decode first (WinISD Filter editor by debugger, or saved
  projects with one filter each), then add the import.
- Capture tool: `lib/wdr.write_wpr` writes `[Filters] Count=0`; needs a filters argument.
- The filter charts' value mapping (which complex WinISD logs for FltMag/FltPhase/FltGD) must be
  taken from the capture. Sealed notes say WinISD's group delay may exclude the filter chain —
  unverified.
- **Ruling, John 2026-09-27: build them all — parity and beyond.** Every WinISD filter type and
  order in OpenISD, matched to WinISD; OpenISD-only types (shelves) stay.

## Delegation (John, 2026-09-27)

Leader + one Sonnet worker at a time, serial. Leader writes a tight brief per chunk and reviews
each result before commit (check expected values come from WinISD, not from the worker's code).

| Work | Who |
|---|---|
| Decode WinISD filter type numbers and params | leader, or Sonnet with a tight brief |
| Reading WinISD disassembly (what a chart plots) | leader |
| Each filter type TDD from its formula | Sonnet |
| `.wpr` `[Filters]` import | Sonnet |
| Captures with filters + comparison tables | Sonnet |
| Review before commit | leader |

## Then: vented

- `w5_chart_refresh.py` is sealed-only: `BOX` comes from `w5_sealed_baseline.py`, and `CHARTS`
  holds the 10 sealed popup rows. Needed: a `box=vented` option passing `BType=1`, `Vr`, `Fr`
  and `vent_rear` (Num, dia1, len, endcorrection) to `lib/wdr.write_wpr`, and the vented popup
  rows (adds Rear port - Air velocity, Rear port - Gain; row order unverified).
- ⚠ OpenISD's .wpr import (`openIsdProjectToWinIsdProject.ts` case 1) reads only `Vr`, `Fr`,
  `VentRear Num`. Port diameter, length and end correction are ignored, so port air velocity
  cannot match until the import reads them.
- Chart value mapping for vented charts (which complex → which plotted value, esp. port air
  velocity) must be established from the capture, as was done for sealed.
- Vented alignment maths already validated 35/35 (memory: vented-alignment decompile).
- **Port length calc: not checked exactly.** WinISD's vent length is the Helmholtz inverse
  L = c²·Sp/((2π·Fb)²·Vb) − k·D, k = end correction (0.6), D = diameter. Matched only to WinISD's
  3 displayed digits: 5 cm → 0.154 m, 7 cm → 0.318 m at Vb 20 L, Fb 40 Hz
  ([PROBE_FINDINGS.md](http://localhost:8000/winisd/winisd_research/PROBE_FINDINGS.md?html) ~L1422).
  Unverified: which c WinISD uses (air model), whether k·D uses diameter or an area-equivalent
  for non-round vents, and how Num > 1 splits the area. OpenISD's solve is `ventLength(Vb, fb, Sp)`
  (engine `alignments.ts`). Next: log WinISD's computed length by debugger and pin OpenISD to it.
- **Box losses (Ql, Qa, Qp): not WinISD's form for vented, PR or bandpass.** Sealed now uses
  WinISD's leak Ral = Ql/(ωsc·Cab), fixed, in parallel with a series absorption Raa = ωsc·Mas/Qa
  ('winisd-lossy', `circuit.ts`). Vented, PR and bandpass 4th still use the old per-frequency
  form Ql/(ω·Cab) ∥ Qa/(ω·Cab) — the form that was wrong for sealed. Port loss is
  Rap = ω·Map/Qp (`portLoss`, per-frequency). ⚠ Unverified what WinISD's vented routine 0x456800
  does for Ql, Qa and Qp: read its disassembly first (as done for sealed f_4618f0), then capture
  with non-default Ql/Qa/Qp to separate them. Expect this to be the first vented gap.
- **End correction default differs.** OpenISD `END_CORRECTION = 0.732` (`engine/air.ts`, the
  default argument of `ventLength`/`tuningFromLength`); WinISD's default is 0.6 per vent
  (`[VentRear] endcorrection`). Check which value each caller passes.
- **Vent shape and count.** WinISD: round or rectangular (`Shape`, `dia1`, `dia2`, `carea`,
  `crosscalc`), `Num` vents. OpenISD import reads `Num` only.
- **Port model.** OpenISD has an optional transmission-line port (`useTransmissionLinePortModel`);
  WinISD is lumped. Make sure it is off for the comparison.
- **Port air velocity definition.** Peak or RMS, at which input power, one vent or all — take it
  from the capture, as excursion's √2 was for sealed.
- **Vented design limits.** OpenISD app settings carry `ventedLimits` (Options dialog). Check
  whether any WinISD chart or readout uses a port-velocity limit.
- **Variants.** Once default vented matches: VC inductance on, Rg 0/10 Ω with driver side on/off
  (as done for sealed), and more than one vent.
- **Box readouts.** Fb, F3 and vent length/area readouts on the Box tab, not only the charts.
- **EQ/Filter charts.** The 3 box-independent filter charts are unchecked for every box type,
  sealed included.
- **WinISD Compatibility switches, reach into vented/PR/bandpass:**

  | Switch               | Acts on                                                   | Reaches vented/PR/bandpass? |
  |----------------------|-----------------------------------------------------------|-----------------------------|
  | Loss model           | sealed box impedance only (`circuit.ts` sealed branch)    | **No** — they ignore it     |
  | WinISD driver model  | driver Cms/Mms/Rms/BL and the inductance model            | Yes (shared driver side)    |
  | WinISD air model     | ρ and c from temperature/pressure/humidity                | Yes (port mass, box Cab)    |
  | WinISD VA model      | VA chart formula (`sweep.ts`)                             | Yes (formula uses Z only)   |

  The loss model needs a vented/PR/bandpass WinISD form behind the same switch once WinISD's
  routines are read (see Box losses above). Each switch's default must still give WinISD's
  numbers for the new box type — verify by capture, not by assumption.
- Open: [BUG_20260918_no-ui-path-to-enter-a-vent-length](../../bugs/BUG_20260918_no-ui-path-to-enter-a-vent-length.md).

## Open items

- John saw TF magnitude −5.559 (WinISD) vs −5.561 (OpenISD) at 49.92 Hz in his own project. Not
  reproduced on sealed W5; awaiting his project file (possibly vented — check first).
- winisd_research local branch `backup/pre-strip-coredump` holds the only copy of the core dump;
  delete when John agrees.
- Rear/front port gain and the PR transfer-function charts do not exist in OpenISD (✗).
- Chart name ellipsis: at 1024 px the toolbar fits; hiding the version chip would free ~150 px
  if ever needed.

## Rules that bit this session

- Vue `:title="..."` attributes: no `"` inside, use `'`.
- Scratch specs go in `build/tmp/`, run with `-c scripts/playwright.probe.config.mjs`.
- `getClientRects().length` on a flex item is always 1 — measure height to detect wrapping.
- `toolbar-version.browser.spec.ts` requires the brand centred: `.tb-icons` must stay `flex:1 1 0`.
- `.claude/skills/git-actions/commit.sh --prose` pushes as well as commits.
