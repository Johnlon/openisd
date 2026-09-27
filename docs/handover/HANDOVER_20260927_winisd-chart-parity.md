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

1. ✅ **Filters on sealed, full** — every WinISD filter type, non-default settings: the 3 EQ/Filter
   charts plus SPL, excursion, VA, max SPL/power. Sealed is exact, so any gap is the filter's.
2. ✅ **Vented** — full chart pass, then one capture with a filter.
3. **Passive radiator**, then **bandpass 4th** — the same.
4. **Human re-verification (QO170)** — every WinISD bug claimed from debugger/disassembly/scripted
   runs is reproduced by hand in WinISD with John before it counts as fact. Filter bugs: the seven
   `bugs/BUG_20260927_winisd-*` filter files. Add each new claimed WinISD bug to QO170.

The filter response Hf multiplies into every box type the same way, so filter types are proven
once, on sealed; the other boxes need one filter capture each, not the full set.

## Done: filters on sealed (2026-09-27)

Every WinISD filter type and subtype is in OpenISD (one class per type, `engine/filters/`),
matched to WinISD by debugger: response ≤ 1e-12, group delay to WinISD's rounding. `.wpr`
`[Filters]` imports and exports. The Filters tab adds and edits every type. All 11 sealed charts
match WinISD with a 4-filter chain
([chart review §3.4](http://localhost:8000/winisd/openisd/docs/research/CHART_REVIEW_WINISD_VS_OPENISD.md?html)).
Left open: WinISD's Linkwitz-transform Add default (the project's closed-box fc/Qtc); what WinISD
draws where the box impedance is 0; the WinISD filter bugs pending QO170.

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

## Done: vented (2026-09-27)

WinISD's vented box decoded by debugger (winisd_research GHIDRA_FINDINGS.md "Vented box —
`0x456800`"): every loss fixed at ωb, port mass from Fb (vent length ignored), output cone − leak
− port, port air velocity peak √2·|Up|/Sp. OpenISD's `winisd-lossy` vented branch now uses it; the
`.wpr` import reads losses, vent diameter, end correction and Rg. All 11 vented charts plus the
filter chain match ([chart review §3.5](http://localhost:8000/winisd/openisd/docs/research/CHART_REVIEW_WINISD_VS_OPENISD.md?html)).

Still open for vented:
- **Vent length readout.** WinISD's charts ignore the length; its Box-tab length readout is
  unchecked against OpenISD's `ventLength` (c used, k·D for non-round, Num > 1).
- **End correction default.** OpenISD 0.732 (`engine/air.ts`) vs WinISD's 0.6 in a new project.
  Affects the length readout only (charts use Fb).
- **Vent shape.** Import reads round vents only; WinISD's non-round `Shape` codes are unverified.
- **Variants.** VC inductance on, Rg at driver side, more than one vent.
- **Box readouts.** Fb, F3, vent area on the Box tab.
- Open: [BUG_20260918_no-ui-path-to-enter-a-vent-length](../../bugs/BUG_20260918_no-ui-path-to-enter-a-vent-length.md).

## Next: passive radiator, then bandpass 4th

Capture code prepared by session openisd-e4 (winisd_research 0ba4342, 8f06913):
`w5_chart_refresh.py box=pr` / `box=bp4`, fit checks `toys/w5_pr_model_check.py`,
`toys/w5_bp4_model_check.py`. Expect the vented pattern (losses fixed at the chamber tuning).
The loss-model switch reaches sealed and vented today; PR and bandpass 4th still use the old
per-frequency form.

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
