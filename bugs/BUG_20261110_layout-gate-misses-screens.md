# The field layout gate never opened most screens that have a number box

Status: OPEN. John, 10 Nov 2026: "crucial: why are the UI tests not finding these layout issues"; "if new screens are added or popups then they must be auto included"; "if the agent forgets to add a row then it goes out of date".

`field-layout-rules.browser.spec.ts` walked the project tabs, the New project wizard and the What-if panel only. It never opened the Edit driver popup, the phone Advanced page, Options, the radiator editor or the filter editors. It never checked that a typed value fits its box or that a box has a gap before its up/down buttons. Its R2 never looked at the text inside an input.

Done in T742: R10 (gap), R11 (cut value), the Edit driver popup tabs and the phone Advanced page.

Still to do after T739 lands: (1) the spec iterates the surface manifests and opens each entry with `openMobileSurface`; (2) a unit test runs `discoverMobileSources` on the real source and fails with "<title> in <file> is not on the view list" for a number-box surface missing from the list, with a case that removes one entry and goes red.

Also open: on the phone Box and Driver tabs the label column is the longest label of the whole page, including rows with no box (a button row), so Fsc ends 40 px before its box; the Driver editor Dimensions tab (MagDpt, 74 px) is not on the shared label column.
