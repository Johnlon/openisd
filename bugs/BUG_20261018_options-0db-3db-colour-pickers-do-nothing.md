# BUG_20261018_options-0db-3db-colour-pickers-do-nothing

**Status:** FIXED (T391, bob, 18 Oct 2026)

Recorded 18 Oct 2026 by opi. John: "BUG - DISPATCH A FIX". Task T391 (bob).

## Symptom
Options → Graph has "0 dB line" and "-3dB line" colour pickers. Changing them does nothing: the
0 dB and −3 dB reference lines on the transfer-function charts stay a fixed orange. In WinISD the
same two pickers (Options → Graph tab, `docs/winisd_helpfiles/help/options01.png`) colour those lines.

## Evidence
- Pickers are live and store a value: `packages/ui/src/ui/components/OptionsModal.vue:377-383`.
- Nothing else reads `zeroDb` / `minus3Db`: `git grep -n -E "zeroDb|minus3Db" -- packages` hits only OptionsModal.vue.
- The lines are drawn with a constant: `packages/design/chart/series.ts:175, 218, 233` (`color: '#ffb454'`).
- OptionsModal.vue header comment (lines 35-40) still says OpenISD has no transfer-function chart; it has one now (`TFMag`, series.ts:50).

## Cause
The pickers were added when OpenISD had no chart with these lines, and were never connected to
the chart builder once TFMag, the PR transfer function and the port-gain charts arrived.

## Fix
- The chart builder in packages/design takes the 0 dB and −3 dB colours from the app setting the
  pickers write, for every chart that draws those lines.
- Defaults live in packages/design, not the UI. Use WinISD's defaults if a capture shows them
  (help screenshot: 0 dB red, −3 dB purple); otherwise keep today's look.
- Remove the stale header comment.

## Verification
- Unit test in packages/design: a chosen colour reaches the 0 dB and −3 dB series of TFMag, PRTFMag and both port-gain charts.
- Browser spec: change the −3 dB picker in Options, then read the line colour on the TF magnitude chart from the screen.
- Before/after screenshots, phone and desktop.

## Resolution
- `packages/design/chart/series.ts`: `ReferenceLineColors`, `DEFAULT_REFERENCE_LINE_COLORS` and
  `referenceLineColors(chosen)`. TFMag, PRTFMag, RearPortGain and FrontPortGain draw their 0 dB and
  −3 dB lines from it; FltMag draws its 0 dB line from it. `buildPlotData` takes `referenceLines`.
- Defaults are WinISD's own, from the Options capture `docs/images/winisd/options-plot-window.png`:
  0 dB black, −3 dB grey (#808080). Before the fix the lines were grey-blue and orange.
- `GraphPanel-hooks.ts` passes the user's Options colours. OptionsModal's defaults come from
  packages/design; the stale header comment and tooltips are gone.
- Tests: `packages/design/test/chart/chart-types.test.ts`, `build-plot-data.test.ts`;
  browser spec `packages/ui/test/ui/reference-line-colours.browser.spec.ts` (both skins).
